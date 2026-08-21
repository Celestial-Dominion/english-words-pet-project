// Nguồn sự thật tiến độ học: IndexedDB (offline-first) qua Dexie.
import Dexie, { type Table } from "dexie";
import type { Grade } from "ts-fsrs";
import type { ReviewRecord, DailyStat, ReadRow, NoteRow, GamifyRow, RevlogRow, SrsConfig } from "./types";
import { DEFAULT_SRS_CONFIG } from "./types";
import { newCard, schedule, scheduleRated, recordToCard, cardToRecordFields } from "./srs";
import { todayStr, computeStreak, longestStreak, maxComebackGap, LEECH_LAPSES, MATURE_STABILITY } from "./srs-pure";
import { dailyQuests, questProgress, questKey, pruneQuestKeys, type QuestProgress } from "./gamify";
import { mergeReviews, mergeDaily, mergeReads, mergeNotes, mergeGamify, mergeIdSet } from "./sync-merge";

// Re-export để phần còn lại của app vẫn import từ lib/db như trước.
export { todayStr, computeStreak };

class EnglishWordsDB extends Dexie {
  reviews!: Table<ReviewRecord, string>; // key = wordId
  daily!: Table<DailyStat, string>; // key = date
  reads!: Table<ReadRow, string>; // key = id
  config!: Table<{ key: string; value: SrsConfig }, string>;
  gamify!: Table<GamifyRow, string>; // key "state" (xp + đóng băng chuỗi)
  notes!: Table<NoteRow, string>; // mẹo nhớ tự ghi (text "" = tombstone đã xoá)
  revlog!: Table<RevlogRow, number>; // nhật ký từng lượt chấm (local, nền cho tối ưu FSRS)

  constructor() {
    super("english-words");
    this.version(1).stores({
      reviews: "wordId, due, level, state",
      daily: "date",
      reads: "id",
      config: "key",
    });
    this.version(2).stores({ gamify: "key" });
    this.version(3).stores({ notes: "wordId" });
    // v4: nhật ký từng lượt ôn (revlog) — nền cho tối ưu FSRS. Dữ liệu cũ giữ nguyên.
    this.version(4).stores({ revlog: "++id, wordId, at" });
  }
}

export const db = new EnglishWordsDB();

// IndexedDB hỏng phải HIỆN RA (banner StorageAlert) — nuốt im lặng nghĩa là người
// dùng học cả phiên mà không lưu được gì (Safari riêng tư, hết quota). versionchange:
// tab cũ còn mở khi tab khác nâng schema → Dexie đóng kết nối, mọi thao tác sau đó
// fail — chỉ có tải lại trang mới cứu được. (Import động để module thuần khỏi kéo UI.)
function noteDbError(e: unknown): void {
  void import("./storage-status").then((m) => m.noteStorageError(e));
}
if (typeof window !== "undefined") {
  db.on("versionchange", () => noteDbError(new Error("dữ liệu được nâng cấp ở tab khác, cần tải lại")));
  db.open().catch(noteDbError);
  // Middleware dbcore: MỌI thao tác GHI thất bại (addXp, mẹo nhớ, luyện tập, undo, import…)
  // đều nổi banner — không chỉ recordAnswer. Nếu chỉ nối tay từng hàm thì phiên /luyen-tap
  // (chỉ gọi recordPractice/addXp) hết quota là mất sạch XP không một lời cảnh báo.
  db.use({
    stack: "dbcore",
    name: "bao-loi-luu",
    create: (down) => ({
      ...down,
      table(name: string) {
        const t = down.table(name);
        return {
          ...t,
          mutate: (req) =>
            t.mutate(req).catch((e: unknown) => {
              noteDbError(e);
              throw e;
            }),
        };
      },
    }),
  });
}

