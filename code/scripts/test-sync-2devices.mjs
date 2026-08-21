// Nghiệm thu ĐỒNG BỘ 2 THIẾT BỊ (DoD của E7) mà không cần đăng nhập thật.
// Mô phỏng 2 máy + 1 "Firestore" trong bộ nhớ, chạy ĐÚNG giao thức của lib/sync-data.ts:
//   fingerprint local → đọc 1 doc user → remote đổi? kéo chunks → merge → local đổi? ghi lên
// Toàn bộ phần quyết định (fingerprint/fpEq) và hợp nhất (mergeSnapshots) là code THẬT của app
// (lib/sync-merge.ts); chỉ tầng I/O Firestore là giả. Phần I/O thật vẫn phải nghiệm thu tay
// bằng 2 thiết bị đăng nhập cùng tài khoản — xem DEPLOY.md.
// Chạy: node --experimental-strip-types scripts/test-sync-2devices.mjs   (hoặc npm test)
import assert from "node:assert/strict";
import { fingerprint, fpEq, mergeSnapshots, pruneUndefined } from "../lib/sync-merge.ts";

// lib/sync-status đọc/ghi localStorage → dựng bản giả TRƯỚC khi import (module đọc lúc chạy hàm).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const { setSyncOk, setSyncError, getSyncStatus, isStale } = await import("../lib/sync-status.ts");

let pass = 0;
const t = (name, fn) => {
  try {
    fn();
    pass++;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
};

const rev = (wordId, reps, last_review, level = 1) => ({
  wordId, level, due: new Date("2026-09-01"), stability: 5, difficulty: 5,
  elapsed_days: 0, scheduled_days: 1, reps, lapses: 0, learning_steps: 0, state: 2,
  last_review: new Date(last_review), introducedOn: "2026-08-01",
});
const emptySnapshot = () => ({
  reviews: [], daily: [], reads: [], notes: [], xp: 0,
  phonics: [], grammar: [], storyPos: {}, gamify: { key: "state", xp: 0 },
});

/** "Firestore" trong bộ nhớ: 1 doc user + các chunk reviews (đúng mô hình app dùng). */
class Cloud {
  constructor() {
    this.doc = null;
    this.chunks = [];
    this.reads = 0; // đếm lượt đọc để chứng minh "không đổi thì chỉ tốn 1 getDoc"
    this.chunkReads = 0;
    this.offline = false;
  }
  getUserDoc() {
    if (this.offline) throw new Error("network");
    this.reads++;
    return this.doc;
  }
  getChunks() {
    if (this.offline) throw new Error("network");
    this.chunkReads++;
    return this.chunks.flat();
  }
  write(snapshot, updatedAt, chunkSize = 1500) {
    if (this.offline) throw new Error("network");
    // Firestore từ chối field `undefined` và làm hỏng CẢ batch → mô phỏng đúng hành vi đó,
    // nếu không thì lỗi kiểu "reads[].removedAt: undefined" chỉ lộ ra trên production.
    const bad = (v, path = "") => {
      if (v === undefined) return path || "(root)";
      if (Array.isArray(v)) return v.map((x, i) => bad(x, `${path}[${i}]`)).find(Boolean) ?? null;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        for (const [k, x] of Object.entries(v)) {
          const hit = bad(x, path ? `${path}.${k}` : k);
          if (hit) return hit;
        }
      }
      return null;
    };
    const offending = bad({ ...snapshot, updatedAt });
    if (offending) throw new Error(`Unsupported field value: undefined (found in ${offending})`);
    this.chunks = [];
    for (let i = 0; i < snapshot.reviews.length; i += chunkSize) {
      this.chunks.push(snapshot.reviews.slice(i, i + chunkSize));
    }
    this.doc = { ...snapshot, reviews: undefined, updatedAt };
  }
}

