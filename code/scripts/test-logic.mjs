// Unit test cho logic thuần: chấm theo tốc độ (srs), chuỗi ngày (db), gamify (cấp bậc + huy hiệu).
// Chạy: node --experimental-strip-types scripts/test-logic.mjs   (hoặc npm test)
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ratingValueFromSpeed as ratingFromSpeed,
  isLeech,
  isMature,
  cardStage,
  computeStreak,
  seededShuffle,
  meaningTooSimilar,
  practiceScopeFilter,
  longestStreak as longestStreakPure,
  maxComebackGap,
  spreadSameWord,
  knownRatio,
  rankByKnown,
  selectDistinctExercises,
  optionMeaningMap,
} from "../lib/srs-pure.ts";
import { lookalikeScore } from "../lib/spell.ts";
import { LEVELS, FOUNDATION, levelSlug } from "../lib/levels.ts";
import {
  RANKS,
  rankForWords,
  badgeGroups,
  badgeTotals,
  CAMPAIGN_BADGES,
  XP,
  QUEST_POOL,
  dailyQuests,
  questProgress,
  pruneQuestKeys,
} from "../lib/gamify.ts";
import { gradeSpelling, normalizeSpelling, editDistance, isSpellCorrect } from "../lib/spell.ts";
import { questionMix, pickQuestionKind } from "../lib/question-mix.ts";
import { DEFAULT_SRS_CONFIG } from "../lib/types.ts";
import { elapsedDaysFor, isAheadEligible, pickAhead } from "../lib/srs-ahead.ts";
import { fsrs, generatorParameters, createEmptyCard, Rating, dateDiffInDays } from "ts-fsrs";

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

// ts-fsrs Rating: 1=Again 2=Hard 3=Good 4=Easy
const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

// ---- chấm theo tốc độ ----
t("sai → luôn Lại dù nhanh hay chậm", () => {
  assert.equal(ratingFromSpeed(false, 500), AGAIN);
  assert.equal(ratingFromSpeed(false, 60_000), AGAIN);
});

// Câu NHẬN-DIỆN (MCQ 4 phương án) KHÔNG BAO GIỜ được chấm Dễ — nhận ra đáp án không phải
// tự nhớ ra, và với nhớ-lại-trước thì đồng hồ chạy từ lúc hiện phương án nên "nhanh" là
// mặc định. Đúng-rất-nhanh trần là Được (xem comment dài trong srs-pure.ts).
t("MCQ: đúng RẤT NHANH cũng chỉ là Được, không bao giờ Dễ", () => {
  assert.equal(ratingFromSpeed(true, 100), GOOD);
  assert.equal(ratingFromSpeed(true, 2000), GOOD);
  assert.equal(ratingFromSpeed(true, 2000, "reverse"), GOOD);
  assert.equal(ratingFromSpeed(true, 1000, "cloze"), GOOD);
  assert.equal(ratingFromSpeed(true, 1000, "listen"), GOOD);
});
t("đúng + chậm → Khó", () => assert.equal(ratingFromSpeed(true, 10_000), HARD));
t("đúng + vừa → Được", () => assert.equal(ratingFromSpeed(true, 5000), GOOD));

t("rời máy (>45s) không bị phạt Khó mà tính Được", () => {
  assert.equal(ratingFromSpeed(true, 90_000), GOOD);
});

t("cloze/listen có ngưỡng CHẬM nới hơn câu thường", () => {
  assert.equal(ratingFromSpeed(true, 10_000, "cloze"), GOOD); // câu thường 10s là Khó
  assert.equal(ratingFromSpeed(true, 10_000, "listen"), GOOD);
  assert.equal(ratingFromSpeed(true, 15_000, "cloze"), HARD);
});

t("gõ chính tả là TỰ NHỚ RA → dạng duy nhất còn được chấm Dễ", () => {
  assert.equal(ratingFromSpeed(true, 7000, "spell"), EASY); // gõ đúng cả từ trong 8s = nhớ chủ động
  assert.equal(ratingFromSpeed(true, 12_000, "spell"), GOOD);
  assert.equal(ratingFromSpeed(true, 12_000), HARD); // đối chứng: cùng thời gian, dạng thường
  assert.equal(ratingFromSpeed(true, 22_000, "spell"), HARD); // chậm thật thì vẫn Khó
});

// ---- chữa nghĩa cho mọi phương án tiếng Anh (như HSK) ----
t("nghĩa chữa bài bám theo từ dù phương án bị xáo lại", () => {
  const words = [
    { id: "adapt", meaning_vi: "thích nghi; điều chỉnh" },
    { id: "adopt", meaning_vi: "nhận nuôi; áp dụng" },
    { id: "adjust", meaning_vi: "điều chỉnh; thích ứng" },
    { id: "admire", meaning_vi: "ngưỡng mộ; khâm phục" },
  ];
  const meanings = optionMeaningMap(words);
  for (const option of [...words].reverse())
    assert.equal(meanings[option.id], option.meaning_vi);
});