// ---- Cấu hình SRS ----
export async function getConfig(): Promise<SrsConfig> {
  const row = await db.config.get("srs");
  return { ...DEFAULT_SRS_CONFIG, ...(row?.value ?? {}) };
}
export async function setConfig(patch: Partial<SrsConfig>): Promise<SrsConfig> {
  const cur = await getConfig();
  const value = { ...cur, ...patch };
  await db.config.put({ key: "srs", value });
  // dấu thời gian đổi cài đặt trên MÁY NÀY (để sync cloud biết bên nào mới hơn)
  try {
    localStorage.setItem("en.cfgUpdatedAt", new Date().toISOString());
  } catch {
    /* bỏ qua */
  }
  return value;
}

// ---- Ngày địa phương "YYYY-MM-DD" ----

// ---- Truy vấn thẻ ----
export async function getReview(wordId: string): Promise<ReviewRecord | undefined> {
  return db.reviews.get(wordId);
}

/** Các thẻ đến hạn (due <= now). Lọc theo cấp nếu truyền level. */
export async function getDueReviews(now = new Date(), level?: number): Promise<ReviewRecord[]> {
  const rows = await db.reviews.where("due").belowOrEqual(now).toArray();
  return level ? rows.filter((r) => r.level === level) : rows;
}

export async function countDue(now = new Date()): Promise<number> {
  return db.reviews.where("due").belowOrEqual(now).count();
}

/** Ôn sớm: các thẻ CHƯA tới hạn (due > now), sắp tới hạn sớm nhất trước. */
export async function getAheadReviews(now = new Date(), limit = 20): Promise<ReviewRecord[]> {
  const rows = await db.reviews.where("due").above(now).toArray();
  rows.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  return rows.slice(0, limit);
}
export async function countAhead(now = new Date()): Promise<number> {
  return db.reviews.where("due").above(now).count();
}

/** Từ "hay quên" (leech): số lần trả lời sai (lapses) từ 3 trở lên. */
export async function getHardReviews(limit = 30): Promise<ReviewRecord[]> {
  const rows = await db.reviews.toArray();
  return rows
    .filter((r) => (r.lapses ?? 0) >= 3)
    .sort((a, b) => (b.lapses ?? 0) - (a.lapses ?? 0))
    .slice(0, limit);
}
export async function countHard(): Promise<number> {
  const rows = await db.reviews.toArray();
  return rows.filter((r) => (r.lapses ?? 0) >= 3).length;
}

/** Tập wordId đã đưa vào học (để loại khỏi "từ mới"). */
export async function learnedIds(): Promise<Set<string>> {
  const keys = await db.reviews.toCollection().primaryKeys();
  return new Set(keys as string[]);
}

export async function newTodayCount(): Promise<number> {
  const row = await db.daily.get(todayStr());
  return row?.newCount ?? 0;
}

// ---- Ghi kết quả một lượt trả lời ----
/**
 * Cập nhật lịch FSRS cho một từ sau khi trả lời.
 * isNew = true nếu đây là lần đầu đưa từ vào học (đếm vào newCount trong ngày).
 */
export async function recordAnswer(opts: {
  wordId: string;
  level: number;
  correct: boolean;
  isNew: boolean;
  rating?: Grade; // chấm theo tốc độ (Lại/Khó/Được/Dễ); bỏ trống = suy từ correct
  now?: Date;
}): Promise<{ prev: ReviewRecord | undefined; next: ReviewRecord; date: string }> {
  const now = opts.now ?? new Date();
  const date = todayStr(now);
  let existing: ReviewRecord | undefined;
  let rec!: ReviewRecord;
  // Thẻ, revlog và thống kê ngày ghi trong CÙNG transaction: tách ra thì tắt máy đúng giữa
  // hai bước làm lệch số liệu ngày so với lịch FSRS; revlog được await → Hoàn tác gỡ được
  // dòng log chắc chắn. Ghi hỏng (riêng tư/quota/tab cũ) → báo banner StorageAlert rồi ném tiếp.
  await db.transaction("rw", [db.reviews, db.revlog, db.daily], async () => {
    existing = await db.reviews.get(opts.wordId);
    const card = existing ? recordToCard(existing) : newCard(now);
    const next = opts.rating != null ? scheduleRated(card, opts.rating, now) : schedule(card, opts.correct, now);
    rec = {
      wordId: opts.wordId,
      level: opts.level,
      introducedOn: existing?.introducedOn ?? todayStr(now),
      ...cardToRecordFields(next),
    };
    await db.reviews.put(rec);

    // revlog là phụ trợ — lỗi (hết quota đĩa…) không được làm hỏng lần chấm.
    await db.revlog
      .add({
        wordId: opts.wordId,
        at: now.getTime(),
        rating: (opts.rating as number | undefined) ?? (opts.correct ? 3 : 1),
        state: card.state, // TRƯỚC khi chấm
        elapsed_days: rec.elapsed_days,
        scheduled_days: rec.scheduled_days,
        stability: rec.stability,
        difficulty: rec.difficulty,
      })
      .catch(() => {});

    const d = (await db.daily.get(date)) ?? { date, reviews: 0, newCount: 0, again: 0 };
    d.reviews += 1;
    if (opts.isNew) d.newCount += 1;
    if (!opts.correct) d.again += 1;
    await db.daily.put(d);
  }).catch((e) => {
    noteDbError(e);
    throw e;
  });
  invalidateProgressSummary();
  pruneRevlogThrottled(now); // dọn nhật ký cũ (nhiều nhất 1 lần/ngày, fire-and-forget)
  return { prev: existing, next: rec, date };
}

