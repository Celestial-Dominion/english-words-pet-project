// Unit test tooling học liệu: hình thái học tiếng Anh, tách từ, parser nguồn, hàm thuần Video.
// Chạy: node scripts/test-content.mjs  (nằm trong npm test)
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeSentence, analyzeWord, lemmaOf, ipaOf, profile, LEVEL_KEYS } from "./lib/en-vocab.mjs";
import { parseFile, parseProse, parseChapters, parseDialogue, splitPair, parseKv, parseQuizFile } from "./lib/content-format.mjs";
import { parseAnnotations } from "./lib/content-model.mjs";
import { checkQuizBlock, quoteFound, quotesOf } from "./lib/quiz-check.mjs";
import { quizScore, shuffledOrder, splitQuotes } from "../lib/quiz-pure.ts";
import { lineTokens, wordCount, lineIndexAt, wordAt, keyRanges, castOnStage, sceneAt } from "../lib/video.ts";

let pass = 0;
let fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else {
    fail++;
    console.log(`✗ ${name}\n    got  ${g}\n    want ${w}`);
  }
}
const lem = (w) => lemmaOf(w)?.lemma ?? null;
const lems = (w, names) => analyzeWord(w, { names }).map((r) => r.lemma);

// ---- hình thái học: không coi dạng biến hình là từ mới ----
eq("số nhiều -ies", lem("libraries"), "library");
eq("số nhiều -es", lem("boxes"), "box");
eq("quá khứ -ied", lem("studied"), "study");
eq("quá khứ gấp đôi phụ âm", lem("stopped"), "stop");
eq("-ing bỏ e", lem("making"), "make");
eq("-ing gấp đôi", lem("swimming"), "swimming"); // mục từ riêng trong bộ từ thắng
eq("so sánh -ier", lem("happier"), "happy");
eq("so sánh gấp đôi", lem("bigger"), "big");
eq("bất quy tắc", lem("went"), "go");
eq("bất quy tắc số nhiều", lem("children"), "child");
eq("phái sinh -ly", lemmaOf("carefully")?.how === "id" || lemmaOf("carefully")?.lemma === "careful", true);
eq("rút gọn n't", lems("couldn't"), ["could", "not"]);
eq("rút gọn 're", lems("they're"), ["they", "are"]);
eq("won't", lems("won't"), ["will", "not"]);
eq("sở hữu tên riêng", lems("Maria's", new Set(["maria"])), ["maria"]);
eq("gạch nối", lems("well-known").length >= 1, true);
eq("thán từ tự do", analyzeWord("wow")[0].how, "free");

// ---- dạng có mục riêng nhưng kiểm cấp theo gốc dễ hơn ----
{
  const r = analyzeWord("found")[0];
  eq("found: có alt = find", r.alt?.lemma, "find");
}

// ---- cụm động từ (liền + tách được) ----
{
  const { mwes } = analyzeSentence("She gave up coffee last year.");
  eq("cụm liền: give up", mwes.map((m) => m.id).includes("give up"), true);
  const t = analyzeSentence("He picked it up from the floor.");
  eq("cụm tách: pick … up", t.mwes.map((m) => m.id).includes("pick up"), true);
  const n = analyzeSentence("He picked apples up the hill.");
  eq("không bắt nhầm cụm tách", n.mwes.map((m) => m.id).includes("pick up"), false);
}

// ---- hồ sơ: đếm vượt cấp ----
{
  const p = profile(["The cat sat on the mat.", "It was happy."], { level: 0 });
  eq("A1 câu dễ: không vượt cấp", p.over.filter((o) => !o.mwe).length, 0);
  const q = profile(["The ramifications were unprecedented."], { level: 0 });
  eq("từ khó bị bắt (vượt cấp hoặc ngoài từ điển)", q.over.length + q.unknown.length >= 2, true);
  eq("LEVEL_KEYS", LEVEL_KEYS, ["a1", "a2", "b1", "b2", "c1", "c2"]);
}

// ---- IPA theo token ----
eq("IPA rút gọn", ipaOf("don't"), "doʊnt");
eq("IPA -s sau âm vô thanh", ipaOf("cats").endsWith("s"), true);
eq("IPA -ed sau t/d → ɪd", ipaOf("wanted").endsWith("ɪd"), true);
eq("IPA không bịa: tên lạ", ipaOf("Zyxworth"), "");

