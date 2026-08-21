// Đồng bộ tiến độ IndexedDB ⇄ Firestore. CHỈ dynamic-import module này (không import tĩnh)
// để Firestore SDK (~227KB) không vào bundle đầu.
//
// Sync THÔNG MINH (tránh full đọc-ghi mỗi lần mở như bản cũ):
//  - Lưu "dấu vân tay" local + updatedAt remote của lần sync trước (localStorage).
//  - Mở app: đọc 1 doc user (nhỏ). Remote không đổi + local không đổi → BỎ QUA (0 chunk).
//  - Remote đổi (máy khác ghi) → kéo chunks + merge.
//  - Local đổi → mới ghi chunks lên (không ghi khi không có gì mới).
import { doc, getDoc, collection, getDocs, writeBatch, getFirestore, type Firestore } from "firebase/firestore";
import { getFbApp } from "./firebase";
import { db, getXp, getConfig, getGamifyState, invalidateProgressSummary } from "./db";
import { getCourseDone, mergeCourseDone, getStoryPositions, mergeStoryPositions, storyPosStamp } from "./progress-local";
import {
  fingerprint, fpEq, mergeSnapshots, pruneUndefined,
  mergeReviews, mergeDaily, mergeReads, mergeNotes, mergeGamify,
  sanitizeRemote, sanitizeReviews, sanitizeConfig,
  type Fp, type SyncSnapshot,
} from "./sync-merge";
import { setSyncOk } from "./sync-status";
import type { ReviewRecord } from "./types";

const CHUNK = 1500;
const STATE_KEY = "en.syncState"; // { remoteUpdatedAt, fp }

let storeInstance: Firestore | null = null;
async function getStore(): Promise<Firestore | null> {
  const app = await getFbApp();
  if (!app) return null;
  if (!storeInstance) storeInstance = getFirestore(app);
  return storeInstance;
}

// ---- serialize Date ⇄ ISO cho Firestore ----
function revToPlain(r: ReviewRecord) {
  return {
    ...r,
    due: r.due instanceof Date ? r.due.toISOString() : r.due,
    last_review: r.last_review ? (r.last_review instanceof Date ? r.last_review.toISOString() : r.last_review) : null,
  };
}
// Chiều ngược lại (hồi sinh Date + lọc schema) nằm ở sanitizeReviews/sanitizeRemote: doc cloud
// có thể do bản app cũ ghi hoặc bị sửa tay, một bản ghi hỏng đủ làm abort cả transaction Dexie.

// Dấu vân tay + hợp nhất nằm ở lib/sync-merge.ts (hàm thuần, có unit test 2 máy).
function cfgStamp(): string {
  try {
    return localStorage.getItem("en.cfgUpdatedAt") ?? "";
  } catch {
    return "";
  }
}
const fpLocal = (s: SyncSnapshot): Fp => fingerprint(s, cfgStamp(), storyPosStamp());

function loadState(): { remoteUpdatedAt: string; fp: Fp } | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveState(remoteUpdatedAt: string, fp: Fp): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ remoteUpdatedAt, fp }));
  } catch {
    /* bỏ qua */
  }
}

export interface SyncResult {
  reviews: number;
  reads: number;
  skipped: boolean; // true = không có gì thay đổi, không đụng chunks
}

// Chống chạy chồng: `visibilitychange`, `focus`, `pagehide`, event "en:sync" đều gọi thẳng
// syncNow — hai lượt chạy song song sẽ đọc cùng một `remote.updatedAt`, ghi đè saveState của
// nhau và nhân đôi cửa sổ race với thao tác học. Lượt gọi trong lúc đang chạy được gộp vào
// lượt hiện tại; nếu có yêu cầu mới thì chạy thêm ĐÚNG một lượt nữa sau khi lượt này xong
// (để thay đổi phát sinh giữa chừng vẫn kịp lên cloud).
let inFlight: Promise<SyncResult> | null = null;
let rerun = false;

/** Đồng bộ 2 chiều có điều kiện: bỏ qua khi cả 2 phía không đổi; chỉ ghi khi local đổi. */
export function syncNow(uid: string): Promise<SyncResult> {
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  const chain = (async () => {
    let r = await runSync(uid);
    if (rerun) {
      rerun = false;
      r = await runSync(uid);
    }
    return r;
  })();
  inFlight = chain.finally(() => {
    inFlight = null;
    rerun = false;
  });
  return inFlight;
}

