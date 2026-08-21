// Chia từ CHƯA có nghĩa Việt thành batch cho agent dịch (stage 2 của E1).
// Chạy: node scripts/prep-vi-batches.mjs [level]   (level: 0..4, mặc định tất cả)
// Ra: scripts/vi-batches/lv{level}-{nnn}.json — mỗi batch ≤100 từ:
//   [{ id, pos, en: [nghĩa EN], reg: [register] }]
// Agent trả về file cùng tên trong scripts/vi-done/:
//   { "<id>": { "vi": "nghĩa Việt (2-4 nghĩa, ; phân cách, nghĩa phổ biến nhất TRƯỚC)",
//               "coll": ["cụm hay đi kèm", ...] } }   (coll chỉ cần cho level ≥ 1)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");
const BATCH_DIR = join(HERE, "vi-batches");
const DONE_DIR = join(HERE, "vi-done");
mkdirSync(BATCH_DIR, { recursive: true });
mkdirSync(DONE_DIR, { recursive: true });

const only = process.argv[2] !== undefined ? Number(process.argv[2]) : null;
const words = JSON.parse(readFileSync(join(OUT, "words-stage1.json"), "utf8"));

// đã dịch rồi (chạy lại không mất công) — gom mọi file trong vi-done
import { readdirSync } from "node:fs";
const done = new Set();
for (const f of existsSync(DONE_DIR) ? readdirSync(DONE_DIR) : []) {
  if (!f.endsWith(".json")) continue;
  try {
    for (const id of Object.keys(JSON.parse(readFileSync(join(DONE_DIR, f), "utf8")))) done.add(id);
  } catch { /* file hỏng thì bỏ qua */ }
}

const SIZE = 100;
const byLevel = new Map();
for (const w of words) {
  if (only !== null && w.level !== only) continue;
  if (done.has(w.id)) continue;
  if (!byLevel.has(w.level)) byLevel.set(w.level, []);
  byLevel.get(w.level).push({ id: w.id, pos: w.pos, en: w.meaning_en, ...(w.register?.length ? { reg: w.register } : {}) });
}

// Đánh số TIẾP sau batch đã có của cấp đó — đợt bổ sung sau này (thêm nguồn từ mới) không được
// ghi đè phiếu giao việc cũ, nếu không check-vi sẽ báo thiếu oan cho những batch đã dịch xong.
const nextIndex = (lv) => {
  let max = 0;
  for (const f of existsSync(BATCH_DIR) ? readdirSync(BATCH_DIR) : []) {
    const m = f.match(new RegExp(`^lv${lv}-(\\d+)\\.json$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
};

let total = 0;
for (const [lv, items] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
  // ưu tiên tần suất cao trước (mảng stage1 đã xếp theo tần suất)
  const start = nextIndex(lv);
  for (let i = 0; i < items.length; i += SIZE) {
    const n = String(start + Math.floor(i / SIZE)).padStart(3, "0");
    writeFileSync(join(BATCH_DIR, `lv${lv}-${n}.json`), JSON.stringify(items.slice(i, i + SIZE), null, 1));
  }
  console.error(`level ${lv}: ${items.length} từ → ${Math.ceil(items.length / SIZE)} batch`);
  total += items.length;
}
console.error(`Tổng cần dịch: ${total} từ (đã có: ${done.size})`);