// ---- leech / mature ----
const card = (over) => ({ wordId: "x", level: 1, due: new Date(), stability: 1, difficulty: 5,
  elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, learning_steps: 0, state: 2,
  introducedOn: "2026-08-01", ...over });

t("thẻ quên nhiều lần là leech", () => {
  assert.equal(isLeech(card({ lapses: 4 })), true);
  assert.equal(isLeech(card({ lapses: 1 })), false);
  assert.equal(isLeech(null), false);
});

t("thẻ nhớ bền (stability ≥21) là mature", () => {
  assert.equal(isMature(card({ stability: 30 })), true);
  assert.equal(isMature(card({ stability: 10 })), false);
});

t("thẻ hay quên KHÔNG được coi là nhớ bền dù stability cao", () => {
  assert.equal(isMature(card({ stability: 60, lapses: 5 })), false);
});

// ---- chuỗi ngày ----
t("chuỗi liên tiếp kết thúc hôm nay", () => {
  assert.equal(computeStreak(["2026-08-06", "2026-08-07", "2026-08-08"], "2026-08-08"), 3);
});

t("chưa học hôm nay nhưng có hôm qua → chuỗi còn giữ", () => {
  assert.equal(computeStreak(["2026-08-06", "2026-08-07"], "2026-08-08"), 2);
});

t("nghỉ 2 ngày → chuỗi đứt", () => {
  assert.equal(computeStreak(["2026-08-01", "2026-08-02"], "2026-08-08"), 0);
});

t("chuỗi vắt qua ranh giới THÁNG", () => {
  assert.equal(computeStreak(["2026-07-30", "2026-07-31", "2026-08-01"], "2026-08-01"), 3);
});

t("chuỗi vắt qua ranh giới NĂM", () => {
  assert.equal(computeStreak(["2025-12-30", "2025-12-31", "2026-01-01"], "2026-01-01"), 3);
});

t("ngày trùng lặp không làm chuỗi phồng lên", () => {
  assert.equal(computeStreak(["2026-08-08", "2026-08-08", "2026-08-07"], "2026-08-08"), 2);
});

t("không có ngày nào → chuỗi 0", () => assert.equal(computeStreak([], "2026-08-08"), 0));

// ---- gamify: cấp bậc ----
t("bảng cấp bậc tăng dần theo ngưỡng từ", () => {
  for (let i = 1; i < RANKS.length; i++) {
    assert.ok(RANKS[i].minWords > RANKS[i - 1].minWords, `cấp ${i} không tăng`);
  }
});

t("cấp đầu bắt đầu từ 0 từ", () => assert.equal(RANKS[0].minWords, 0));

t("mỗi cấp có cả tên tiếng Anh và nghĩa Việt", () => {
  for (const r of RANKS) {
    assert.ok(r.en && r.vi, `thiếu tên: ${JSON.stringify(r)}`);
  }
});

t("người mới (0 từ) ở cấp thấp nhất", () => {
  const rp = rankForWords(0);
  assert.equal(rp.index, 0);
  assert.equal(rp.rank.en, RANKS[0].en);
});

t("đủ từ thì lên đúng cấp và báo còn thiếu bao nhiêu", () => {
  const rp = rankForWords(RANKS[1].minWords);
  assert.equal(rp.index, 1);
  assert.equal(rp.toNext, RANKS[2].minWords - RANKS[1].minWords);
});

t("vượt ngưỡng cao nhất → cấp cuối, không còn cấp kế", () => {
  const rp = rankForWords(RANKS[RANKS.length - 1].minWords + 5000);
  assert.equal(rp.index, RANKS.length - 1);
  assert.equal(rp.next, undefined);
  assert.equal(rp.progress, 1);
});

// ---- gamify: huy hiệu ----
const stats = (over) => ({ words: 0, xp: 0, streak: 0, reads: 0, reviews: 0, correct: 0,
  activeDays: 0, matured: 0, maxDayReviews: 0, weekend: false, byLevel: {},
  redeemedLeeches: 0, maxCombo: 0, longestStreak: 0, comebackDays: 0, perfectDay: false, ...over });

t("người mới chưa mở huy hiệu nào", () => {
  assert.equal(badgeTotals(stats({})).earned, 0);
});

t("học nhiều thì số huy hiệu mở tăng", () => {
  const few = badgeTotals(stats({ words: 20, xp: 200, reviews: 150 })).earned;
  const many = badgeTotals(stats({ words: 2000, xp: 20000, reviews: 8000, streak: 60 })).earned;
  assert.ok(many > few, `${many} phải > ${few}`);
});