// revlog ghi 1 dòng/lượt chấm MÃI MÃI (~36k dòng/năm với 100 lượt/ngày) mà mục đích
// (tối ưu FSRS cá nhân hoá) chỉ cần lịch sử gần đây → giữ 2 năm, dọn phần cũ hơn.
// Không dọn thì đây là bảng phình vô hạn dễ chạm quota IndexedDB nhất.
const REVLOG_RETENTION_MS = 2 * 365 * 86400000;
function pruneRevlogThrottled(now: Date): void {
  try {
    const key = "en.revlog.prunedOn";
    const today = todayStr(now);
    if (typeof localStorage === "undefined" || localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
  } catch {
    return; // không đọc/ghi được mốc → thôi, mai thử lại
  }
  // Phụ trợ — lỗi không được ảnh hưởng lần chấm (giống revlog.add trong recordAnswer).
  void db.revlog
    .where("at")
    .below(now.getTime() - REVLOG_RETENTION_MS)
    .delete()
    .catch(() => {});
}

/** "Đã biết rồi": tạo sẵn thẻ NHỚ BỀN (stability cao, due ~60 ngày) cho từ đã biết —
 *  không phải học lại từ đầu qua phiên từ mới (như HSK). */
export async function markKnown(wordId: string, level: number, now = new Date()): Promise<boolean> {
  if (await db.reviews.get(wordId)) return false;
  const due = new Date(now);
  due.setDate(due.getDate() + 60);
  await db.reviews.put({
    wordId,
    level,
    due,
    stability: 60,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 60,
    reps: 1,
    lapses: 0,
    learning_steps: 0,
    state: 2, // Review
    last_review: now,
    introducedOn: todayStr(now),
  });
  invalidateProgressSummary();
  return true;
}

/** Hoàn tác lần chấm vừa rồi: khôi phục bản ghi FSRS cũ + trừ lại thống kê ngày. */
export async function undoAnswer(opts: {
  wordId: string;
  prev: ReviewRecord | undefined;
  correct: boolean;
  isNew: boolean;
  date?: string; // ngày của lần chấm (trừ đúng ngày kể cả undo qua nửa đêm)
}): Promise<void> {
  const date = opts.date ?? todayStr();
  await db.transaction("rw", [db.reviews, db.revlog, db.daily], async () => {
    if (opts.prev) await db.reviews.put(opts.prev);
    else await db.reviews.delete(opts.wordId);
    // gỡ dòng revlog CUỐI của từ (lượt chấm vừa bị hoàn tác) — trong cùng wordId, index
    // IndexedDB sắp theo khoá chính (= thứ tự ghi) nên .last() chính là dòng mới nhất, O(1).
    const last = await db.revlog.where("wordId").equals(opts.wordId).last();
    if (last?.id != null) await db.revlog.delete(last.id);
    const d = await db.daily.get(date);
    if (!d) return;
    d.reviews = Math.max(0, d.reviews - 1);
    if (opts.isNew) d.newCount = Math.max(0, d.newCount - 1);
    if (!opts.correct) d.again = Math.max(0, d.again - 1);
    await db.daily.put(d);
  }).catch((e) => {
    // hoàn tác hỏng phải NỔI banner + ném tiếp — nơi gọi giữ nút Hoàn tác để thử lại
    noteDbError(e);
    throw e;
  });
  invalidateProgressSummary();
}

// ---- Mẹo nhớ tự ghi (mnemonic) ----
export async function getMnemonic(wordId: string): Promise<string> {
  return (await db.notes.get(wordId))?.text ?? "";
}
export async function setMnemonic(wordId: string, text: string): Promise<void> {
  const t = text.trim();
  const cur = await db.notes.get(wordId);
  if ((cur?.text ?? "") === t) return; // không đổi → không bơm timestamp mới
  await db.notes.put({ wordId, text: t, at: Date.now() }); // "" = tombstone
}

// ---- Gamify (F7): XP tích luỹ + tổng hợp thống kê ----
export async function addXp(n: number): Promise<void> {
  await db.transaction("rw", db.gamify, async () => {
    const row = (await db.gamify.get("state")) ?? { key: "state", xp: 0 };
    row.xp += n;
    await db.gamify.put(row);
  });
  invalidateProgressSummary();
}
export async function getXp(): Promise<number> {
  return (await db.gamify.get("state"))?.xp ?? 0;
}
export async function setXp(xp: number): Promise<void> {
  const row = (await db.gamify.get("state")) ?? { key: "state", xp: 0 };
  await db.gamify.put({ ...row, xp });
  invalidateProgressSummary();
}

// ---- 🧊 Đóng băng chuỗi: lỡ 1 ngày không mất chuỗi ----
// Tặng 1 freeze mỗi khi chuỗi đạt mốc 7 ngày mới (tối đa giữ 3).
// Lỡ đúng 1 ngày (hôm qua) mà còn freeze → tự "đóng băng" ngày đó, tính như có học.
const FREEZE_CAP = 3;
export async function getGamifyState(): Promise<GamifyRow> {
  return (await db.gamify.get("state")) ?? { key: "state", xp: 0 };
}
export async function applyStreakFreeze(daily: DailyStat[], today = todayStr()): Promise<GamifyRow> {
  const row = await getGamifyState();
  const frozen = new Set(row.frozenDates ?? []);
  const active = new Set(daily.filter((d) => d.reviews > 0).map((d) => d.date));
  for (const f of frozen) active.add(f);

  // 1) Tiêu freeze: hôm qua trống + hôm kia có chuỗi → đóng băng hôm qua.
  const y = new Date(today + "T00:00:00");
  y.setDate(y.getDate() - 1);
  const yesterday = todayStr(y);
  y.setDate(y.getDate() - 1);
  const dayBefore = todayStr(y);
  if (!active.has(yesterday) && active.has(dayBefore) && (row.freezes ?? 0) > 0) {
    frozen.add(yesterday);
    active.add(yesterday);
    row.freezes = (row.freezes ?? 0) - 1;
    row.frozenDates = [...frozen];
    await db.gamify.put(row);
  }

  // 2) Tặng freeze theo mốc 7 ngày chuỗi (mỗi mốc tặng 1 lần).
  const streak = computeStreak([...active], today);
  // Chuỗi ĐỨT rồi xây lại thì mốc đã tặng của chuỗi cũ phải bỏ đi: trước đây đứt ở 14 ngày
  // thì phải leo tới 21 mới lại được tặng, trái với dòng mô tả "mỗi mốc chuỗi 7 ngày tặng 1".
  // (Khi sync 2 máy, grantStreak lấy MAX nên máy kia có thể kéo mốc cũ về — chấp nhận: phần
  // thưởng là số freeze thì đã merge đúng, chỉ mốc đếm là xấp xỉ.)
  const granted = streak < (row.grantStreak ?? 0) ? 0 : (row.grantStreak ?? 0);
  if (Math.floor(streak / 7) > Math.floor(granted / 7) && (row.freezes ?? 0) < FREEZE_CAP) {
    row.freezes = Math.min(FREEZE_CAP, (row.freezes ?? 0) + 1);
    row.grantStreak = streak;
    await db.gamify.put(row);
  } else if (granted !== (row.grantStreak ?? 0)) {
    row.grantStreak = granted;
    await db.gamify.put(row);
  }
  return row;
}


export interface ProgressSummary {
  words: number; // tổng từ đã học
  byLevel: Record<number, number>; // số từ đã học theo cấp
  reviews: number; // tổng lượt ôn mọi ngày
  correct: number; // tổng lượt trả lời đúng (reviews - again)
  reads: number; // số bài đã đọc
  xp: number;
  streak: number;
  freezes: number; // 🧊 lượt đóng băng chuỗi còn lại
  activeDays: number; // tổng số ngày có học
  matured: number; // số từ nhớ bền (FSRS stability ≥ 21 ngày)
  maxDayReviews: number; // số lượt ôn cao nhất trong 1 ngày
  weekend: boolean; // từng học vào T7/CN
  daily: DailyStat[]; // sắp theo ngày tăng dần
  redeemedLeeches: number; // từ hay quên (lapses ≥4) đã đạt nhớ bền — huy hiệu Săn Kraken
  maxCombo: number; // chuỗi đúng liên tiếp dài nhất một phiên (gamify, max-merge)
  longestStreak: number; // chuỗi ngày dài nhất từng đạt (kể cả ngày đóng băng, như streak)
  comebackDays: number; // quãng nghỉ dài nhất đã quay lại học — huy hiệu Tái xuất
  perfectDay: boolean; // từng có ngày ≥20 lượt ôn, 0 sai
}

// progressSummary quét TOÀN BỘ bảng reviews (12k dòng) + daily + reads. Header (LevelChip),
// trang chủ (HomeStats) và lưới cấp cùng gọi mỗi lần điều hướng → 3 lần quét y hệt nhau cách
// nhau vài mili giây. Gộp các lời gọi sát nhau vào một lần quét; mọi hàm GHI đều xoá cache
// nên số liệu không bao giờ cũ hơn thao tác của người dùng.
const SUMMARY_TTL_MS = 1500;
let summaryCache: { at: number; p: Promise<ProgressSummary> } | null = null;

export function invalidateProgressSummary(): void {
  summaryCache = null;
}

export function progressSummary(): Promise<ProgressSummary> {
  const now = Date.now();
  if (summaryCache && now - summaryCache.at < SUMMARY_TTL_MS) return summaryCache.p;
  const p = computeProgressSummary().catch((e) => {
    summaryCache = null;
    throw e;
  });
  summaryCache = { at: now, p };
  return p;
}

async function computeProgressSummary(): Promise<ProgressSummary> {
  const [reviews, dailyRows, xp, readRows] = await Promise.all([
    db.reviews.toArray(),
    db.daily.toArray(),
    getXp(),
    db.reads.toArray(),
  ]);
  const readsCount = readRows.filter(readActive).length;
  const gamifyRow = await applyStreakFreeze(dailyRows);
  const frozenDates = gamifyRow.frozenDates ?? [];
  const byLevel: Record<number, number> = {};
  for (const r of reviews) byLevel[r.level] = (byLevel[r.level] || 0) + 1;
  const daily = dailyRows.sort((a, b) => a.date.localeCompare(b.date));
  const reviewsTotal = daily.reduce((s, d) => s + d.reviews, 0);
  const correctTotal = daily.reduce((s, d) => s + Math.max(0, d.reviews - d.again), 0);
  const activeDays = daily.filter((d) => d.reviews > 0).length;
  const matured = reviews.filter((r) => (r.stability ?? 0) >= 21).length;
  const maxDayReviews = daily.reduce((m, d) => Math.max(m, d.reviews), 0);
  const weekend = daily.some((d) => {
    const wd = new Date(d.date + "T00:00:00").getDay();
    return d.reviews > 0 && (wd === 0 || wd === 6);
  });
  const activeDates = daily.filter((d) => d.reviews > 0).map((d) => d.date);
  // Kraken thuần phục: từng là leech (quên ≥4 lần) mà VẪN leo được tới nhớ bền.
  const redeemedLeeches = reviews.filter(
    (r) => (r.lapses ?? 0) >= LEECH_LAPSES && (r.stability ?? 0) >= MATURE_STABILITY,
  ).length;
  return {
    words: reviews.length,
    byLevel,
    reviews: reviewsTotal,
    correct: correctTotal,
    reads: readsCount,
    xp,
    streak: computeStreak([...activeDates, ...frozenDates]),
    freezes: gamifyRow.freezes ?? 0,
    activeDays,
    matured,
    maxDayReviews,
    weekend,
    daily,
    redeemedLeeches,
    maxCombo: gamifyRow.maxCombo ?? 0,
    longestStreak: longestStreak([...activeDates, ...frozenDates]), // cùng luật với streak (ngày đóng băng tính như có học)
    comebackDays: maxComebackGap(activeDates),
    perfectDay: daily.some((d) => d.reviews >= 20 && d.again === 0),
  };
}

/** Ghi kỷ lục combo của phiên (chỉ khi vượt kỷ lục cũ) — nguồn cho huy hiệu "Loạt pháo". */
export async function updateMaxCombo(combo: number): Promise<void> {
  if (combo <= 0) return;
  await db.transaction("rw", db.gamify, async () => {
    const row = (await db.gamify.get("state")) ?? { key: "state", xp: 0 };
    if (combo <= (row.maxCombo ?? 0)) return;
    row.maxCombo = combo;
    await db.gamify.put(row);
  });
  invalidateProgressSummary();
}

// ---- Nhiệm vụ ngày (lib/quests.ts là phần thuần; đây là phần đọc DB + nhận thưởng) ----
export interface TodayQuests {
  quests: QuestProgress[];
  claimed: Set<string>; // id nhiệm vụ HÔM NAY đã nhận thưởng
  justGranted: number; // XP vừa cộng trong lời gọi này (0 = không có gì mới)
}

/** Tiến độ 3 nhiệm vụ hôm nay + TỰ NHẬN thưởng cho nhiệm vụ vừa hoàn thành (idempotent:
 *  khoá "ngày:id" trong gamify.questsDone, union khi sync nên hai máy không cộng kép). */
export async function todayQuests(now = new Date()): Promise<TodayQuests> {
  const date = todayStr(now);
  const [day, readRows] = await Promise.all([db.daily.get(date), db.reads.toArray()]);
  const reads = readRows.filter((r) => readActive(r) && todayStr(new Date(r.readAt)) === date).length;
  const m = {
    reviews: day?.reviews ?? 0,
    newCount: day?.newCount ?? 0,
    again: day?.again ?? 0,
    correct: Math.max(0, (day?.reviews ?? 0) - (day?.again ?? 0)),
    reads,
  };
  const quests = dailyQuests(date).map((q) => questProgress(q, m));

  let justGranted = 0;
  const claimed = new Set<string>();
  await db.transaction("rw", db.gamify, async () => {
    const row = (await db.gamify.get("state")) ?? { key: "state", xp: 0 };
    const doneKeys = new Set(row.questsDone ?? []);
    for (const p of quests) {
      const k = questKey(date, p.def.id);
      if (doneKeys.has(k)) {
        claimed.add(p.def.id);
        continue;
      }
      if (!p.done) continue;
      doneKeys.add(k);
      claimed.add(p.def.id);
      justGranted += p.def.xp;
    }
    if (justGranted > 0) {
      row.xp += justGranted;
      row.questsDone = pruneQuestKeys([...doneKeys], date);
      await db.gamify.put(row);
    }
  });
  if (justGranted > 0) invalidateProgressSummary();
  return { quests, claimed, justGranted };
}

// ---- Sao lưu / khôi phục (như HSK) ----

// Nhãn app trong tệp sao lưu. "fr-words" là nhãn cũ kế thừa từ app tiếng Pháp — vẫn NHẬN được
// để backup người dùng đã xuất trước đây không thành rác.
export const BACKUP_APP = "en-words";
const LEGACY_BACKUP_APPS = ["fr-words"];
const isBackupApp = (v: unknown): boolean => v === BACKUP_APP || LEGACY_BACKUP_APPS.includes(v as string);

export interface BackupData {
  app: string;
  version: number;
  exportedAt: string;
  reviews: ReviewRecord[];
  daily: DailyStat[];
  reads?: ReadRow[];
  config?: { key: string; value: SrsConfig }[];
  gamify?: GamifyRow[];
  notes?: NoteRow[];
  revlog?: RevlogRow[]; // nhật ký lượt chấm (nền tối ưu FSRS) — đổi máy không mất
  phonics?: string[]; // bài phát âm đã học (localStorage)
  grammar?: string[]; // bài ngữ pháp đã học (localStorage)
}

export async function exportData(): Promise<BackupData> {
  const [reviews, daily, reads, config, gamify, notes, revlog] = await Promise.all([
    db.reviews.toArray(),
    db.daily.toArray(),
    db.reads.toArray(),
    db.config.toArray(),
    db.gamify.toArray(),
    db.notes.toArray(),
    db.revlog.toArray(),
  ]);
  const local = (k: string): string[] => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "[]") as string[];
    } catch {
      return [];
    }
  };
  return {
    app: BACKUP_APP,
    version: 5, // v5: thêm revlog (nhật ký từng lượt chấm)
    exportedAt: new Date().toISOString(),
    reviews, daily, reads, config, gamify, notes, revlog,
    phonics: local("en.phonicsDone"),
    grammar: local("en.grammarDone"),
  };
}

