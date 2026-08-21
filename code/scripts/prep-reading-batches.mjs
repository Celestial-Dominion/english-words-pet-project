// Chọn bài đọc từ readings-raw.json rồi chia batch cho agent DỊCH sang tiếng Việt.
//   node scripts/prep-reading-batches.mjs
// Chỉ dịch — câu tiếng Anh giữ NGUYÊN VĂN từ nguồn mở (đó là chỗ tiết kiệm token so với
// tự viết bài mới, đồng thời tiếng Anh là bản ngữ thật chứ không phải do model bịa).
// Ra: scripts/rd-batches/{cefr}-{nn}.json — mỗi batch 8 bài.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug } from "./lib-levels.mjs";
import { isBlocked, BLOCKED_COUNT } from "./lib-blocklist.mjs";

const HERE = import.meta.dirname;
const RAW = join(HERE, "out", "readings-raw.json");
const BATCH_DIR = join(HERE, "rd-batches");
const DONE_DIR = join(HERE, "rd-done");
mkdirSync(BATCH_DIR, { recursive: true });
mkdirSync(DONE_DIR, { recursive: true });

// Số bài giữ lại mỗi cấp — B1 nhiều nhất vì đó là cấp đang học.
const TARGET = { 1: 999, 2: 999, 3: 999, 4: 999 }; // lấy hết kho
const PER_BATCH = 8;

const raw = JSON.parse(readFileSync(RAW, "utf8"));

const done = new Set();
for (const f of existsSync(DONE_DIR) ? readdirSync(DONE_DIR) : []) {
  if (!f.endsWith(".json")) continue;
  try {
    for (const r of JSON.parse(readFileSync(join(DONE_DIR, f), "utf8"))) done.add(r.id);
  } catch { /* file hỏng → làm lại */ }
}

/** id ổn định từ nguồn + tiêu đề (đổi tiêu đề không phá tiến độ đã đọc). */
const slugId = (d) =>
  `${d.src === "wikinews" ? "news" : "wiki"}-${d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;

let total = 0;
let blocked = 0;
for (const level of [1, 2, 3, 4]) {
  const cefr = levelSlug(level);
  // độ phủ cao trước, xen kẽ 2 nguồn cho đa dạng thể loại (bách khoa / tin tức)
  const pool = raw
    .filter((d) => d.level === level)
    .filter((d) => {
      // Chặn vĩnh viễn (readings-blocklist.json): bỏ ngay từ khâu chọn bài, nếu không thì mỗi
      // lần sinh lại batch những bài đã gỡ vì nội dung không phù hợp lại lọt vào kho.
      if (!isBlocked(slugId(d), d.url)) return true;
      blocked++;
      return false;
    })
    .sort((a, b) => b.coverage - a.coverage);
  const wiki = pool.filter((d) => d.src === "simplewiki");
  const news = pool.filter((d) => d.src === "wikinews");
  const mixed = [];
  for (let i = 0; mixed.length < TARGET[level] && (i < wiki.length || i < news.length); i++) {
    if (wiki[i]) mixed.push(wiki[i]);
    if (news[i] && mixed.length < TARGET[level]) mixed.push(news[i]);
  }

  const items = mixed
    .map((d) => ({ id: slugId(d), level, src: d.src, url: d.url, title_en: d.title, sentences: d.sentences, ...(d.topic ? { topic: d.topic } : {}) }))
    .filter((d) => !done.has(d.id));

  // Đánh số TIẾP TỤC sau các batch đã có — nếu đánh lại từ 01 sẽ GHI ĐÈ batch cũ và làm
  // bản dịch trong rd-done/ mồ côi (không còn câu tiếng Anh gốc để ráp).
  let seq = existsSync(BATCH_DIR)
    ? readdirSync(BATCH_DIR)
        .filter((f) => f.startsWith(`${cefr}-`) && f.endsWith(".json"))
        .reduce((m, f) => Math.max(m, Number(f.slice(cefr.length + 1, -5)) || 0), 0)
    : 0;
  for (let i = 0; i < items.length; i += PER_BATCH) {
    seq++;
    const n = String(seq).padStart(2, "0");
    writeFileSync(join(BATCH_DIR, `${cefr}-${n}.json`), JSON.stringify(items.slice(i, i + PER_BATCH), null, 1));
  }
  console.error(`${cefr}: ${items.length} bài → ${Math.ceil(items.length / PER_BATCH)} batch`);
  total += items.length;
}
console.error(`Tổng cần dịch: ${total} bài (đã có ${done.size})`);
if (blocked) console.error(`Chặn ${blocked} bài theo readings-blocklist.json (${BLOCKED_COUNT} mục)`);