t("tổng số huy hiệu không đổi theo tiến độ", () => {
  assert.equal(badgeTotals(stats({})).total, badgeTotals(stats({ words: 9999 })).total);
});

// Chỉ nhóm THEO BẬC mới cần ngưỡng tăng dần. Ngoại lệ có chủ đích:
//   campaign — mỗi cấp học một huy hiệu độc lập (B1 2000 · B2 2500 · C1 3000 · C2 2300)
//   special  — huy hiệu điều kiện riêng, không có ngưỡng số
const TIERED = (g) => g.group !== "campaign" && g.group !== "special";

t("ngưỡng huy hiệu trong mỗi nhóm theo bậc tăng dần", () => {
  for (const g of badgeGroups(stats({})).filter(TIERED)) {
    const tiers = g.badges.map((b) => b.threshold);
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(tiers[i] > tiers[i - 1], `nhóm ${g.name} ngưỡng không tăng`);
    }
  }
});

t("huy hiệu chiến dịch khớp 4 cấp học B1–C2", () => {
  assert.deepEqual(CAMPAIGN_BADGES.map((c) => c.cefr), ["B1", "B2", "C1", "C2"]);
});

t("XP: học từ mới đáng giá hơn ôn lại", () => {
  assert.ok(XP.newWord > XP.review && XP.review > XP.practice);
});

// ---- gõ chính tả ----
t("gõ chính tả: đúng y hệt", () => {
  assert.equal(gradeSpelling("decision", "decision"), "exact");
});

t("gõ chính tả: bỏ qua hoa/thường, khoảng trắng thừa, nháy cong", () => {
  assert.equal(gradeSpelling("  Decision ", "decision"), "exact");
  assert.equal(gradeSpelling("don’t", "don't"), "exact");
  assert.equal(gradeSpelling("give  up", "give up"), "exact");
});

t("gõ chính tả: lệch 1 ký tự vẫn tính đúng nhưng báo suýt", () => {
  for (const [typed, answer] of [["decison", "decision"], ["decisionn", "decision"], ["dicision", "decision"]]) {
    assert.equal(gradeSpelling(typed, answer), "close", `${typed} → ${answer}`);
    assert.equal(isSpellCorrect(gradeSpelling(typed, answer)), true);
  }
});

t("gõ chính tả: lệch từ 2 ký tự trở lên là sai", () => {
  assert.equal(gradeSpelling("desicion", "decision"), "wrong"); // đảo 2 chỗ
  assert.equal(gradeSpelling("decide", "decision"), "wrong");
  assert.equal(gradeSpelling("", "decision"), "wrong");
});

t("gõ chính tả: cụm đa từ", () => {
  assert.equal(gradeSpelling("give up", "give up"), "exact");
  assert.equal(gradeSpelling("give ups", "give up"), "close");
  assert.equal(gradeSpelling("get up", "give up"), "wrong");
});

t("khoảng cách sửa: dừng sớm khi vượt ngưỡng, không sai kết quả", () => {
  assert.equal(editDistance("abc", "abc", 1), 0);
  assert.equal(editDistance("abc", "abd", 1), 1);
  assert.ok(editDistance("abc", "xyz", 1) > 1);
  assert.ok(editDistance("a", "abcdef", 1) > 1);
});

t("chuẩn hoá: bỏ dấu câu cuối, giữ nháy trong từ", () => {
  assert.equal(normalizeSpelling("Don't!"), "don't");
  assert.equal(normalizeSpelling("hello."), "hello");
});

// ---- giai đoạn thẻ (ramp nhận diện → sản sinh) ----
t("cardStage: không có record / reps thấp → young; ≥3 lần hoặc bền ≥7 ngày → growing; ≥21 ngày → mature", () => {
  assert.equal(cardStage(undefined), "young");
  assert.equal(cardStage({ reps: 1, stability: 1, lapses: 0 }), "young");
  assert.equal(cardStage({ reps: 3, stability: 2, lapses: 0 }), "growing"); // đủ số lần
  assert.equal(cardStage({ reps: 1, stability: 7, lapses: 0 }), "growing"); // đủ độ bền
  assert.equal(cardStage({ reps: 9, stability: 30, lapses: 0 }), "mature");
  assert.equal(cardStage({ reps: 9, stability: 30, lapses: 4 }), "growing"); // leech không bao giờ mature
});

// ---- bật/tắt + tỉ trọng từng dạng câu hỏi theo giai đoạn ----
const cfg = (over) => ({ ...DEFAULT_SRS_CONFIG, ...over });
/** Mọi dạng có thể ra ở một giai đoạn, bằng cách quét đều rnd trên [0,1). */
const kinds = (over, stage = "mature") =>
  new Set(Array.from({ length: 200 }, (_, i) => pickQuestionKind(cfg(over), stage, i / 200)));

