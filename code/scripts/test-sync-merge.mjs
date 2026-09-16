// Unit test cho lib/sync-merge.ts — logic hợp nhất THUẦN, chạy thẳng bằng node (không cần trình duyệt).
// Chạy: node --experimental-strip-types scripts/test-sync-merge.mjs   (hoặc npm test)
import assert from "node:assert/strict";
import {
  reviewScore, mergeReviews, mergeDaily, mergeReads, mergeNotes, mergeIdSet, mergeStoryPos, readStamp,
  mergeGamify, sanitizeReviews, sanitizeDaily, sanitizeReads, sanitizeNotes, sanitizeStoryPos, sanitizeRemote,
  sanitizeConfig,
} from "../lib/sync-merge.ts";
import { DEFAULT_SRS_CONFIG } from "../lib/types.ts";

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

const rev = (wordId, reps, last_review) => ({
  wordId, level: 1, due: new Date("2026-09-01"), stability: 5, difficulty: 5,
  elapsed_days: 0, scheduled_days: 1, reps, lapses: 0, learning_steps: 0, state: 2,
  last_review: last_review ? new Date(last_review) : undefined, introducedOn: "2026-08-01",
});

// ---- reviews ----
t("reviews: nhiều lượt ôn hơn thì thắng", () => {
  const out = mergeReviews([rev("a", 5, "2026-08-01")], [rev("a", 2, "2026-08-30")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].reps, 5);
});

t("reviews: cùng số lượt thì bản ôn gần đây hơn thắng", () => {
  const out = mergeReviews([rev("a", 3, "2026-08-01")], [rev("a", 3, "2026-08-30")]);
  assert.equal(out[0].last_review.toISOString().slice(0, 10), "2026-08-30");
});

t("reviews: hợp nhất giữ thẻ chỉ có ở một bên", () => {
  const out = mergeReviews([rev("a", 1, "2026-08-01")], [rev("b", 1, "2026-08-01")]);
  assert.deepEqual(out.map((r) => r.wordId).sort(), ["a", "b"]);
});

t("reviews: giao hoán — đổi thứ tự cho kết quả như nhau", () => {
  const a = [rev("x", 4, "2026-08-10")], b = [rev("x", 9, "2026-08-02")];
  assert.equal(mergeReviews(a, b)[0].reps, mergeReviews(b, a)[0].reps);
});

t("reviews: idempotent — merge với chính nó không đổi", () => {
  const a = [rev("x", 4, "2026-08-10"), rev("y", 1, "2026-08-11")];
  assert.equal(mergeReviews(a, a).length, 2);
});

t("reviewScore: thẻ chưa ôn lần nào vẫn so sánh được", () => {
  const noReview = { ...rev("z", 0), last_review: undefined };
  assert.ok(Number.isFinite(reviewScore(noReview)));
});

// ---- daily ----
const day = (date, reviews, newCount = 0, again = 0) => ({ date, reviews, newCount, again });

t("daily: lấy MAX từng cột cho cùng một ngày", () => {
  const out = mergeDaily([day("2026-08-08", 10, 5, 2)], [day("2026-08-08", 7, 9, 1)]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { date: "2026-08-08", reviews: 10, newCount: 9, again: 2 });
});

t("daily: các ngày khác nhau đều được giữ", () => {
  const out = mergeDaily([day("2026-08-08", 3)], [day("2026-08-09", 4)]);
  assert.equal(out.length, 2);
});

t("daily: thiếu trường vẫn không NaN (bản ghi cũ)", () => {
  const out = mergeDaily([{ date: "2026-08-08", reviews: 5 }], [day("2026-08-08", 2, 1, 1)]);
  assert.equal(out[0].newCount, 1);
  assert.equal(out[0].again, 1);
});

// ---- reads ----
t("reads: bỏ đánh dấu SAU khi đọc thì thắng (tombstone)", () => {
  const read = { id: "s1", readAt: "2026-08-01T00:00:00Z" };
  const removed = { id: "s1", readAt: "2026-08-01T00:00:00Z", removedAt: "2026-08-05T00:00:00Z" };
  const out = mergeReads([read], [removed]);
  assert.equal(out[0].removedAt, "2026-08-05T00:00:00Z");
});

t("reads: đọc lại SAU khi bỏ đánh dấu thì thắng", () => {
  const removed = { id: "s1", readAt: "2026-08-01T00:00:00Z", removedAt: "2026-08-05T00:00:00Z" };
  const reread = { id: "s1", readAt: "2026-08-09T00:00:00Z" };
  const out = mergeReads([removed], [reread]);
  assert.equal(readStamp(out[0]), "2026-08-09T00:00:00Z");
});

