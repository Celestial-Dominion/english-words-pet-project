// Unit test Ngữ pháp (docs/ENGLISH_GRAMMAR_PLAYBOOK.md): hàm thuần (cue, phần, nhấn, luyện tập, tiến độ / lịch ôn, mã
// hoá + hợp nhất đồng bộ), bộ đọc nguồn bài + kiểm dữ liệu: curriculum phủ đủ inventory, bài đã build hợp lệ.
// Chạy: node --experimental-strip-types --no-warnings scripts/test-grammar.mjs   (nằm trong npm test)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const G = await import("../lib/grammar.ts");
const S = await import("../lib/sync-merge.ts");
const F = await import("./lib/grammar-format.mjs");
const M = await import("./lib/grammar-model.mjs");

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else {
    fail++;
    console.log(`✗ ${name}\n   got:  ${g}\n   want: ${w}`);
  }
}
const ok = (name, cond) => check(name, !!cond, true);

// ----- timeline / bảng -----
const nb = { k: "n", sec: "form", b: 1, start: 10, end: 14, parts: [], cues: [[0, 10.5], [2, 12], [1, 13]] };
check("cue: trước cue đầu", G.cueAt(nb, 10.2), -1);
check("cue: cue đang giữ", G.cueAt(nb, 12.4), 2);
check("cue: ngoài đoạn", G.cueAt(nb, 20), -1);
check("cue: câu tiếng Anh không có cue", G.cueAt({ k: "e", start: 0, end: 1 }, 0.5), -1);
check("sectionsOf gom liên tiếp", G.sectionsOf([{ sec: "hook" }, { sec: "hook" }, { sec: "form" }]), [
  { sec: "hook", from: 0, to: 2 },
  { sec: "form", from: 2, to: 3 },
]);
check("holdSet", [...G.holdSet([{ k: "n" }, { k: "n", hold: 1 }, { k: "e" }])], [1]);
check("speakerOf", [G.speakerOf({ k: "e", who: "mia" }), G.speakerOf({ k: "e" }), G.speakerOf({ k: "n" })], ["mia", "teacher", "teacher"]);
check(
  "splitSpans",
  G.splitSpans("She is a teacher.", [
    [0, 3, "s"],
    [4, 6, "k"],
  ]).map((x) => [x.text, x.role ?? ""]),
  [
    ["She", "s"],
    [" ", ""],
    ["is", "k"],
    [" a teacher.", ""],
  ],
);
check("regLabels", G.regLabels("formal,spoken"), ["Trang trọng", "Khẩu ngữ"]);

// ----- luyện tập -----
const ord = { k: "order", parts: ["Yesterday", "I", "went", "home"], alt: [[1, 2, 3, 0]], end: ".", vi: "" };
ok("order: đúng thứ tự", G.orderCorrect(ord, [0, 1, 2, 3]));
ok("order: thứ tự thay thế đã khai", G.orderCorrect(ord, [1, 2, 3, 0]));
ok("order: sai", !G.orderCorrect(ord, [1, 0, 2, 3]));
ok("order: khối trùng chữ đổi chỗ vẫn đúng", G.orderCorrect({ k: "order", parts: ["the", "cat", "the"], end: ".", vi: "" }, [2, 1, 0]));
const ty = { k: "type", stem: "I ___ tired.", ans: ["am", "'m"] };
ok("type: chấp nhận đáp án khác", G.typeCorrect(ty, "  'M ") && G.typeCorrect(ty, "am."));
ok("type: nháy cong = nháy thẳng", G.typeCorrect({ k: "type", stem: "", ans: ["don't"] }, "don’t"));
ok("type: sai / rỗng", !G.typeCorrect(ty, "is") && !G.typeCorrect(ty, " "));