// ---- tách từ transcript ----
{
  const t = lineTokens("I've got $3,500 — isn't that well-known?");
  eq("token từ", t.filter((x) => x.w >= 0).map((x) => x.t), ["I've", "got", "$3,500", "isn't", "that", "well-known"]);
  eq("ghép lại nguyên văn", t.map((x) => x.t).join(""), "I've got $3,500 — isn't that well-known?");
  eq("wordCount", wordCount("See you at 7:30, OK?"), 5);
}

// ---- parser nguồn ----
{
  eq("splitPair", splitPair("Hello. | Xin chào."), { en: "Hello.", vi: "Xin chào." });
  eq("splitPair thiếu nghĩa", splitPair("Hello."), null);
  eq("parseKv", parseKv(`tom name="Tom Lee" x=420 back`), { _: ["tom", "back"], name: "Tom Lee", x: "420" });
  const fail = (l, m) => {
    throw new Error(`${l}: ${m}`);
  };
  const prose = parseProse(
    [
      { line: 1, text: "A. | Một." },
      { line: 2, text: "B. | Hai." },
      { line: 3, text: "" },
      { line: 4, text: "C. | Ba." },
    ],
    fail,
  );
  eq("đoạn văn", prose.paras, [0, 2]);
  const ch = parseChapters(
    [
      { line: 1, text: "## One | Một" },
      { line: 2, text: "A. | Một." },
      { line: 3, text: "## Two | Hai" },
      { line: 4, text: "B. | Hai." },
    ],
    fail,
  );
  eq("chương", ch.map((c) => c.title.en), ["One", "Two"]);
  const dl = parseDialogue([{ line: 1, text: "tom+anna: Surprise! | Bất ngờ chưa! [happy cheer pause=1.2]" }], fail);
  eq("thoại đồng thanh", dl[0].speaker, ["tom", "anna"]);
  eq("chú thích", dl[0].ann, "happy cheer pause=1.2");
  const { fields, bad } = parseAnnotations("worried shake @keys ~clock:7:45 anna:surprised ipa=read:rɛd lights=off", new Set(["tom", "anna"]));
  eq("chú thích → trường", [fields.expression, fields.gesture, fields.prop, fields.thoughtBubble, fields.react?.anna, fields.ipaOverride?.read, fields.visual?.lights], ["worried", "shake", "keys", "clock:7:45", "surprised", "rɛd", "off"]);
  eq("chú thích lạ bị bắt", parseAnnotations("smile", new Set()).bad, ["smile"]);
  eq("không có chú thích lạ", bad, []);
  const dir = mkdtempSync(join(tmpdir(), "content-"));
  const f = join(dir, "x.txt");
  writeFileSync(f, "=== rd-a1-a-rainy-day\ntitle: A Rainy Day | Một ngày mưa\ntopic: nature\n\nIt is raining. | Trời đang mưa.\n");
  const items = parseFile(f, dir);
  eq("parseFile", [items[0].id, items[0].level, items[0].type, items[0].header.topic, items[0].body.filter((b) => b.text).length], ["rd-a1-a-rainy-day", "a1", "reading", "nature", 1]);
}

