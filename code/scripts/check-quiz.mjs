// Kiểm riêng câu hỏi đọc hiểu (content/quiz/**.txt) — luật ở scripts/lib/quiz-check.mjs.
//   node scripts/check-quiz.mjs [--level a1] [--id rd-a1-…] [--missing] [--long]
// In lỗi/cảnh báo câu hỏi + độ phủ (bài đọc / chương đã có câu hỏi) theo cấp; --missing liệt kê bài/chương còn thiếu.
import { loadLibrary, loadQuizzes } from "./lib/content-model.mjs";
import { LEVEL_KEYS } from "./lib/en-vocab.mjs";
import { checkQuizzes } from "./lib/quiz-check.mjs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY_LEVEL = opt("--level");
const ONLY_ID = opt("--id");
const MISSING = args.includes("--missing");
const LONG = args.includes("--long"); // liệt kê câu có đáp án đúng dài hẳn phương án sai

const { items } = loadLibrary();
const quiz = loadQuizzes();
const { perItem, libErr, libWarn, coverage } = checkQuizzes(items, quiz);
let nErr = libErr.length;
let nWarn = 0;
for (const m of items) {
  if ((ONLY_LEVEL && m.level !== ONLY_LEVEL) || (ONLY_ID && m.id !== ONLY_ID)) continue;
  const r = perItem.get(m.id);
  if (!r || (!r.e.length && !r.w.length)) continue;
  nErr += r.e.length;
  nWarn += r.w.length;
  console.log(`  ${m.id}  (${m.file})`);
  for (const e of r.e) console.log(`    ✗ ${e}`);
  for (const w of r.w) console.log(`    ! ${w}`);
}
for (const e of libErr) console.log(`✗ ${e}`);
for (const w of libWarn) if (!ONLY_LEVEL || w.startsWith(ONLY_LEVEL)) console.log(`! ${w}`);
for (const lv of LEVEL_KEYS) {
  if (ONLY_LEVEL && lv !== ONLY_LEVEL) continue;
  const c = coverage[lv];
  if (!c) continue;
  console.log(`${lv.toUpperCase()}: câu hỏi ${c.r}/${c.rAll} bài đọc · ${c.ch}/${c.chAll} chương`);
  if (MISSING)
    for (const m of items.filter((x) => x.level === lv && x.type !== "video")) {
      if (m.type === "reading" && !quiz.blocks.has(m.id)) console.log(`    thiếu ${m.id}  (${m.file})`);
      if (m.type === "story") {
        const miss = m.chapters.map((_, k) => k + 1).filter((k) => !quiz.blocks.has(`${m.id}#${k}`));
        if (miss.length) console.log(`    thiếu ${m.id} chương ${miss.join(",")}  (${m.file})`);
      }
    }
}
if (LONG) {
  const byId = new Map(items.map((m) => [m.id, m]));
  for (const b of quiz.blocks.values()) {
    const m = byId.get(b.id);
    if (!m || (ONLY_LEVEL && m.level !== ONLY_LEVEL) || (ONLY_ID && m.id !== ONLY_ID)) continue;
    for (const q of b.questions) {
      const right = q.opts.find((o) => o.ok);
      const wrong = q.opts.filter((o) => !o.ok);
      if (right && wrong.length && right.en.length >= 1.3 * Math.max(...wrong.map((o) => o.en.length)) && right.en.length > 12)
        console.log(`  dài: ${b.file}:${q.line} «${right.en}» vs ${wrong.map((o) => o.en.length).join("/")} ký tự`);
    }
  }
}
const nq = [...quiz.blocks.values()].reduce((n, b) => n + b.questions.length, 0);
console.log(`\n${quiz.blocks.size} khối · ${nq} câu hỏi · ${nErr} lỗi · ${nWarn} cảnh báo`);
process.exit(nErr ? 1 : 0);