/** Một thiết bị: dữ liệu local + syncState riêng (localStorage của máy đó). */
class Device {
  constructor(name, cloud, clock) {
    this.name = name;
    this.cloud = cloud;
    this.clock = clock;
    this.local = emptySnapshot();
    this.state = null; // { remoteUpdatedAt, fp }
    this.cfgStamp = "";
    this.status = { lastOk: null, error: null, failCount: 0 };
  }
  storyStamp() {
    const all = Object.values(this.local.storyPos);
    return `${all.length}|${Math.max(0, ...all.map((p) => p.at ?? 0))}`;
  }
  fp(snapshot = this.local) {
    return fingerprint(snapshot, this.cfgStamp, this.storyStamp());
  }
  /**
   * Đúng luồng syncNow(): trả { skipped, pulled } để test soi được quyết định.
   * `duringNetwork` mô phỏng người dùng TRẢ LỜI THÊM trong lúc sync còn đang chờ mạng —
   * đúng cửa sổ mà bản cũ ghi đè mất dữ liệu.
   */
  sync({ duringNetwork } = {}) {
    try {
      const before = this.local; // ảnh chụp đầu hàm (syncNow đọc Dexie ở đây)
      const localFp = this.fp(before);
      const doc = this.cloud.getUserDoc();
      const remoteUpdatedAt = doc?.updatedAt ?? "";
      const remoteChanged = !this.state || this.state.remoteUpdatedAt !== remoteUpdatedAt;
      const localChanged = !this.state || !fpEq(this.state.fp, localFp);

      if (!remoteChanged && !localChanged) {
        this.status = { lastOk: this.clock.now(), error: null, failCount: 0 };
        return { skipped: true, pulled: false };
      }

      let merged = before;
      if (remoteChanged) {
        const remote = { ...emptySnapshot(), ...(doc ?? {}), reviews: this.cloud.getChunks() };
        merged = mergeSnapshots(before, remote);
        if (duringNetwork) duringNetwork(); // vài giây đi mạng đã trôi qua
        // Ghi local: merge TIẾP với trạng thái hiện tại thay vì bulkPut thẳng `merged`
        // (lib/sync-data.ts đọc lại ngay trong transaction đúng như vậy).
        this.local = mergeSnapshots(this.local, merged);
      } else if (duringNetwork) {
        duringNetwork();
      }
      let finalUpdatedAt = remoteUpdatedAt;
      if (localChanged || !doc) {
        finalUpdatedAt = this.clock.tick();
        this.cloud.write(merged, finalUpdatedAt);
      }
      this.state = { remoteUpdatedAt: finalUpdatedAt, fp: this.fp(merged) };
      this.status = { lastOk: this.clock.now(), error: null, failCount: 0 };
      return { skipped: false, pulled: remoteChanged };
    } catch (e) {
      // S6: hỏng thì phải để lại dấu vết cho UI, không im lặng
      this.status = { lastOk: this.status.lastOk, error: String(e.message), failCount: this.status.failCount + 1 };
      throw e;
    }
  }
}

const makeWorld = () => {
  let n = 0;
  const clock = {
    now: () => new Date(1_800_000_000_000 + n * 1000).toISOString(),
    tick: () => {
      n++;
      return clock.now();
    },
  };
  const cloud = new Cloud();
  return { cloud, clock, a: new Device("A", cloud, clock), b: new Device("B", cloud, clock) };
};

// ---- kịch bản 1: máy mới nhận đủ tiến độ của máy cũ ----
t("2 máy: học trên A → B đăng nhập lần đầu nhận đủ thẻ", () => {
  const { a, b } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z"), rev("give up", 1, "2026-08-09T08:05:00Z")];
  a.local.daily = [{ date: "2026-08-09", reviews: 2, newCount: 2, again: 0 }];
  a.local.xp = 20;
  a.sync();

  const res = b.sync();
  assert.equal(res.pulled, true);
  assert.deepEqual(b.local.reviews.map((r) => r.wordId).sort(), ["decide", "give up"]);
  assert.equal(b.local.xp, 20);
});

// ---- kịch bản 2 (S2): vị trí đọc theo máy đọc sau cùng ----
t("2 máy: đọc dở trên B → A thấy đúng chương (LWW theo mốc thời gian)", () => {
  const { a, b } = makeWorld();
  a.local.storyPos = { "b1-story-1": { ch: 1, at: 1000 } };
  a.sync();
  b.sync();

  b.local.storyPos = { "b1-story-1": { ch: 5, at: 2000 } }; // B đọc tiếp tới chương 5
  b.sync();

  a.sync(); // A quay lại app → pull
  assert.equal(a.local.storyPos["b1-story-1"].ch, 5);
});

