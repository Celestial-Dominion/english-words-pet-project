// Chỉ mục "từ → bài đọc chứa từ đó" cho khối "Gặp lại trong ngữ cảnh" (word-detail) và gợi ý
// bài đọc sau phiên học.
//
// VÌ SAO CẦN: trước đây hai chỗ đó gọi loadReadings() cho MỌI cấp rồi tự quét văn bản — tức là
// tải + parse ~4MB JSON ngay lần đầu bấm-tra một từ. Chỉ mục này sharded như examples nên chỉ
// tốn ~1 shard (vài chục KB).
//
// Chạy SAU build-readings.mjs (phụ thuộc thứ tự bài trong readings-index.json):
//   node scripts/build-word-readings.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug } from "./lib-levels.mjs";

const DATA = join(import.meta.dirname, "..", "public", "data");
const OUT_DIR = join(DATA, "word-readings");
const SHARDS = 8; // PHẢI khớp EXAMPLE_SHARDS + exampleShardOf() trong lib/data.ts
const CAP = 12; // số bài giữ lại cho mỗi từ (cấp thấp trước) — đủ cho gợi ý, chặn phình file

const shardOf = (id) => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % SHARDS;
};

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);

const index = readJson(join(DATA, "readings-index.json"), []);
const levels = readJson(join(DATA, "word-levels.json"), {});
const lemmaMap = readJson(join(DATA, "lemma-map.json"), {});

// bài theo id → vị trí trong readings-index (client tra title/level qua chính index đó)
const posOf = new Map(index.map((m, i) => [m.id, i]));

// Cụm nhiều từ ("give up") không tách được bằng khoảng trắng → khớp riêng theo cụm liền kề.
const multi = new Map(); // "give up" -> số token
for (const id of Object.keys(levels)) {
  const n = id.split(" ").length;
  if (n > 1) multi.set(id, n);
}
const MAX_PHRASE = Math.max(1, ...multi.values());

/** Một token mặt chữ → lemma trong bộ từ (hoặc null). Cùng luật với lookupWord ở lib/data.ts. */
function lemmaOf(tok) {
  if (levels[tok] !== undefined) return tok;
  const m = lemmaMap[tok];
  if (m !== undefined && levels[m] !== undefined) return m;
  const base = tok.split("'")[0];
  if (base && base !== tok) {
    if (levels[base] !== undefined) return base;
    const mb = lemmaMap[base];
    if (mb !== undefined && levels[mb] !== undefined) return mb;
  }
  return null;
}

/** Tập lemma xuất hiện trong một bài. */
function lemmasIn(text) {
  const toks = text
    .toLowerCase()
    .split(/[^a-z'’]+/i)
    .map((t) => t.replace(/’/g, "'"))
    .filter(Boolean);
  const found = new Set();
  for (let i = 0; i < toks.length; i++) {
    // cụm dài trước (longest-match) để "give up" thắng "give"
    for (let n = Math.min(MAX_PHRASE, toks.length - i); n >= 2; n--) {
      const phrase = toks.slice(i, i + n).join(" ");
      if (multi.has(phrase)) found.add(phrase);
    }
    const l = lemmaOf(toks[i]);
    if (l) found.add(l);
  }
  return found;
}

// từ → [vị trí bài] (giữ theo cấp bài tăng dần)
const byWord = new Map();
let docCount = 0;
for (const lv of [1, 2, 3, 4]) {
  const file = join(DATA, "readings", `${levelSlug(lv)}.json`);
  for (const d of readJson(file, [])) {
    const p = posOf.get(d.id);
    if (p === undefined) continue; // bài không có trong index → bỏ (index là nguồn sự thật)
    docCount++;
    for (const w of lemmasIn(d.sentences.map((s) => s.en).join(" "))) {
      if (!byWord.has(w)) byWord.set(w, []);
      byWord.get(w).push([d.level, p]);
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const shards = Array.from({ length: SHARDS }, () => ({}));
let pairs = 0;
for (const [word, list] of byWord) {
  list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ids = list.slice(0, CAP).map(([, p]) => p);
  shards[shardOf(word)][word] = ids;
  pairs += ids.length;
}

for (let n = 0; n < SHARDS; n++) {
  // `n` = số bài lúc build: client so với readings-index.json để phát hiện chỉ mục lỗi thời
  // (vị trí bài đổi sau khi build lại readings) và bỏ qua thay vì hiện nhầm bài.
  writeFileSync(join(OUT_DIR, `${n}.json`), JSON.stringify({ n: index.length, w: shards[n] }, null, 0));
}

console.log(
  `word-readings: ${byWord.size.toLocaleString("vi")} từ · ${pairs.toLocaleString("vi")} liên kết · ` +
    `${docCount.toLocaleString("vi")}/${index.length.toLocaleString("vi")} bài · ${SHARDS} shard`,
);
