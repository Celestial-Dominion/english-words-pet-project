// Chia từ CHƯA có câu ví dụ thành batch cho agent (Phase E2).
// Chạy: node scripts/prep-ex-batches.mjs <level>   (1=B1 … 4=C2, 0=nền)
// Ra: scripts/ex-batches/lv{level}-{nnn}.json — mỗi batch ≤60 từ:
//   [{ id, pos, vi, coll }]
// Agent trả file cùng tên trong scripts/ex-done/:
//   { "<id>": ["câu 1|dịch 1", "câu 2|dịch 2", "câu 3|dịch 3"] }
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug } from "./lib-levels.mjs";

const HERE = import.meta.dirname;
const DATA = join(HERE, "..", "public", "data");
const BATCH_DIR = join(HERE, "ex-batches");
const DONE_DIR = join(HERE, "ex-done");
mkdirSync(BATCH_DIR, { recursive: true });
mkdirSync(DONE_DIR, { recursive: true });

const level = Number(process.argv[2] ?? 1);
const words = JSON.parse(readFileSync(join(DATA, "words", `${levelSlug(level)}.json`), "utf8"));

const done = new Set();
for (const f of existsSync(DONE_DIR) ? readdirSync(DONE_DIR) : []) {
  if (!f.endsWith(".json")) continue;
  try {
    for (const id of Object.keys(JSON.parse(readFileSync(join(DONE_DIR, f), "utf8")))) done.add(id);
  } catch { /* file hỏng → coi như chưa làm */ }
}

const SIZE = 60; // câu dài hơn nghĩa → batch nhỏ hơn batch dịch
const items = words
  .filter((w) => !done.has(w.id))
  .map((w) => ({ id: w.id, pos: w.pos, vi: w.meaning_vi, ...(w.collocations?.length ? { coll: w.collocations } : {}) }));

// đánh số TIẾP sau batch đã có của cấp đó (đợt bổ sung sau không được ghi đè phiếu cũ)
let start = 1;
for (const f of readdirSync(BATCH_DIR)) {
  const m = f.match(new RegExp(`^lv${level}-(\\d+)\\.json$`));
  if (m) start = Math.max(start, Number(m[1]) + 1);
}
for (let i = 0; i < items.length; i += SIZE) {
  const n = String(start + Math.floor(i / SIZE)).padStart(3, "0");
  writeFileSync(join(BATCH_DIR, `lv${level}-${n}.json`), JSON.stringify(items.slice(i, i + SIZE), null, 1));
}
console.error(`level ${level}: ${items.length} từ → ${Math.ceil(items.length / SIZE)} batch (đã có ${done.size})`);