t("2 máy: chương CŨ hơn không ghi đè chương mới", () => {
  const { a, b } = makeWorld();
  a.local.storyPos = { s1: { ch: 9, at: 5000 } };
  a.sync();
  b.local.storyPos = { s1: { ch: 2, at: 1000 } }; // B đọc trước đó, sync muộn
  b.sync();
  a.sync();
  assert.equal(a.local.storyPos.s1.ch, 9);
});

// ---- kịch bản 3 (S3): quay lại app thì kéo về, không đổi thì không tốn gì ----
t("2 máy: A quay lại app sau khi B ôn → kéo được tiến độ mới", () => {
  const { a, b, cloud } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z")];
  a.sync();
  b.sync();

  b.local.reviews = [rev("decide", 4, "2026-08-09T20:00:00Z")]; // B ôn thêm 3 lượt
  b.sync();

  const before = cloud.chunkReads;
  const res = a.sync();
  assert.equal(res.pulled, true, "phải kéo vì remote đã đổi");
  assert.equal(cloud.chunkReads, before + 1);
  assert.equal(a.local.reviews[0].reps, 4);
});

t("không đổi gì → sync bỏ qua, chỉ tốn 1 lượt đọc doc, không đụng chunk", () => {
  const { a, cloud } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z")];
  a.sync();
  const chunkReads = cloud.chunkReads;
  const docReads = cloud.reads;

  const res = a.sync();
  assert.equal(res.skipped, true);
  assert.equal(cloud.chunkReads, chunkReads, "không được đọc chunk");
  assert.equal(cloud.reads, docReads + 1, "chỉ đúng 1 getDoc");
});

// ---- kịch bản 3b: TRẢ LỜI GIỮA LÚC ĐANG SYNC (race làm mất dữ liệu ở bản cũ) ----
// Bản cũ: syncNow đọc snapshot → đi mạng vài giây → bulkPut đè thẳng kết quả merge, nên mọi
// thẻ trả lời trong khoảng đó bị ghi đè mất, và fingerprint lưu sau đó lại KHỚP nên lần sync
// kế coi như "không có gì mới" → mất vĩnh viễn.
t("trả lời thêm thẻ trong lúc sync chờ mạng → không bị ghi đè mất", () => {
  const { a, b } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z")];
  a.sync();
  b.sync();
  b.local.reviews = [rev("decide", 2, "2026-08-09T12:00:00Z")]; // B ôn → remote đổi
  b.sync();

  // A sync (phải kéo remote về). Giữa lúc chờ mạng, người dùng trả lời tiếp trên A.
  a.sync({
    duringNetwork: () => {
      a.local.reviews = [
        rev("decide", 3, "2026-08-09T13:00:00Z"), // ôn tiếp thẻ cũ
        rev("achieve", 1, "2026-08-09T13:00:30Z"), // học thêm thẻ mới
      ];
      a.local.daily = [{ date: "2026-08-09", reviews: 2, newCount: 1, again: 0 }];
      a.local.xp = 25;
    },
  });

  const byId = new Map(a.local.reviews.map((r) => [r.wordId, r]));
  assert.equal(a.local.reviews.length, 2, "thẻ vừa học không được biến mất");
  assert.equal(byId.get("decide").reps, 3, "lượt ôn vừa xong không được lùi lại");
  assert.equal(byId.get("achieve").reps, 1);
  assert.equal(a.local.xp, 25);
});

t("thẻ trả lời giữa lúc sync được đẩy lên cloud ở lượt sync kế", () => {
  const { a, b } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z")];
  a.sync();
  b.sync();
  b.local.reviews = [rev("decide", 2, "2026-08-09T12:00:00Z")];
  b.sync();

  a.sync({
    duringNetwork: () => {
      a.local.reviews = [...a.local.reviews, rev("achieve", 1, "2026-08-09T13:00:00Z")];
    },
  });
  // Fingerprint đã lưu là của bản ĐẨY LÊN, không phải bản local sau khi merge lại → lượt sau
  // vẫn nhận ra local có thay đổi và đẩy tiếp.
  const res = a.sync();
  assert.equal(res.skipped, false, "không được coi là 'không có gì mới'");

  b.sync();
  assert.ok(b.local.reviews.some((r) => r.wordId === "achieve"), "máy kia phải nhận được thẻ đó");
});