// JSON biến Date → chuỗi ISO; phải hồi sinh để Dexie index `due` so sánh đúng kiểu.
function reviveReview(r: ReviewRecord): ReviewRecord {
  return { ...r, due: new Date(r.due), last_review: r.last_review ? new Date(r.last_review) : undefined };
}

export async function importData(
  data: BackupData,
  mode: "replace" | "merge" = "replace",
): Promise<{ reviews: number; daily: number }> {
  if (!isBackupApp(data?.app) || !Array.isArray(data.reviews))
    throw new Error("Tệp sao lưu không hợp lệ (thiếu trường bắt buộc).");
  const fileReviews = data.reviews.map(reviveReview);
  await db.transaction("rw", [db.reviews, db.daily, db.reads, db.config, db.gamify, db.notes, db.revlog], async () => {
    if (mode === "replace") {
      await Promise.all([db.reviews.clear(), db.daily.clear(), db.reads.clear(), db.config.clear(), db.gamify.clear(), db.notes.clear()]);
      await db.reviews.bulkPut(fileReviews);
      if (Array.isArray(data.daily)) await db.daily.bulkPut(data.daily);
      if (Array.isArray(data.reads)) await db.reads.bulkPut(data.reads);
      if (Array.isArray(data.gamify)) await db.gamify.bulkPut(data.gamify);
      if (Array.isArray(data.notes)) await db.notes.bulkPut(data.notes);
      // revlog: CHỈ đụng khi tệp thật sự mang revlog — backup cũ (trước v5, không có trường
      // này) mà cũng clear thì xoá oan nhật ký local, dữ liệu tệp chưa bao giờ đại diện.
      // Bỏ id cũ để ++id cấp lại — tránh đè dòng nếu DB đích đã có revlog.
      if (Array.isArray(data.revlog)) {
        await db.revlog.clear();
        await db.revlog.bulkAdd(data.revlog.map(({ id: _id, ...r }) => r));
      }
    } else {
      // GỘP THẬT: dùng đúng luật hội tụ của đồng bộ (bản ôn mới hơn thắng, daily lấy MAX,
      // đọc/mẹo nhớ lấy hành động sau cùng). Trước đây merge chỉ là bulkPut không clear →
      // bản trong TỆP luôn thắng, nhập lại backup cũ là tiến độ thụt lùi rồi bị sync đẩy lên cloud.
      const [curReviews, curDaily, curReads, curNotes, curGamify] = await Promise.all([
        db.reviews.toArray(),
        db.daily.toArray(),
        db.reads.toArray(),
        db.notes.toArray(),
        db.gamify.get("state"),
      ]);
      await db.reviews.bulkPut(mergeReviews(curReviews, fileReviews));
      if (Array.isArray(data.daily)) await db.daily.bulkPut(mergeDaily(curDaily, data.daily));
      if (Array.isArray(data.reads)) await db.reads.bulkPut(mergeReads(curReads, data.reads));
      if (Array.isArray(data.notes)) await db.notes.bulkPut(mergeNotes(curNotes, data.notes));
      const fileGamify = data.gamify?.find((g) => g.key === "state");
      if (fileGamify) await db.gamify.put(mergeGamify(curGamify ?? { key: "state", xp: 0 }, fileGamify));
      // revlog: gộp theo (wordId, at) — nhập lại cùng backup không nhân đôi dòng; "đổi máy
      // không mất" (types.ts) phải đúng ở CẢ đường merge, không riêng replace.
      if (Array.isArray(data.revlog)) {
        const seen = new Set((await db.revlog.toArray()).map((r) => `${r.wordId}|${r.at}`));
        const fresh = data.revlog.filter((r) => !seen.has(`${r.wordId}|${r.at}`));
        if (fresh.length) await db.revlog.bulkAdd(fresh.map(({ id: _id, ...r }) => r));
      }
    }
    // Cài đặt không có mốc thời gian để so → tệp thắng ở cả hai chế độ (như trước).
    if (Array.isArray(data.config)) await db.config.bulkPut(data.config);
  });
  try {
    const mergeLocal = (k: string, ids: string[]) => {
      if (mode === "replace") return localStorage.setItem(k, JSON.stringify(ids));
      const cur = JSON.parse(localStorage.getItem(k) ?? "[]") as string[];
      localStorage.setItem(k, JSON.stringify(mergeIdSet(cur, ids)));
    };
    if (Array.isArray(data.phonics)) mergeLocal("en.phonicsDone", data.phonics);
    if (Array.isArray(data.grammar)) mergeLocal("en.grammarDone", data.grammar);
  } catch {
    /* bỏ qua */
  }
  invalidateProgressSummary();
  return { reviews: data.reviews.length, daily: data.daily?.length ?? 0 };
}