// ----- tiến độ & lịch ôn -----
const t0 = new Date("2026-09-01T08:00:00Z");
const r1 = G.applyPractice(undefined, "pronouns-be", 80, t0);
check("đạt lần đầu → đã học, reps 1", [G.isLearned(r1), r1.reps, r1.best], [true, 1, 80]);
check("ôn sau 1 ngày", G.grammarDue(r1)?.toISOString(), "2026-09-02T08:00:00.000Z");
const r2 = G.applyPractice(r1, "pronouns-be", 90, new Date("2026-09-02T09:00:00Z"));
check("đạt lần 2 → 3 ngày", G.grammarDue(r2)?.toISOString(), "2026-09-05T09:00:00.000Z");
const r3 = G.applyPractice(r2, "pronouns-be", 40, new Date("2026-09-05T10:00:00Z"));
check("trượt → reps 0, vẫn đã học, ôn ngày mai, giữ điểm cao nhất", [r3.reps, G.isLearned(r3), G.grammarDue(r3)?.toISOString(), r3.best], [0, true, "2026-09-06T10:00:00.000Z", 90]);
check("chưa đạt lần đầu → chưa học, không có lịch", [G.isLearned(G.applyPractice(undefined, "x", 50, t0)), G.grammarDue(G.applyPractice(undefined, "x", 50, t0))], [false, null]);
let rr = G.applyPractice(undefined, "x", 100, t0);
for (let i = 0; i < 20; i++) rr = G.applyPractice(rr, "x", 100, new Date(t0.getTime() + i * 1e9));
ok("khoảng ôn có trần 120 ngày", G.grammarDue(rr).getTime() - new Date(rr.lastAt).getTime() === 120 * 86400000);
const off = G.unmarkLearned(r2, new Date("2026-09-03T00:00:00Z"));
check("bỏ đánh dấu: hết đã học, giữ điểm", [G.isLearned(off), off.best, off.off], [false, 90, 1]);
check("học lại sau khi bỏ đánh dấu → đã học lại từ đầu", [G.isLearned(G.applyPractice(off, "pronouns-be", 85, new Date("2026-09-04T00:00:00Z"))), G.applyPractice(off, "pronouns-be", 85, new Date("2026-09-04T00:00:00Z")).reps], [true, 1]);
check("đánh dấu tay → như đạt một lần", [G.isLearned(G.markLearned(undefined, "y", t0)), G.markLearned(undefined, "y", t0).reps], [true, 1]);

// ----- hợp nhất đồng bộ (giao hoán, idempotent) -----
const A = { id: "g", doneAt: "2026-09-01T00:00:00.000Z", lastAt: "2026-09-03T00:00:00.000Z", reps: 2, best: 80, last: 80 };
const B = { id: "g", doneAt: "2026-09-02T00:00:00.000Z", lastAt: "2026-09-05T00:00:00.000Z", reps: 0, best: 60, last: 40 };
const m1 = G.mergeGrammarRow(A, B);
check("merge: lịch theo lần luyện gần hơn, điểm max, học đầu sớm hơn", [m1.lastAt, m1.reps, m1.best, m1.doneAt, m1.last], [B.lastAt, 0, 80, A.doneAt, 40]);
check("merge giao hoán", G.mergeGrammarRow(B, A), m1);
check("merge idempotent", G.mergeGrammarRow(m1, m1), m1);
check("merge: bỏ đánh dấu (mới hơn) thắng doneAt", G.mergeGrammarRow(m1, { id: "g", lastAt: "2026-09-06T00:00:00.000Z", reps: 0, best: 80, off: 1 }).doneAt, undefined);

