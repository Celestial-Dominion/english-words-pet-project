// Vá các lỗi còn sót trong bản dịch máy (rd-done/):
//   1. Câu API trả về NGUYÊN tiếng Anh (Google thỉnh thoảng bỏ qua 1 dòng trong lô) → dịch lại lẻ.
//   2. Bài LỆCH số câu so với batch gốc → xoá bản dịch để lần chạy sau dịch lại từ đầu.
// Chạy: node scripts/fix-readings.mjs
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { progress } from "./lib-progress.mjs";

const HERE = import.meta.dirname;
const BATCH_DIR = join(HERE, "rd-batches");
const DONE_DIR = join(HERE, "rd-done");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translate(text, tries = 0) {
  try {
    await sleep(250);
    const u = new URL("https://translate.googleapis.com/translate_a/single");
    u.searchParams.set("client", "gtx");
    u.searchParams.set("sl", "en");
    u.searchParams.set("tl", "vi");
    u.searchParams.set("dt", "t");
    u.searchParams.set("q", text);
    const r = await fetch(u);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const out = d[0].map((x) => x[0]).join("").trim();
    if (!out) throw new Error("rỗng");
    return out;
  } catch (e) {
    if (tries < 3) {
      await sleep(2000 * (tries + 1));
      return translate(text, tries + 1);
    }
    throw e;
  }
}

const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
/** Bản dịch còn nguyên tiếng Anh: không có dấu tiếng Việt và trùng phần lớn từ với bản gốc. */
const looksEnglish = (en, vi) => {
  if (VI_CHARS.test(vi)) return false;
  const a = en.toLowerCase().split(/\s+/).filter(Boolean);
  if (a.length < 4) return false;
  const b = new Set(vi.toLowerCase().split(/\s+/).filter(Boolean));
  return a.filter((w) => b.has(w)).length / a.length > 0.6;
};

// batch gốc theo id
const src = new Map();
for (const f of readdirSync(BATCH_DIR).filter((x) => x.endsWith(".json"))) {
  for (const d of JSON.parse(readFileSync(join(BATCH_DIR, f), "utf8"))) src.set(d.id, d);
}

// 1) tìm câu chưa dịch
const targets = [];
const files = readdirSync(DONE_DIR).filter((x) => x.endsWith(".json"));
for (const f of files) {
  const docs = JSON.parse(readFileSync(join(DONE_DIR, f), "utf8"));
  for (const d of docs) {
    const s = src.get(d.id);
    if (!s || s.sentences.length !== d.vi.length) continue; // lệch câu xử lý ở bước 2
    for (const [i, viText] of d.vi.entries()) {
      if (looksEnglish(s.sentences[i], viText)) targets.push({ f, id: d.id, i });
    }
  }
}

if (targets.length) {
  const bar = progress(targets.length, "dịch lại");
  const cache = new Map();
  for (const t of targets) {
    const path = join(DONE_DIR, t.f);
    const docs = cache.get(t.f) ?? JSON.parse(readFileSync(path, "utf8"));
    cache.set(t.f, docs);
    const doc = docs.find((x) => x.id === t.id);
    try {
      doc.vi[t.i] = await translate(src.get(t.id).sentences[t.i]);
      bar.tick(1, `${t.id}[${t.i}]`);
    } catch (e) {
      bar.tick(1, `lỗi ${t.id}[${t.i}]: ${e.message}`);
    }
  }
  for (const [f, docs] of cache) writeFileSync(join(DONE_DIR, f), JSON.stringify(docs, null, 1));
  bar.done(`vá xong ${targets.length} câu`);
} else {
  console.error("Không còn câu nào chưa dịch.");
}

// 2) bài lệch số câu → xoá bản dịch để dịch lại sạch
let removed = 0;
for (const f of files) {
  const docs = JSON.parse(readFileSync(join(DONE_DIR, f), "utf8"));
  const kept = docs.filter((d) => {
    const s = src.get(d.id);
    if (s && s.sentences.length !== d.vi.length) {
      removed++;
      return false;
    }
    return true;
  });
  if (kept.length !== docs.length) writeFileSync(join(DONE_DIR, f), JSON.stringify(kept, null, 1));
}
console.error(removed ? `Bỏ ${removed} bài lệch số câu — chạy translate-readings để dịch lại.` : "Không có bài lệch câu.");