t("thẻ đã chín (mature): bài chính có gõ chính tả, nhớ lại, nghe; không trộn cloze", () => {
  const k = kinds({}, "mature");
  for (const want of ["spell", "recall", "listen"]) assert.ok(k.has(want), `thiếu ${want}`);
  assert.equal(k.has("cloze"), false);
});

t("thẻ non (young): bài chính có nhận diện + nhớ lại + nghe, CHƯA có gõ chính tả", () => {
  const k = kinds({}, "young");
  assert.equal(k.has("spell"), false);
  assert.equal(k.has("cloze"), false);
  assert.ok(k.has("recog") && k.has("recall") && k.has("listen"));
});

t("thẻ đang bền (growing): BẮT ĐẦU có gõ chính tả, vẫn có nhận diện + nhớ lại + nghe", () => {
  const k = kinds({}, "growing");
  assert.ok(k.has("spell"), "growing phải có gõ chính tả");
  assert.ok(k.has("recog") && k.has("recall") && k.has("listen"));
  assert.equal(k.has("cloze"), false);
});

t("tắt câu hỏi nghe → không còn dạng listen (mọi giai đoạn)", () => {
  for (const s of ["young", "growing", "mature"]) assert.equal(kinds({ listenEnabled: false }, s).has("listen"), false);
});

t("tắt ÂM THANH → không còn listen dù listenEnabled còn bật; dạng khác giữ nguyên (mọi giai đoạn)", () => {
  for (const s of ["young", "growing", "mature"]) {
    const k = kinds({ soundEnabled: false, listenEnabled: true }, s);
    assert.equal(k.has("listen"), false, `còn listen ở ${s}`);
    assert.ok(k.has("recall"), `mất dạng nhớ lại ở ${s}`);
  }
  // gõ chính tả vẫn ra: nhìn nghĩa Việt gõ từ, không cần tiếng
  assert.ok(kinds({ soundEnabled: false }, "mature").has("spell"));
  // trọng số còn lại y như khi tắt riêng câu hỏi nghe
  assert.equal(questionMix(cfg({ soundEnabled: false }), "mature").reduce((a, [, w]) => a + w, 0), 75);
});

t("điền câu luôn tách khỏi bộ bốc dạng của bài chính", () => {
  for (const s of ["young", "growing", "mature"]) {
    assert.equal(kinds({ clozeEnabled: true, clozePerWord: 5 }, s).has("cloze"), false);
  }
});

t("tắt gõ chính tả → không còn spell (growing lẫn mature)", () => {
  assert.equal(kinds({ spelling: false }, "mature").has("spell"), false);
  assert.equal(kinds({ spelling: false }, "growing").has("spell"), false);
});

t("tắt HẾT dạng phụ của bài chính, thẻ chín vẫn ôn được (chỉ còn nhớ lại)", () => {
  const k = kinds({ listenEnabled: false, spelling: false }, "mature");
  assert.deepEqual([...k], ["recall"]);
});

t("trọng số chuẩn hoá 100% ở mọi giai đoạn; tắt một dạng thì các dạng còn lại chia nhau đủ", () => {
  for (const s of ["young", "growing", "mature"]) {
    assert.equal(questionMix(cfg({}), s).reduce((a, [, w]) => a + w, 0), 100, `giai đoạn ${s}`);
  }
  const noListen = questionMix(cfg({ listenEnabled: false }), "mature").reduce((s, [, w]) => s + w, 0);
  assert.equal(noListen, 75);
  // vẫn bốc ra dạng hợp lệ ở hai đầu dải rnd
  for (const r of [0, 0.999]) assert.ok(questionMix(cfg({ listenEnabled: false }), "mature").some(([k]) => k === pickQuestionKind(cfg({ listenEnabled: false }), "mature", r)));
});

// ---- phiên 3 đợt: bài chính → điền → ghép, rồi xen kẽ giữa các từ ----
t("spreadSameWord: giãn cùng từ khi còn ứng viên khác mà không làm mất đợt", () => {
  const steps = ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"]
    .map((id) => ({ id, word: { id: id[0] } }));
  const out = spreadSameWord(steps, 2);
  assert.deepEqual(out.map((x) => x.id).sort(), steps.map((x) => x.id).sort());
  for (let i = 0; i < out.length; i++) {
    const recent = out.slice(Math.max(0, i - 2), i);
    assert.equal(recent.some((x) => x.word.id === out[i].word.id), false, `xếp sát tại ${i}`);
  }
});