// ----- mã hoá qua trường grammar: string[] của doc đồng bộ / tệp sao lưu -----
const enc = G.encodeGrammarRow(m1);
check("encode → decode giữ nguyên", G.decodeGrammarRow(enc), m1);
check("decode: chuỗi id cũ = đã học từ lâu", [G.isLearned(G.decodeGrammarRow("pronouns-be")), G.decodeGrammarRow("pronouns-be").reps], [true, 1]);
check("decode: rác bị bỏ", [G.decodeGrammarRow(""), G.decodeGrammarRow("Bad Id~x"), G.decodeGrammarRow(null)], [null, null, null]);
const codesA = [G.encodeGrammarRow(A), G.encodeGrammarRow({ id: "h", reps: 1, best: 70, doneAt: "2026-09-01T00:00:00.000Z", lastAt: "2026-09-01T00:00:00.000Z" })];
const codesB = [G.encodeGrammarRow(B)];
const mc = G.mergeGrammarCodes(codesA, codesB);
check("mergeGrammarCodes: mỗi bài một chuỗi, hợp đúng", [mc.length, G.decodeGrammarRows(mc).find((r) => r.id === "g").best], [2, 80]);
check("mergeGrammarCodes giao hoán", G.mergeGrammarCodes(codesB, codesA), mc);
check("mergeGrammarCodes: bản cũ gộp mảng kiểu tập hợp (trùng id) vẫn ra một dòng", G.mergeGrammarCodes([...codesA, ...codesB], []).length, 2);
ok("grammarStamp đổi khi điểm đổi dù số bài giữ nguyên", G.grammarStamp([G.encodeGrammarRow(A)]) !== G.grammarStamp([G.encodeGrammarRow({ ...A, best: 95 })]));
const snap = (grammar) => ({ reviews: [], daily: [], reads: [], notes: [], xp: 0, phonics: [], grammar, storyPos: {}, gamify: { key: "state", xp: 0 } });
ok("fingerprint đổi khi tiến độ ngữ pháp đổi", !S.fpEq(S.fingerprint(snap([G.encodeGrammarRow(A)]), "", ""), S.fingerprint(snap([G.encodeGrammarRow({ ...A, reps: 3 })]), "", "")));
check("mergeSnapshots gộp ngữ pháp theo dòng", G.decodeGrammarRows(S.mergeSnapshots(snap(codesA), snap(codesB)).grammar).find((r) => r.id === "g").lastAt, B.lastAt);

// ----- bộ đọc nguồn -----
check("parseMarks", F.parseMarks("She {is} a {teacher|c}."), { text: "She is a teacher.", hl: [[4, 6, "k"], [9, 16, "c"]] });
check("parseNarr", F.parseNarr("Dùng [[am]] với [[I]]."), [{ v: "Dùng " }, { e: "am" }, { v: " với " }, { e: "I" }, { v: "." }]);
check("parseTimeMark: khoảng", F.parseTimeMark("-2..0 have lived | đã sống"), { at: -2, to: 0, label: "have lived", vi: "đã sống" });
check("parseTimeMark: now + tiếp diễn", [F.parseTimeMark("now | bây giờ"), F.parseTimeMark("~-1 was cooking")], [{ at: 0, label: "now", vi: "bây giờ", now: 1 }, { at: -1, label: "was cooking", wave: 1 }]);
check("moveTokens tách dấu câu", F.moveTokens("Are you a student?"), ["Are", "you", "a", "student", "?"]);
check("splitAnn", F.splitAnn("Hi! | Chào! [happy wave]"), { body: "Hi! | Chào!", ann: "happy wave" });
check("parseOptions", F.parseOptions("is* / are / am"), { o: ["is", "are", "am"], a: [0] });
const src = F.parseGrammarSource(
  ["=== demo", "sum: Tóm tắt", "form: I + am | tôi là", "cast: mia", "", "#hook", "mia: Hi! | Chào! [happy]", "> Lời [[am]].", "#form", "f: Chủ ngữ + [am]", "- I {am} here. | Tôi ở đây.", "#practice", "fill: I ___ here. | am* / is"].join("\n"),
  "demo.txt",
);
check("parseGrammarSource: header + bước + bài tập", [src.id, src.header.form.length, src.steps.map((s) => s.kind + (s.key ? ":" + s.key : "")), src.ex.map((e) => e.kind)], ["demo", 1, ["sec", "talk", "narr", "sec", "step:f", "line"], ["fill"]]);
ok("englishLeak bắt từ tiếng Anh lọt vào lời Việt", M.englishLeak("Ta dùng does với chủ ngữ ngôi ba").includes("does") && !M.englishLeak("Ta dùng động từ với chủ ngữ").length);

// ----- curriculum ↔ inventory -----
check("curriculum hợp lệ", M.checkCurriculum(), []);
const C = M.curriculum();
const INV = M.inventory().points;
const cov = new Set(C.lessons.flatMap((l) => l.pts));
check("mọi điểm thuộc ≥1 bài", [...INV.keys()].filter((c) => !cov.has(c)), []);
const REL = M.lessonRelations();
ok("tiên quyết luôn đứng trước", C.lessons.every((l) => REL.get(l.id).pre.every((p) => C.byId.get(p).idx < l.idx)));
ok("đủ 6 cấp", ["a1", "a2", "b1", "b2", "c1", "c2"].every((lv) => C.lessons.some((l) => l.lv === lv)));