// ---- kịch bản 4: hai máy cùng sửa, hội tụ về một trạng thái ----
t("2 máy sửa song song rồi sync lần lượt → hội tụ, không mất thẻ nào", () => {
  const { a, b } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z")];
  a.sync();
  b.sync();

  a.local.reviews = [rev("decide", 3, "2026-08-09T10:00:00Z")];
  b.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z"), rev("look after", 1, "2026-08-09T09:00:00Z")];
  a.sync();
  b.sync(); // B kéo về + đẩy lên
  a.sync(); // A kéo phần của B

  const ids = (d) => d.local.reviews.map((r) => r.wordId).sort();
  assert.deepEqual(ids(a), ids(b));
  assert.deepEqual(ids(a), ["decide", "look after"]);
  assert.equal(a.local.reviews.find((r) => r.wordId === "decide").reps, 3, "bản ôn nhiều lượt hơn thắng");
});

t("mẹo nhớ xoá trên B (tombstone) phải xoá theo trên A", () => {
  const { a, b } = makeWorld();
  a.local.notes = [{ wordId: "decide", text: "de-cide = cắt bỏ lựa chọn", at: 1000 }];
  a.sync();
  b.sync();
  b.local.notes = [{ wordId: "decide", text: "", at: 2000 }];
  b.sync();
  a.sync();
  assert.equal(a.local.notes.find((n) => n.wordId === "decide").text, "");
});

t("bài đã đọc + bỏ đánh dấu: hành động sau cùng thắng trên cả 2 máy", () => {
  const { a, b } = makeWorld();
  a.local.reads = [{ id: "b1-001", readAt: "2026-08-09T08:00:00Z" }];
  a.sync();
  b.sync();
  b.local.reads = [{ id: "b1-001", readAt: "2026-08-09T08:00:00Z", removedAt: "2026-08-09T09:00:00Z" }];
  b.sync();
  a.sync();
  assert.equal(a.local.reads[0].removedAt, "2026-08-09T09:00:00Z");
});

t("XP + đóng băng chuỗi: lấy bên lớn hơn, ngày đóng băng gộp lại", () => {
  const { a, b } = makeWorld();
  a.local.xp = 120;
  a.local.gamify = { key: "state", xp: 120, freezes: 2, frozenDates: ["2026-08-01"], grantStreak: 3 };
  a.sync();
  // B chưa từng sync, đã tự tích XP offline → lần sync đầu phải hợp nhất chứ không đè
  b.local.xp = 80;
  b.local.gamify = { key: "state", xp: 80, freezes: 1, frozenDates: ["2026-08-05"], grantStreak: 7 };
  b.sync();
  assert.equal(b.local.xp, 120);
  assert.equal(b.local.gamify.freezes, 2);
  assert.equal(b.local.gamify.grantStreak, 7);
  assert.deepEqual(b.local.gamify.frozenDates.sort(), ["2026-08-01", "2026-08-05"]);
});

// ---- kịch bản 5 (S6): sync hỏng phải để lại dấu vết ----
t("mất mạng: sync ném lỗi và ghi trạng thái lỗi (không hỏng im lặng)", () => {
  const { a, cloud } = makeWorld();
  a.local.reviews = [rev("decide", 1, "2026-08-09T08:00:00Z")];
  a.sync();
  cloud.offline = true;
  a.local.reviews.push(rev("look after", 1, "2026-08-09T09:00:00Z"));
  assert.throws(() => a.sync());
  assert.equal(a.status.failCount, 1);
  assert.match(a.status.error, /network/);

  cloud.offline = false;
  a.sync(); // có mạng lại → tự lành, dữ liệu chưa lên vẫn còn nguyên ở local
  assert.equal(a.status.error, null);
  assert.equal(a.status.failCount, 0);
  assert.equal(cloud.chunks.flat().length, 2);
});

t("dữ liệu lớn cắt nhiều chunk vẫn ráp lại đủ ở máy kia", () => {
  const { a, b, cloud } = makeWorld();
  a.local.reviews = Array.from({ length: 3200 }, (_, i) => rev(`w${i}`, 1, "2026-08-09T08:00:00Z"));
  a.sync();
  assert.equal(cloud.chunks.length, 3, "3200 thẻ ÷ 1500 = 3 chunk");
  b.sync();
  assert.equal(b.local.reviews.length, 3200);
});