// ---- notes ----
t("notes: máy sửa sau thắng", () => {
  const out = mergeNotes([{ wordId: "a", text: "cũ", at: 100 }], [{ wordId: "a", text: "mới", at: 200 }]);
  assert.equal(out[0].text, "mới");
});

t("notes: xoá (text rỗng) sau khi sửa vẫn thắng", () => {
  const out = mergeNotes([{ wordId: "a", text: "ghi chú", at: 100 }], [{ wordId: "a", text: "", at: 300 }]);
  assert.equal(out[0].text, "");
});

// ---- tập id ----
t("mergeIdSet: hợp và khử trùng", () => {
  assert.deepEqual(mergeIdSet(["a", "b"], ["b", "c"]).sort(), ["a", "b", "c"]);
});

t("mergeIdSet: chịu được undefined", () => {
  assert.deepEqual(mergeIdSet(undefined, ["a"]), ["a"]);
});

// ---- vị trí đọc truyện ----
t("storyPos: máy đọc sau thắng", () => {
  const out = mergeStoryPos({ s1: { ch: 2, at: 100 } }, { s1: { ch: 5, at: 200 } });
  assert.equal(out.s1.ch, 5);
});

t("storyPos: bản cũ hơn KHÔNG ghi đè bản mới", () => {
  const out = mergeStoryPos({ s1: { ch: 7, at: 900 } }, { s1: { ch: 1, at: 100 } });
  assert.equal(out.s1.ch, 7);
});

t("storyPos: truyện chỉ có ở một bên vẫn giữ", () => {
  const out = mergeStoryPos({ a: { ch: 1, at: 1 } }, { b: { ch: 2, at: 2 } });
  assert.deepEqual(Object.keys(out).sort(), ["a", "b"]);
});

t("storyPos: giao hoán", () => {
  const a = { s: { ch: 3, at: 500 } }, b = { s: { ch: 8, at: 400 } };
  assert.deepEqual(mergeStoryPos(a, b), mergeStoryPos(b, a));
});

t("storyPos: bỏ qua bản ghi hỏng", () => {
  const out = mergeStoryPos({ s: { ch: 2, at: 10 } }, { s: { ch: undefined, at: 99 } });
  assert.equal(out.s.ch, 2);
});

// ---- gamify ----
t("gamify: lấy bên lớn hơn, gộp ngày đóng băng", () => {
  const out = mergeGamify(
    { key: "state", xp: 10, freezes: 1, frozenDates: ["2026-08-01"], grantStreak: 7 },
    { key: "state", xp: 25, freezes: 3, frozenDates: ["2026-08-05"], grantStreak: 14 },
  );
  assert.equal(out.xp, 25);
  assert.equal(out.freezes, 3);
  assert.equal(out.grantStreak, 14);
  assert.deepEqual(out.frozenDates.sort(), ["2026-08-01", "2026-08-05"]);
});

t("gamify: maxCombo lấy max, questsDone union (2 máy cùng nhận 1 nhiệm vụ → 1 khoá)", () => {
  const out = mergeGamify(
    { key: "state", xp: 10, maxCombo: 25, questsDone: ["2026-08-20:on15", "2026-08-20:moi3"] },
    { key: "state", xp: 10, maxCombo: 40, questsDone: ["2026-08-20:on15", "2026-08-19:doc1"] },
  );
  assert.equal(out.maxCombo, 40);
  assert.deepEqual(out.questsDone.sort(), ["2026-08-19:doc1", "2026-08-20:moi3", "2026-08-20:on15"]);
  // máy cũ chưa có 2 field mới → không nổ, mặc định 0/rỗng
  const legacy = mergeGamify({ key: "state", xp: 5 }, { key: "state", xp: 7, maxCombo: 12 });
  assert.equal(legacy.maxCombo, 12);
  assert.deepEqual(legacy.questsDone, []);
});

// ---- LỌC dữ liệu kéo từ cloud ----
// Doc bị sửa tay / ghi bởi bản app cũ: một bản ghi hỏng đủ làm abort cả transaction Dexie
// (due là Invalid Date) → sync chết vĩnh viễn. Phải bỏ bản ghi hỏng, giữ phần còn lại.
t("lọc reviews: bỏ bản ghi thiếu wordId hoặc due hỏng, giữ bản ghi tốt", () => {
  const out = sanitizeReviews([
    { wordId: "decide", level: 1, due: "2026-09-01T00:00:00.000Z", reps: 3, introducedOn: "2026-08-01" },
    { wordId: "", due: "2026-09-01T00:00:00.000Z" },
    { wordId: "hỏng", due: "không phải ngày" },
    { wordId: "thiếu-due" },
    "không phải object",
    null,
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].wordId, "decide");
  assert.ok(out[0].due instanceof Date);
  assert.equal(out[0].reps, 3);
});