async function runSync(uid: string): Promise<SyncResult> {
  const store = await getStore();
  if (!store) throw new Error("Firestore chưa cấu hình");

  // local + fingerprint
  const [localReviews, localDaily, localReads, localXp, localNotes, localGamify] = await Promise.all([
    db.reviews.toArray(),
    db.daily.toArray(),
    db.reads.toArray(),
    getXp(),
    db.notes.toArray(),
    getGamifyState(),
  ]);
  const local: SyncSnapshot = {
    reviews: localReviews,
    daily: localDaily,
    reads: localReads,
    notes: localNotes,
    xp: localXp,
    phonics: [...getCourseDone("phonics")],
    grammar: [...getCourseDone("grammar")],
    storyPos: getStoryPositions(),
    gamify: localGamify,
  };
  const localFp = fpLocal(local);
  const state = loadState();

  // remote: 1 doc nhỏ trước
  const userRef = doc(store, "users", uid);
  const snap = await getDoc(userRef);
  const remote = snap.exists() ? snap.data() : {};
  const remoteUpdatedAt = (remote.updatedAt as string) ?? "";

  const remoteChanged = !state || state.remoteUpdatedAt !== remoteUpdatedAt;
  const localChanged = !state || !fpEq(state.fp, localFp);

  // Không gì đổi → thoát sớm, không đọc/ghi chunk nào.
  if (!remoteChanged && !localChanged) {
    setSyncOk(`${localFp.rc.toLocaleString("vi")} thẻ · ${localFp.rd} bài đã đọc · không có gì mới`);
    return { reviews: localFp.rc, reads: localFp.rd, skipped: true };
  }

  // Kéo remote đầy đủ khi remote đổi (máy khác ghi) hoặc lần đầu.
  const remoteReviews: ReviewRecord[] = [];
  if (remoteChanged) {
    const chunkSnap = await getDocs(collection(store, "users", uid, "reviews"));
    chunkSnap.forEach((d) => remoteReviews.push(...sanitizeReviews(d.data().items)));
  }

  // merge (remote không đổi → merged = local; local đã chứa remote từ lần sync trước)
  const merged = remoteChanged
    ? mergeSnapshots(local, { ...sanitizeRemote(remote), reviews: remoteReviews })
    : local;
  const { reviews, daily, reads, notes, xp, storyPos, gamify } = merged;

  // ghi local (chỉ khi có kéo remote về)
  if (remoteChanged) {
    // phần lưu ở localStorage phải ghi qua helper của progress-local (merge + persist)
    mergeCourseDone("phonics", merged.phonics);
    mergeCourseDone("grammar", merged.grammar);
    mergeStoryPositions(storyPos);
    await db.transaction("rw", [db.reviews, db.daily, db.reads, db.gamify, db.notes], async () => {
      // ĐỌC LẠI ngay trong transaction rồi merge tiếp: giữa lúc đọc snapshot ở đầu hàm và lúc
      // này đã có vài giây đi mạng, người dùng có thể vừa trả lời thêm thẻ. bulkPut thẳng
      // `merged` sẽ ghi đè mất các lượt đó VĨNH VIỄN (fingerprint sau đó khớp nên không tự lành).
      const [curReviews, curDaily, curReads, curNotes, curGamify] = await Promise.all([
        db.reviews.toArray(),
        db.daily.toArray(),
        db.reads.toArray(),
        db.notes.toArray(),
        db.gamify.get("state"),
      ]);
      await db.reviews.bulkPut(mergeReviews(curReviews, reviews));
      await db.daily.bulkPut(mergeDaily(curDaily, daily));
      await db.reads.bulkPut(mergeReads(curReads, reads));
      await db.notes.bulkPut(mergeNotes(curNotes, notes));
      await db.gamify.put(mergeGamify({ ...gamify, xp: Math.max(xp, gamify.xp) }, curGamify ?? { key: "state", xp: 0 }));
    });
    invalidateProgressSummary(); // vừa kéo tiến độ máy khác về → header/trang chủ phải tính lại
    // cài đặt: máy nào đổi sau thì thắng
    const remoteCfgAt = typeof remote.configUpdatedAt === "string" ? remote.configUpdatedAt : "";
    if (remote.config && remoteCfgAt && remoteCfgAt > cfgStamp()) {
      await db.config.put({ key: "srs", value: sanitizeConfig(remote.config, await getConfig()) });
      try {
        localStorage.setItem("en.cfgUpdatedAt", remoteCfgAt);
      } catch {
        /* bỏ qua */
      }
    }
  }

  // ghi remote CHỈ khi local có thay đổi thật (hoặc lần đầu chưa có remote)
  let finalRemoteUpdatedAt = remoteUpdatedAt;
  if (localChanged || !snap.exists()) {
    const chunks: ReviewRecord[][] = [];
    for (let i = 0; i < reviews.length; i += CHUNK) chunks.push(reviews.slice(i, i + CHUNK));
    finalRemoteUpdatedAt = new Date().toISOString();
    const cfg = await getConfig();
    const batch = writeBatch(store);
    // pruneUndefined: Firestore từ chối field `undefined` và làm hỏng cả batch → lọc trước khi ghi.
    batch.set(
      userRef,
      pruneUndefined({
        daily, reads, xp, notes, phonics: merged.phonics, grammar: merged.grammar, storyPos,
        freeze: {
          freezes: gamify.freezes ?? 0,
          frozenDates: gamify.frozenDates ?? [],
          grantStreak: gamify.grantStreak ?? 0,
          maxCombo: gamify.maxCombo ?? 0,
          questsDone: gamify.questsDone ?? [],
        },
        reviewChunks: chunks.length, updatedAt: finalRemoteUpdatedAt,
        config: cfg, configUpdatedAt: cfgStamp() || finalRemoteUpdatedAt,
      }),
    );
    chunks.forEach((c, i) =>
      batch.set(doc(store, "users", uid, "reviews", String(i)), pruneUndefined({ items: c.map(revToPlain) })),
    );
    // xoá chunk thừa nếu lần này ít hơn lần trước
    const prevChunks = (remote.reviewChunks as number) ?? 0;
    for (let i = chunks.length; i < prevChunks; i++) batch.delete(doc(store, "users", uid, "reviews", String(i)));
    await batch.commit();
  }

  saveState(finalRemoteUpdatedAt, fpLocal(merged));
  setSyncOk(`${reviews.length.toLocaleString("vi")} thẻ · ${reads.length} bài đã đọc${remoteChanged ? " · đã kéo từ máy khác" : ""}`);
  return { reviews: reviews.length, reads: reads.length, skipped: false };
}
