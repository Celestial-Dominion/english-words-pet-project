// Kiểm tra vi-done/: độ phủ so với batch, format, và các lỗi máy bắt được
// (vi rỗng, vi trùng nghĩa đầu hàng loạt, thiếu từ so với batch, JSON hỏng).
// Chạy: node scripts/check-vi.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const BATCH_DIR = join(HERE, "vi-batches");
const DONE_DIR = join(HERE, "vi-done");

let batches = 0, doneFiles = 0, wanted = 0, got = 0, missing = [], empty = [], broken = [];
const firstMeaning = new Map(); // nghĩa đầu -> [id] để phát hiện trùng đại trà

for (const f of readdirSync(BATCH_DIR).filter((x) => x.endsWith(".json")).sort()) {
  batches++;
  const batch = JSON.parse(readFileSync(join(BATCH_DIR, f), "utf8"));
  wanted += batch.length;
  const donePath = join(DONE_DIR, f);
  if (!existsSync(donePath)) {
    missing.push(`${f} (CẢ FILE, ${batch.length} từ)`);
    continue;
  }
  doneFiles++;
  let out;
  try {
    out = JSON.parse(readFileSync(donePath, "utf8"));
  } catch (e) {
    broken.push(`${f}: ${e.message}`);
    continue;
  }
  for (const item of batch) {
    const v = out[item.id];
    if (!v || typeof v.vi !== "string") {
      missing.push(`${f}: ${item.id}`);
      continue;
    }
    got++;
    const vi = v.vi.trim();
    if (!vi) empty.push(`${f}: ${item.id}`);
    if (/\n|^\d+[.)]/.test(vi)) broken.push(`${f}: ${item.id} — vi có xuống dòng/đánh số`);
    const first = vi.split(";")[0].trim().toLowerCase();
    if (first) {
      if (!firstMeaning.has(first)) firstMeaning.set(first, []);
      firstMeaning.get(first).push(item.id);
    }
  }
}

console.log(`Batch: ${batches} · done files: ${doneFiles} · từ: ${got}/${wanted}`);
if (missing.length) console.log(`THIẾU (${missing.length}):`, missing.slice(0, 15).join(" | "), missing.length > 15 ? "…" : "");
if (empty.length) console.log(`VI RỖNG (${empty.length}):`, empty.slice(0, 10).join(" | "));
if (broken.length) console.log(`LỖI FORMAT (${broken.length}):`, broken.slice(0, 10).join(" | "));
const dupes = [...firstMeaning.entries()].filter(([, ids]) => ids.length >= 6);
if (dupes.length) {
  console.log(`Nghĩa đầu trùng ≥6 từ (xem có phải dịch ẩu):`);
  for (const [m, ids] of dupes.slice(0, 10)) console.log(`  "${m}" × ${ids.length}: ${ids.slice(0, 8).join(", ")}`);
}
if (!missing.length && !empty.length && !broken.length) console.log("SẠCH ✓");