t("knownRatio + rankByKnown: ưu tiên câu đạt ngưỡng, vẫn giữ câu dự phòng", () => {
  const learned = new Set(["school"]);
  const foundation = new Set(["the", "to"]);
  assert.equal(knownRatio(["the", "go", "to", "school"], learned, new Set(["go"]), foundation), 1);
  assert.equal(knownRatio(["go", "unknown"], learned, new Set(["go"]), foundation), 0.5);
  assert.deepEqual(rankByKnown(["medium", "easy", "hard"], (x) => ({ easy: 1, medium: 0.7, hard: 0.2 })[x], 0.8), ["easy", "medium", "hard"]);
});

t("selectDistinctExercises: điền và ghép lấy câu khác nhau khi còn lựa chọn", () => {
  const sentences = ["decision one", "decision two", "decision three"];
  const selected = selectDistinctExercises(sentences, (s) => s, () => true, () => true, 2, 1);
  assert.deepEqual(selected.clozeItems, sentences.slice(0, 2));
  assert.deepEqual(selected.arrangeItems, [sentences[2]]);

  const fallback = selectDistinctExercises(sentences.slice(0, 2), (s) => s, () => true, () => true, 2, 2);
  assert.deepEqual(fallback.arrangeItems, sentences.slice(0, 2));
});

// ---- xáo trộn tất định theo seed (xoay vòng ngữ cảnh) ----
t("seededShuffle: cùng seed → cùng thứ tự; khác seed → thứ tự khác; không mất phần tử", () => {
  const arr = Array.from({ length: 12 }, (_, i) => i);
  const a1 = seededShuffle(arr, "word:3");
  const a2 = seededShuffle(arr, "word:3");
  const b = seededShuffle(arr, "word:4");
  assert.deepEqual(a1, a2);
  assert.notDeepEqual(a1, b); // 12! hoán vị — trùng ngẫu nhiên coi như không xảy ra
  assert.deepEqual([...a1].sort((x, y) => x - y), arr);
  assert.notEqual(arr[0], undefined); // mảng gốc không bị sửa
  assert.deepEqual(arr, Array.from({ length: 12 }, (_, i) => i));
});

// ---- nghĩa na ná nhau (chặn phương án mập mờ) ----
t("meaningTooSimilar: bắt được nghĩa trùng nét, tha nghĩa khác hẳn", () => {
  assert.ok(meaningTooSimilar("yêu; thích", "sở thích; yêu thích"));
  assert.ok(meaningTooSimilar("to lớn", "lớn"));
  assert.ok(meaningTooSimilar("nhanh (tốc độ)", "nhanh chóng"));
  assert.equal(meaningTooSimilar("con mèo", "bệnh viện"), false);
  assert.equal(meaningTooSimilar("chạy", "ngồi"), false);
  // từ chức năng không được tính là "chung": "sự việc" vs "việc có" — không còn nét thực
  assert.equal(meaningTooSimilar("quả táo", "cái bàn"), false);
});

// ---- độ giống mặt chữ tiếng Anh (distractor giống chính tả) ----
t("lookalikeScore: affect/effect giống, cat/dog không; từ ngắn chỉ nhận lệch 1", () => {
  assert.ok(lookalikeScore("affect", "effect") > 0);
  assert.ok(lookalikeScore("adapt", "adopt") > 0);
  assert.ok(lookalikeScore("quite", "quiet") > 0);
  assert.equal(lookalikeScore("cat", "dog"), 0);
  assert.equal(lookalikeScore("word", "word"), 0); // chính nó → bỏ
  assert.equal(lookalikeScore("cat", "cart"), 2.5); // lệch 1, cùng chữ đầu, khác độ dài
  assert.equal(lookalikeScore("go", "gone"), 0); // lệch độ dài 2 ở từ 2 chữ → quá khác
  // lệch 1 điểm cao hơn lệch 2
  assert.ok(lookalikeScore("affect", "effect") > lookalikeScore("affect", "expect"));
});

// ---- phạm vi luyện tập tự do ----
t("practiceScopeFilter: all/hard/due/cấp hoạt động đúng", () => {
  const mk = (over) => ({ due: new Date("2026-08-19T08:00:00"), level: 1, lapses: 0, stability: 5, ...over });
  const now = new Date("2026-08-19T12:00:00");
  const recs = [
    mk({}), // đến hạn (due sáng nay), cấp 1
    mk({ due: new Date("2026-09-01"), level: 2, lapses: 3, stability: 5 }), // hay quên, chưa đến hạn
    mk({ due: new Date("2026-09-01"), level: 2, lapses: 3, stability: 30 }), // lapses cao nhưng ĐÃ bền → không còn hay quên
    mk({ due: new Date("2026-08-19T23:00:00"), level: 3 }), // đến hạn TỐI nay — vẫn tính hôm nay
  ];
  assert.equal(practiceScopeFilter(recs, "all", now).length, 4);
  assert.equal(practiceScopeFilter(recs, "hard", now).length, 1);
  assert.equal(practiceScopeFilter(recs, "due", now).length, 2);
  assert.equal(practiceScopeFilter(recs, 2, now).length, 2);
});