// ---- câu hỏi đọc hiểu: parser + bộ kiểm + hàm thuần giao diện ----
{
  const dir = mkdtempSync(join(tmpdir(), "quiz-"));
  const f = join(dir, "q.txt");
  writeFileSync(
    f,
    [
      "// ghi chú",
      "=== rd-a1-rain",
      "? What day is it? | Hôm đó là thứ mấy?",
      "+ Monday | Thứ Hai",
      "- Sunday | Chủ nhật",
      "- Friday | Thứ Sáu",
      "- Saturday | Thứ Bảy",
      "> Câu đầu: «It is Monday morning, and it is raining.»",
      "",
      "=== st-a1-cake 2",
      "? Who cuts the bananas? | Ai cắt chuối?",
      "+ Ruby | Ruby",
      "- Finn | Finn",
      "- Dad | Bố",
      "- Mom | Mẹ",
      "> «Ruby cuts bananas and oranges.»",
    ].join("\n"),
  );
  const blocks = parseQuizFile(f, dir);
  eq("quiz: 2 block", blocks.map((b) => [b.id, b.ch]), [["rd-a1-rain", null], ["st-a1-cake", 2]]);
  eq("quiz: đáp án đúng", blocks[0].questions[0].opts.map((o) => o.ok), [true, false, false, false]);
  eq("quiz: giải thích", blocks[1].questions[0].why, "«Ruby cuts bananas and oranges.»");
  writeFileSync(f, "=== st-a1-cake\n? Q? | H?\n");
  let thrown = "";
  try {
    parseQuizFile(f, dir);
  } catch (e) {
    thrown = String(e.message);
  }
  eq("quiz: truyện thiếu số chương bị bắt", /số chương/.test(thrown), true);
  eq("quotesOf", quotesOf("Bài: «A b.» và «C d»"), ["A b.", "C d"]);
  const sents = [{ en: 'Ruby says, "Let\'s go."' }, { en: "Then they run home." }];
  eq("quoteFound nguyên văn", quoteFound('"Let\'s go."', sents), true);
  eq("quoteFound qua hai câu liền", quoteFound('go." Then they', sents), true);
  eq("quoteFound sai chữ", quoteFound("Then they walk home.", sents), false);
  // bộ kiểm trên một bài giả: đủ 3 câu, 1 câu sai luật
  const m = { id: "rd-a1-x", type: "reading", level: "a1", band: 0, names: new Set(["^ruby"]), gloss: new Set(), sentences: [{ en: "Ruby has a red bike." }, { en: "She rides it to school every day." }, { en: "On Sunday, it is very hot." }] };
  const opt = (en, ok = false) => ({ en, vi: "x", ok });
  const good = (q, a, why) => ({ line: 1, q: { en: q, vi: "Hỏi?" }, opts: [opt(a, true), opt("A blue car"), opt("A green bus"), opt("A big train")], why });
  const block = {
    id: "rd-a1-x",
    ch: null,
    questions: [
      good("What does Ruby have?", "A red bike", "Bài: «Ruby has a red bike.»"),
      good("Where does she go every day?", "To school", "«She rides it to school every day.»"),
      { line: 3, q: { en: "What is the consequence of the heat", vi: "Hỏi?" }, opts: [opt("x", true), opt("x"), opt("y")], why: "Không trích" },
    ],
  };
  const r = checkQuizBlock(block, m);
  const has = (re) => r.e.some((x) => re.test(x));
  eq("kiểm quiz: câu tốt không lỗi", r.e.filter((x) => /câu [12] /.test(x)), []);
  eq("kiểm quiz: thiếu ?", has(/câu 3 .*kết bằng "\?"/), true);
  eq("kiểm quiz: 3 phương án", has(/câu 3 .*3 phương án/), true);
  eq("kiểm quiz: phương án trùng", has(/câu 3 .*trùng nhau/), true);
  eq("kiểm quiz: thiếu trích dẫn", has(/câu 3 .*trích «nguyên văn»/), true);
  eq("kiểm quiz: từ vượt cấp A1", has(/câu 3 .*vượt cấp consequence/), true);
  // hàm thuần
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const perms = new Set();
  for (let i = 0; i < 200; i++) perms.add(shuffledOrder(4, rand).join());
  eq("shuffledOrder là hoán vị và có xáo", [...perms].every((p) => p.split(",").sort().join() === "0,1,2,3") && perms.size > 10, true);
  eq("shuffledOrder rand=0 tất định", shuffledOrder(3, () => 0), [1, 2, 0]);
  eq("quizScore", quizScore([1, 0, 2], [1, 2, undefined]), { done: 2, correct: 1, total: 3 });
  eq("splitQuotes", splitQuotes("Bài: «A b.» nhé"), [{ text: "Bài: ", quote: false }, { text: "A b.", quote: true }, { text: " nhé", quote: false }]);
}

// ---- hàm thuần Video ----
{
  const lines = [
    { start: 0.5, end: 1.5, timing: [[0, 0.5], [1, 0.9]] },
    { start: 2.2, end: 3.0 },
  ];
  eq("lineIndexAt trước câu đầu", lineIndexAt(lines, 0.2), -1);
  eq("lineIndexAt giữa hai câu giữ câu trước", lineIndexAt(lines, 1.9), 0);
  eq("wordAt", wordAt(lines[0], 1.0), 1);
  eq("keyRanges theo ranh giới từ", keyRanges("Could you help? Could you?", ["could you"]), [[0, 9], [16, 25]]);
  eq("keyRanges không khớp giữa từ", keyRanges("Scouldn't", ["could"]), []);
  eq("castOnStage from/until", [castOnStage({ from: 3 }, 1), castOnStage({ from: 3 }, 2), castOnStage({ until: 2 }, 4)], [false, true, false]);
  const st = sceneAt({ cast: { a: {}, b: {} }, lines: [{ speaker: "a", expression: "happy", start: 1, react: { b: "sad" } }] }, 0);
  eq("sceneAt biểu cảm + react", [st.a.expression, st.b.expression], ["happy", "sad"]);
}

console.log(`test-content: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