t("lọc reviews: số hỏng thành 0 thay vì NaN lọt vào FSRS", () => {
  const [r] = sanitizeReviews([
    { wordId: "x", due: "2026-09-01T00:00:00.000Z", stability: "nhiều", reps: null, level: undefined },
  ]);
  assert.equal(r.stability, 0);
  assert.equal(r.reps, 0);
  assert.equal(r.level, 0);
});

t("lọc reviews: last_review rỗng thì bỏ hẳn field (Firestore từ chối undefined)", () => {
  const [r] = sanitizeReviews([{ wordId: "x", due: "2026-09-01T00:00:00.000Z", last_review: null }]);
  assert.equal("last_review" in r, false);
});

t("lọc: chặn khoá __proto__ từ remote", () => {
  assert.deepEqual(sanitizeReviews([{ wordId: "__proto__", due: "2026-09-01T00:00:00.000Z" }]), []);
  assert.deepEqual(sanitizeNotes([{ wordId: "__proto__", text: "x" }]), []);
  assert.deepEqual(sanitizeStoryPos({ __proto__: { ch: 3 } }), {});
  assert.equal(Object.prototype.polluted, undefined);
});

t("lọc daily/reads/notes: bỏ bản ghi sai định dạng", () => {
  assert.deepEqual(sanitizeDaily([{ date: "2026-08-09", reviews: 3, newCount: 1, again: 0 }, { date: "hôm qua" }]), [
    { date: "2026-08-09", reviews: 3, newCount: 1, again: 0 },
  ]);
  assert.equal(sanitizeReads([{ id: "a", readAt: "2026-08-09" }, { id: "b" }, { readAt: "x" }]).length, 1);
  assert.equal(sanitizeNotes([{ wordId: "a", text: "mẹo", at: 5 }, { text: "không có id" }]).length, 1);
});

t("lọc notes: cắt mẹo nhớ quá dài", () => {
  const [n] = sanitizeNotes([{ wordId: "a", text: "x".repeat(5000) }]);
  assert.equal(n.text.length, 2000);
});

t("lọc: kiểu sai hoàn toàn (chuỗi/số thay vì mảng) không làm nổ", () => {
  assert.deepEqual(sanitizeReviews("hỏng"), []);
  assert.deepEqual(sanitizeDaily(42), []);
  assert.deepEqual(sanitizeReads(null), []);
  assert.deepEqual(sanitizeStoryPos("hỏng"), {});
});

t("sanitizeRemote: doc rác vẫn ra ảnh chụp hợp lệ dùng merge được", () => {
  const s = sanitizeRemote({ daily: "hỏng", xp: "nhiều", freeze: null, phonics: [1, "b1"], storyPos: 7 });
  assert.deepEqual(s.daily, []);
  assert.equal(s.xp, 0);
  assert.deepEqual(s.phonics, ["b1"]);
  assert.deepEqual(s.storyPos, {});
  assert.equal(s.gamify.freezes, 0);
});

t("lọc cài đặt: giá trị sai kiểu quay về giá trị đang dùng", () => {
  const cur = { ...DEFAULT_SRS_CONFIG, newPerDay: 7 };
  const out = sanitizeConfig({ newPerDay: "nhiều", direction: "xyz", spelling: "có", soundEnabled: "tắt" }, cur);
  assert.equal(out.newPerDay, 7);
  assert.equal(out.direction, cur.direction);
  assert.equal(out.spelling, cur.spelling);
  assert.equal(out.soundEnabled, true); // sai kiểu → giữ mặc định (bật)
});

t("lọc cài đặt: số bị kẹp vào khoảng hợp lệ, nhận giá trị hợp lệ", () => {
  const out = sanitizeConfig(
    {
      newPerDay: 99999,
      newLevel: -3,
      reviewPerSession: 30,
      direction: "vi2en",
      soundEnabled: false,
      clozePerWord: 99,
      interleave: false,
      sentenceKnownMin: 2,
    },
    DEFAULT_SRS_CONFIG,
  );
  assert.equal(out.newPerDay, 200);
  assert.equal(out.newLevel, 0);
  assert.equal(out.reviewPerSession, 30);
  assert.equal(out.direction, "vi2en");
  assert.equal(out.soundEnabled, false); // tắt âm thanh trên máy khác kéo về được
  assert.equal(out.clozePerWord, 5);
  assert.equal(out.interleave, false);
  assert.equal(out.sentenceKnownMin, 1);
});

t("config cloud cũ: clozeEnabled=false được chuyển thành 0 câu điền", () => {
  const out = sanitizeConfig({ clozeEnabled: false }, { ...DEFAULT_SRS_CONFIG, clozePerWord: 3 });
  assert.equal(out.clozeEnabled, false);
  assert.equal(out.clozePerWord, 0);
});

console.log(`sync-merge: ${pass} ca đạt${process.exitCode ? " (CÓ LỖI)" : ""}`);