// ---- huy hiệu mới: năng lực + kỷ lục + tái xuất ----
t("nhóm Săn Kraken / Loạt pháo / Viễn dương mở theo metric tương ứng", () => {
  const g = (s, key) => badgeGroups(s).find((x) => x.group === key);
  assert.equal(g(stats({}), "kraken").earned, 0);
  assert.ok(g(stats({ redeemedLeeches: 5 }), "kraken").earned >= 2); // ngưỡng 1 và 5
  assert.ok(g(stats({ maxCombo: 20 }), "combo").earned >= 2);
  assert.ok(g(stats({ longestStreak: 30 }), "voyage").earned >= 3); // 7, 14, 30
});

t("huy hiệu tái xuất: nghỉ ≥3 ngày rồi quay lại; Trở về từ bão cần ≥14", () => {
  const sp = (s) => badgeGroups(s).find((g) => g.group === "special").badges;
  const none = sp(stats({ comebackDays: 2 }));
  assert.equal(none.find((b) => b.id === "sp-comeback").earned, false);
  const back = sp(stats({ comebackDays: 5 }));
  assert.equal(back.find((b) => b.id === "sp-comeback").earned, true);
  assert.equal(back.find((b) => b.id === "sp-storm").earned, false);
  assert.equal(sp(stats({ comebackDays: 20 })).find((b) => b.id === "sp-storm").earned, true);
  assert.equal(sp(stats({ perfectDay: true })).find((b) => b.id === "sp-flawless").earned, true);
});

// ---- chuỗi kỷ lục + quãng nghỉ (srs-pure) ----
t("longestStreak: kỷ lục không phụ thuộc chuỗi hiện tại; maxComebackGap đo quãng nghỉ", () => {
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-01-11"];
  assert.equal(longestStreakPure(dates), 3);
  assert.equal(maxComebackGap(dates), 6); // 03 → 10 là nghỉ 6 ngày rồi quay lại
  assert.equal(maxComebackGap(["2026-01-01"]), 0);
  assert.equal(longestStreakPure([]), 0);
});

// ---- nhiệm vụ ngày ----
t("dailyQuests: tất định theo ngày, đúng 3 nhiệm vụ, không trùng metric", () => {
  for (const d of ["2026-08-20", "2026-08-21", "2026-08-22", "2026-12-31"]) {
    const a = dailyQuests(d);
    const b = dailyQuests(d);
    assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id), `không tất định ở ${d}`);
    assert.equal(a.length, 3);
    assert.equal(new Set(a.map((q) => q.metric)).size, 3, `trùng metric ở ${d}`);
  }
  // hai ngày khác nhau phải có ít nhất một bộ khác nhau (quét 10 ngày)
  const sets = new Set(
    Array.from({ length: 10 }, (_, i) => dailyQuests(`2026-09-${String(i + 1).padStart(2, "0")}`).map((q) => q.id).join(",")),
  );
  assert.ok(sets.size > 1, "10 ngày ra cùng một bộ nhiệm vụ");
});

t("questProgress: đếm thường theo ngưỡng; accuracy cần ≥10 lượt", () => {
  const m = (over) => ({ reviews: 0, newCount: 0, correct: 0, again: 0, reads: 0, ...over });
  const on15 = QUEST_POOL.find((q) => q.id === "on15");
  assert.equal(questProgress(on15, m({ reviews: 14 })).done, false);
  assert.equal(questProgress(on15, m({ reviews: 15 })).done, true);
  const sac = QUEST_POOL.find((q) => q.id === "sac90");
  assert.equal(questProgress(sac, m({ reviews: 9, correct: 9 })).done, false); // chưa đủ 10 lượt
  assert.equal(questProgress(sac, m({ reviews: 10, correct: 9 })).done, true); // 90%
  assert.equal(questProgress(sac, m({ reviews: 10, correct: 8 })).done, false); // 80%
});

t("pruneQuestKeys: giữ 14 ngày gần nhất, bỏ khoá hỏng", () => {
  const keys = ["2026-08-20:on15", "2026-08-01:doc1", "rác", "2026-08-10:moi3"];
  assert.deepEqual(pruneQuestKeys(keys, "2026-08-20"), ["2026-08-20:on15", "2026-08-10:moi3"]);
});