// ---- S6: trạng thái đồng bộ mà UI dùng để bật chấm đỏ ----
t("trạng thái sync: thành công thì xoá lỗi và đếm lại từ 0", () => {
  setSyncError("mất mạng");
  setSyncError("mất mạng");
  assert.equal(getSyncStatus().failCount, 2);
  setSyncOk(null, new Date("2026-08-09T10:00:00Z"));
  const s = getSyncStatus();
  assert.equal(s.error, null);
  assert.equal(s.failCount, 0);
  assert.equal(s.lastOk, "2026-08-09T10:00:00.000Z");
});

t("trạng thái sync: giữ số liệu đối chiếu giữa 2 máy (info)", () => {
  setSyncOk("12.597 thẻ · 40 bài đã đọc", new Date("2026-08-09T10:00:00Z"));
  const s = getSyncStatus();
  assert.equal(s.info, "12.597 thẻ · 40 bài đã đọc");
  assert.equal(s.error, null);
  // lỗi sau đó vẫn giữ lại info của lần đồng bộ gần nhất
  setSyncError("mất mạng");
  assert.equal(getSyncStatus().info, "12.597 thẻ · 40 bài đã đọc");
});

t("trạng thái sync: đang bình thường thì KHÔNG cảnh báo", () => {
  setSyncOk(null, new Date("2026-08-09T10:00:00Z"));
  assert.equal(isStale(getSyncStatus()), false);
});

t("trạng thái sync: hỏng liên tục nhưng mới hỏng thì chưa làm phiền", () => {
  setSyncOk(null, new Date("2026-08-09T10:00:00Z"));
  setSyncError("mất mạng");
  assert.equal(isStale(getSyncStatus(), 3, new Date("2026-08-09T12:00:00Z").getTime()), false);
});

t("trạng thái sync: hỏng và đã quá 3 ngày không sync được → cảnh báo", () => {
  setSyncOk(null, new Date("2026-08-01T10:00:00Z"));
  setSyncError("permission denied");
  assert.equal(isStale(getSyncStatus(), 3, new Date("2026-08-09T10:00:00Z").getTime()), true);
});

t("trạng thái sync: chưa từng sync được lần nào, hỏng ≥3 lần → cảnh báo", () => {
  // xét thẳng vị từ (getSyncStatus có cache snapshot trong module nên không reset bằng localStorage)
  assert.equal(isStale({ lastOk: null, error: "x", failCount: 2 }), false);
  assert.equal(isStale({ lastOk: null, error: "x", failCount: 3 }), true);
});

// ---- Firestore không nhận `undefined` ----
t("ghi cloud: field undefined làm hỏng cả batch (mô phỏng đúng Firestore)", () => {
  const { a } = makeWorld();
  a.local.reads = [{ id: "b1-001", readAt: "2026-08-09T08:00:00Z", removedAt: undefined }];
  assert.throws(() => a.sync(), /Unsupported field value: undefined/);
});

t("pruneUndefined: lọc sạch field rỗng, giữ nguyên phần còn lại", () => {
  const cleaned = pruneUndefined({
    reads: [{ id: "b1-001", readAt: "x", removedAt: undefined }],
    freeze: { freezes: 0, frozenDates: [], grantStreak: undefined },
    xp: 120,
  });
  assert.deepEqual(cleaned, { reads: [{ id: "b1-001", readAt: "x" }], freeze: { freezes: 0, frozenDates: [] }, xp: 120 });
});

t("pruneUndefined: giữ Date và giá trị null (Firestore nhận cả hai)", () => {
  const d = new Date("2026-08-09T08:00:00Z");
  const out = pruneUndefined({ due: d, last_review: null, nested: [{ a: undefined, b: 1 }] });
  assert.equal(out.due, d);
  assert.equal(out.last_review, null);
  assert.deepEqual(out.nested, [{ b: 1 }]);
});

t("ghi cloud: qua pruneUndefined thì đồng bộ được như thường", () => {
  const { a, b } = makeWorld();
  a.local.reads = [{ id: "b1-001", readAt: "2026-08-09T08:00:00Z", removedAt: undefined }];
  a.local = pruneUndefined(a.local);
  a.sync();
  b.sync();
  assert.deepEqual(b.local.reads.map((r) => r.id), ["b1-001"]);
});

console.log(`sync 2 thiết bị: ${pass} ca đạt`);