// ---- Tiến độ đọc (F6): bảng reads, có = đã đọc ----
const readActive = (r: ReadRow | undefined): boolean => !!r && (!r.removedAt || r.readAt > r.removedAt);
export async function markRead(id: string, read = true): Promise<void> {
  const now = new Date().toISOString();
  const cur = await db.reads.get(id);
  // KHÔNG được để key `removedAt: undefined` — IndexedDB nhận nhưng Firestore từ chối
  // ("Unsupported field value: undefined") và làm hỏng CẢ batch, chặn toàn bộ đồng bộ.
  if (read) await db.reads.put({ id, readAt: now, ...(cur?.removedAt ? { removedAt: cur.removedAt } : {}) });
  else if (cur) await db.reads.put({ ...cur, removedAt: now }); // tombstone — sync không "hồi sinh"
  invalidateProgressSummary();
}
export async function isRead(id: string): Promise<boolean> {
  return readActive(await db.reads.get(id));
}
export async function readIds(): Promise<Set<string>> {
  const rows = await db.reads.toArray();
  return new Set(rows.filter(readActive).map((r) => r.id));
}

/** Câu luyện thêm (sắp xếp câu / chọn giống): chỉ tính vào thống kê ngày, KHÔNG đổi lịch FSRS. */
export async function recordPractice(correct: boolean, now = new Date()): Promise<void> {
  const date = todayStr(now);
  await db.transaction("rw", db.daily, async () => {
    const d = (await db.daily.get(date)) ?? { date, reviews: 0, newCount: 0, again: 0 };
    d.reviews += 1;
    if (!correct) d.again += 1;
    await db.daily.put(d);
  });
  invalidateProgressSummary();
}