// ----- bài đã build -----
const DIR = join(ROOT, "public", "data", "grammar", "lessons");
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];
const ip = join(ROOT, "public", "data", "grammar", "index.json");
const index = existsSync(ip) ? JSON.parse(readFileSync(ip, "utf8")) : { lessons: [], content: {} };
check("chỉ mục = số file bài", index.lessons.length, files.length);
ok("chỉ mục theo thứ tự curriculum", index.lessons.every((x, i) => !i || C.byId.get(index.lessons[i - 1].id).idx < C.byId.get(x.id).idx));
for (const f of files) {
  const raw = readFileSync(join(DIR, f), "utf8");
  const l = JSON.parse(raw);
  const bad = [];
  if (f !== `${l.id}.json`) bad.push("tên file ≠ id");
  if (!C.byId.has(l.id)) bad.push("không có trong curriculum");
  l.beats.forEach((b, i) => {
    if (!(b.end > b.start)) bad.push(`đoạn ${i}: end ≤ start`);
    if (i && b.start < l.beats[i - 1].end - 0.001) bad.push(`đoạn ${i}: chồng đoạn trước`);
    if (!l.boards[b.b]) bad.push(`đoạn ${i}: bảng ${b.b} không có`);
    if (b.k === "e") {
      if (!b.vi) bad.push(`đoạn ${i}: thiếu nghĩa`);
      if (b.timing?.some(([, t], k) => t < b.start - 0.001 || t > b.end + 0.001 || (k && t < b.timing[k - 1][1]))) bad.push(`đoạn ${i}: mốc từ sai`);
      if (b.who && !l.cast?.[b.who]) bad.push(`đoạn ${i}: vai lạ`);
    } else {
      if (!b.parts.length) bad.push(`đoạn ${i}: lời giảng rỗng`);
      if (b.cues?.some(([, t]) => t < b.start - 0.001 || t > b.end + 0.001)) bad.push(`đoạn ${i}: cue ngoài đoạn`);
    }
  });
  l.boards.forEach((bd, k) => {
    if ((bd.type === "line" || bd.type === "fix") && l.beats[bd.beat]?.k !== "e") bad.push(`bảng ${k}: trỏ câu sai`);
    if (bd.type === "pair" && bd.beats.some((x) => l.beats[x]?.k !== "e")) bad.push(`bảng ${k}: cặp trỏ sai`);
  });
  l.ex.forEach((e, k) => {
    if (e.k === "order") {
      if (e.parts.length < 3) bad.push(`bài tập ${k}: sắp xếp < 3 khối`);
    } else if (e.k === "type") {
      if (!e.ans.length || !e.stem.includes(G.BLANK)) bad.push(`bài tập ${k}: gõ thiếu đáp án / chỗ trống`);
    } else if (e.k === "listen") {
      const b = l.beats[e.beat];
      if (b?.k !== "e" || !(e.a >= 0 && e.a < e.o.length) || (!e.en && e.o[e.a] !== b.vi) || (e.en && e.o[e.a] !== b.en)) bad.push(`bài tập ${k}: nghe trỏ sai`);
    } else if (!(e.a >= 0 && e.a < e.o.length)) bad.push(`bài tập ${k}: đáp án ngoài phạm vi`);
  });
  if (!(l.audio?.duration > 5) || !l.audio.mouth) bad.push("thiếu audio");
  const last = l.beats[l.beats.length - 1];
  if (last && last.end > l.audio.duration) bad.push("đoạn cuối vượt độ dài audio");
  if (!existsSync(join(ROOT, "public", l.audio.src))) bad.push("thiếu file mp3");
  check(`${l.id}: dữ liệu hợp lệ`, bad, []);
  const meta = index.lessons.find((x) => x.id === l.id);
  ok(`${l.id}: có trong chỉ mục, ?v= khớp nội dung`, meta && meta.lv === l.lv && meta.n === l.n && meta.v === createHash("sha1").update(raw).digest("hex").slice(0, 10));
}

console.log(`test-grammar: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