// ---- LEVELS.words phải khớp dữ liệu thật (nếu lệch, thanh tiến độ hiện sai "x/y") ----
t("số từ mỗi cấp trong lib/levels.ts khớp public/data/words/*.json", () => {
  const dir = join(import.meta.dirname, "..", "public", "data", "words");
  for (const l of [...LEVELS, FOUNDATION]) {
    const file = join(dir, `${levelSlug(l.level)}.json`);
    if (!existsSync(file)) continue; // cấp chưa có dữ liệu (làm dần) — bỏ qua
    const real = JSON.parse(readFileSync(file, "utf8")).length;
    assert.equal(l.words, real, `${l.cefr}: levels.ts ghi ${l.words} nhưng data có ${real} từ`);
  }
});

// ---- ÔN SỚM (ahead): lọc + xếp thuần (lib/srs-ahead.ts) ----
// Scheduler thật của ts-fsrs với learning steps như app — để "đi hết các bước" là thật, không giả lập.
const FA = fsrs(generatorParameters({
  request_retention: 0.97, maximum_interval: 120, learning_steps: ["1m", "10m", "1h", "12h"],
  relearning_steps: ["10m", "1h"], enable_fuzz: true, enable_short_term: true,
}));
const curve = (t, s) => FA.forgetting_curve(t, s);
const NOW = new Date("2026-09-09T13:00:00Z"); // 20h giờ VN
const ac = (over) => ({ wordId: "w", level: 1, due: new Date("2026-09-15T13:00:00Z"), stability: 10, difficulty: 5,
  elapsed_days: 3, scheduled_days: 9, reps: 4, lapses: 0, learning_steps: 0, state: 2,
  last_review: new Date("2026-09-06T13:00:00Z"), introducedOn: "2026-08-01", ...over });
const noShuffle = () => 1 - 1e-9; // j = i → xáo là phép đồng nhất, để test thứ tự
// RNG tất định (mulberry32) cho các test rút ngẫu nhiên
const mulberry = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };

t("ôn sớm: loại thẻ ĐANG HỌC (Learning/Relearning); Review và bản ghi cũ thiếu state vẫn được", () => {
  assert.equal(isAheadEligible(ac({ state: 1, due: new Date("2026-09-09T14:00:00Z") }), NOW), false);
  assert.equal(isAheadEligible(ac({ state: 3, due: new Date("2026-09-09T14:00:00Z") }), NOW), false);
  assert.equal(isAheadEligible(ac({ state: 2 }), NOW), true);
  assert.equal(isAheadEligible(ac({ state: undefined }), NOW), true); // không đòi state === Review
  assert.equal(isAheadEligible(ac({ due: new Date("2026-09-09T12:00:00Z") }), NOW), false); // đã tới hạn → phiên đến hạn lo
});

t("ôn sớm: loại thẻ ĐÃ ÔN trong ngày; ôn hôm qua thì được", () => {
  assert.equal(isAheadEligible(ac({ last_review: new Date("2026-09-09T08:00:00Z") }), NOW), false);
  assert.equal(isAheadEligible(ac({ last_review: new Date("2026-09-08T23:00:00Z") }), NOW), true);
});

t("ôn sớm: ranh giới ngày theo ĐÚNG scheduler (ngày UTC = 7h sáng VN), khớp dateDiffInDays", () => {
  const lr = new Date("2026-09-09T16:59:00Z"); // 23:59 VN ngày 9/9
  const before7am = new Date("2026-09-09T23:59:00Z"); // 06:59 VN ngày 10/9 — vẫn cùng ngày UTC
  const after7am = new Date("2026-09-10T00:01:00Z"); // 07:01 VN ngày 10/9 — ngày UTC mới
  const rec = ac({ last_review: lr, due: new Date("2026-09-20T00:00:00Z") });
  assert.equal(elapsedDaysFor(rec, before7am), dateDiffInDays(lr, before7am));
  assert.equal(elapsedDaysFor(rec, before7am), 0);
  assert.equal(isAheadEligible(rec, before7am), false);
  assert.equal(elapsedDaysFor(rec, after7am), 1);
  assert.equal(isAheadEligible(rec, after7am), true);
});

t("ôn sớm: thiếu last_review không lỗi — ước ngày trôi từ due & scheduled_days, tối thiểu 1", () => {
  const r1 = ac({ last_review: undefined, due: new Date("2026-09-12T13:00:00Z"), scheduled_days: 10 }); // còn 3 ngày → trôi 7
  assert.equal(elapsedDaysFor(r1, NOW), 7);
  assert.equal(isAheadEligible(r1, NOW), true);
  const r2 = ac({ last_review: undefined, due: new Date("2026-09-10T13:00:00Z"), scheduled_days: 1 }); // 1-1=0 → kẹp 1
  assert.equal(elapsedDaysFor(r2, NOW), 1);
  assert.equal(isAheadEligible(r2, NOW), true);
  assert.doesNotThrow(() => pickAhead([r1, r2, ac({ last_review: undefined, scheduled_days: undefined })], NOW, 5, curve));
});

