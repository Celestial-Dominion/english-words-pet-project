// QA máy cho ex-done/: độ phủ so với batch, format "en|vi", câu có chứa từ không, độ dài.
// Chạy: node scripts/check-ex.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const BATCH_DIR = join(HERE, "ex-batches");
const DONE_DIR = join(HERE, "ex-done");
const DATA = join(HERE, "..", "public", "data");

// forms của mỗi từ → biết câu có chứa từ (dạng chia bất kỳ) hay không
const formsOf = new Map();
for (const lv of ["foundation", "b1", "b2", "c1", "c2"]) {
  const p = join(DATA, "words", `${lv}.json`);
  if (!existsSync(p)) continue;
  for (const w of JSON.parse(readFileSync(p, "utf8"))) {
    formsOf.set(w.id, new Set([w.id, ...(w.forms ?? []), ...(w.variants ?? [])].map((s) => s.toLowerCase())));
  }
}

// Chuẩn hoá CẢ câu và từ theo cùng quy tắc (gạch nối → khoảng trắng) để "part-time" khớp "part time".
const norm = (s) => s.toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
const contains = (sentence, id) => {
  const words = norm(sentence).split(" ");
  const hay = ` ${words.join(" ")} `;
  // khớp cả dạng sở hữu ("mama's", "wit's") và dạng chia đều chưa có trong forms ("redoing")
  for (const f of formsOf.get(id) ?? [id]) {
    const n = norm(f);
    if (hay.includes(` ${n} `) || hay.includes(` ${n}'s `) || hay.includes(` ${n}' `)) return true;
    if (!n.includes(" ") && n.length >= 4) {
      const base = n.replace(/e$/, "");
      if (hay.includes(` ${base}ing `) || hay.includes(` ${base}ed `)) return true;
      // số nhiều/ngôi 3 đều chưa có trong forms: city→cities, box→boxes, day→days
      const plural = /[^aeiou]y$/.test(n) ? `${n.slice(0, -1)}ies` : /(s|sh|ch|x|z)$/.test(n) ? `${n}es` : `${n}s`;
      if (hay.includes(` ${plural} `)) return true;
    }
  }

  const parts = norm(id).split(" ");
  if (parts.length === 2) {
    // Phrasal verb TÁCH RỜI ("put us up", "kicked him out") — hợp lệ theo INSTRUCTIONS.
    // Động từ có thể chia nên khớp theo gốc ≥3 ký tự; tiểu từ nằm trong 4 từ kế tiếp.
    const [verb, particle] = parts;
    // dạng chia của động từ lấy từ forms ("held over" → "held"), cộng khớp theo gốc cho dạng đều
    const verbForms = new Set([verb, ...[...(formsOf.get(id) ?? [])].map((f) => norm(f).split(" ")[0])]);
    const stem = verb.slice(0, Math.max(3, verb.length - 2));
    for (let i = 0; i < words.length; i++) {
      if (!verbForms.has(words[i]) && !words[i].startsWith(stem)) continue;
      if (words.slice(i + 1, i + 5).includes(particle)) return true;
    }
    return false;
  }
  // dạng chia không có trong forms → thử tiền tố ≥5 ký tự
  return parts[0].length >= 5 && hay.includes(` ${parts[0]}`);
};

let batches = 0, doneFiles = 0, wanted = 0, got = 0;
const missing = [], broken = [], noWord = [], tooLong = [], fewSentences = [];

for (const f of readdirSync(BATCH_DIR).filter((x) => x.endsWith(".json")).sort()) {
  batches++;
  const batch = JSON.parse(readFileSync(join(BATCH_DIR, f), "utf8"));
  wanted += batch.length;
  const p = join(DONE_DIR, f);
  if (!existsSync(p)) {
    missing.push(`${f} (CẢ FILE, ${batch.length} từ)`);
    continue;
  }
  doneFiles++;
  let out;
  try {
    out = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    broken.push(`${f}: ${e.message}`);
    continue;
  }
  for (const item of batch) {
    const arr = out[item.id];
    if (!Array.isArray(arr) || !arr.length) {
      missing.push(`${f}: ${item.id}`);
      continue;
    }
    got++;
    if (arr.length < 3) fewSentences.push(`${f}: ${item.id} (${arr.length} câu)`);
    for (const s of arr) {
      const [en, vi] = String(s).split("|");
      if (!en?.trim() || !vi?.trim()) {
        broken.push(`${f}: ${item.id} — sai format "en|vi"`);
        continue;
      }
      if (!contains(en, item.id)) noWord.push(`${item.id}: "${en.trim().slice(0, 50)}"`);
      const n = en.trim().split(/\s+/).length;
      if (n > 18) tooLong.push(`${item.id}: ${n} từ`);
    }
  }
}

console.log(`Batch: ${batches} · done: ${doneFiles} · từ: ${got}/${wanted}`);
const report = (label, arr, n = 10) => {
  if (arr.length) console.log(`${label} (${arr.length}): ${arr.slice(0, n).join(" | ")}${arr.length > n ? " …" : ""}`);
};
report("THIẾU", missing);
report("LỖI FORMAT", broken);
report("CÂU KHÔNG CHỨA TỪ", noWord);
report("CÂU QUÁ DÀI (>18 từ)", tooLong, 6);
report("DƯỚI 3 CÂU", fewSentences, 6);
if (!missing.length && !broken.length && !noWord.length) console.log("SẠCH ✓");