t("ôn sớm: xếp theo khả năng nhớ TĂNG dần (sắp quên nhất trước), không theo due", () => {
  const weak = ac({ wordId: "weak", stability: 2, last_review: new Date("2026-09-08T13:00:00Z"), due: new Date("2026-09-30T00:00:00Z") }); // R thấp, due xa
  const mid = ac({ wordId: "mid", stability: 10, last_review: new Date("2026-09-05T13:00:00Z"), due: new Date("2026-09-11T00:00:00Z") }); // t/S = 0.4 (weak = 0.5)
  const strong = ac({ wordId: "strong", stability: 60, last_review: new Date("2026-09-08T13:00:00Z"), due: new Date("2026-09-10T00:00:00Z") }); // R cao, due gần nhất
  const out = pickAhead([strong, mid, weak], NOW, 3, curve, noShuffle, 1);
  assert.deepEqual(out.map((r) => r.wordId), ["weak", "mid", "strong"]);
  const R = (r) => curve(elapsedDaysFor(r, NOW), r.stability);
  assert.ok(R(weak) < R(mid) && R(mid) < R(strong));
});

t("ôn sớm: ba lượt liên tiếp (chấm thật bằng ts-fsrs) không lặp thẻ, không có thẻ đang học", () => {
  const recs = [];
  // 30 thẻ đang học (vừa học tối nay): New → Good → Learning, hẹn 10 phút
  for (let i = 0; i < 30; i++) recs.push({ wordId: `L${i}`, ...FA.next(createEmptyCard(NOW), NOW, Rating.Good).card });
  // 90 thẻ Review ôn lần cuối 1–9 ngày trước, chưa tới hạn
  for (let i = 0; i < 90; i++) {
    const lr = new Date(NOW.getTime() - (1 + (i % 9)) * 86400000);
    recs.push(ac({ wordId: `R${i}`, stability: 5 + (i % 7) * 4, last_review: lr, due: new Date(NOW.getTime() + (1 + (i % 5)) * 86400000) }));
  }
  const rnd = mulberry(7);
  const seen = new Set();
  let now = NOW;
  for (let round = 0; round < 3; round++) {
    const picked = pickAhead(recs, now, 20, curve, rnd);
    assert.equal(picked.length, 20, `lượt ${round + 1} thiếu thẻ`);
    for (const r of picked) {
      assert.ok(!seen.has(r.wordId), `lặp thẻ ${r.wordId} ở lượt ${round + 1}`);
      assert.ok(r.state !== 1 && r.state !== 3, `thẻ đang học ${r.wordId} lọt lượt ${round + 1}`);
      seen.add(r.wordId);
      // chấm Good thật → last_review = now (cùng ngày UTC) → lượt sau tự loại
      Object.assign(r, FA.next(r, now, Rating.Good).card);
    }
    now = new Date(now.getTime() + 5 * 60000);
  }
  assert.equal(seen.size, 60);
});

t("ôn sớm: rút ngẫu nhiên không ra ngoài nhóm GẤP ĐÔI có R thấp nhất; đủ số, không trùng", () => {
  // 100 thẻ R khác nhau hẳn (stability tăng dần, cùng ngày trôi)
  const recs = Array.from({ length: 100 }, (_, i) => ac({ wordId: `c${i}`, stability: 1 + i * 0.5 }));
  const ranked = [...recs].sort((a, b) => curve(elapsedDaysFor(a, NOW), a.stability) - curve(elapsedDaysFor(b, NOW), b.stability));
  const top20 = new Set(ranked.slice(0, 20).map((r) => r.wordId));
  for (const seed of [1, 2, 3, 42, 2026]) {
    const out = pickAhead(recs, NOW, 10, curve, mulberry(seed));
    assert.equal(out.length, 10);
    assert.equal(new Set(out.map((r) => r.wordId)).size, 10);
    for (const r of out) assert.ok(top20.has(r.wordId), `seed ${seed}: ${r.wordId} ngoài nhóm 20 sắp quên nhất`);
  }
  // các seed khác nhau phải cho ít nhất một bộ khác (đúng là có rút ngẫu nhiên)
  const sets = new Set([1, 2, 3].map((s) => pickAhead(recs, NOW, 10, curve, mulberry(s)).map((r) => r.wordId).sort().join(",")));
  assert.ok(sets.size > 1);
  assert.deepEqual(pickAhead(recs, NOW, 0, curve), []);
  assert.equal(pickAhead(recs.slice(0, 4), NOW, 20, curve).length, 4); // ít hơn limit → trả hết
});

console.log(`logic: ${pass} ca đạt${process.exitCode ? " (CÓ LỖI)" : ""}`);
