// Ráp câu ví dụ từ ex-done/*.json → public/data/examples/{cefr}-{0..7}.json (8 shard).
// Chạy: node scripts/build-examples.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug, exampleShardOf, EXAMPLE_SHARDS } from "./lib-levels.mjs";
import { progress } from "./lib-progress.mjs";

const HERE = import.meta.dirname;
const DATA = join(HERE, "..", "public", "data");
const DONE_DIR = join(HERE, "ex-done");
mkdirSync(join(DATA, "examples"), { recursive: true });

// gộp mọi bản dịch: id -> [{en, vi}]
const byId = new Map();
const exFiles = (existsSync(DONE_DIR) ? readdirSync(DONE_DIR) : []).filter((f) => f.endsWith(".json"));
const exBar = progress(exFiles.length, "gộp ví dụ");
for (const f of exFiles) {
  exBar.tick(1, `${byId.size} từ`);
  for (const [id, arr] of Object.entries(JSON.parse(readFileSync(join(DONE_DIR, f), "utf8")))) {
    const sentences = (Array.isArray(arr) ? arr : [])
      .map((s) => {
        const [en, vi] = String(s).split("|");
        return en?.trim() && vi?.trim() ? { en: en.trim(), vi: vi.trim() } : null;
      })
      .filter(Boolean);
    if (sentences.length) byId.set(id, sentences);
  }
}

exBar.done(`${byId.size} từ có câu ví dụ`);

let total = 0;
for (const level of [0, 1, 2, 3, 4]) {
  const path = join(DATA, "words", `${levelSlug(level)}.json`);
  if (!existsSync(path)) continue;
  const words = JSON.parse(readFileSync(path, "utf8"));
  const shards = Array.from({ length: EXAMPLE_SHARDS }, () => ({}));
  let n = 0;
  for (const w of words) {
    const ex = byId.get(w.id);
    if (!ex) continue;
    shards[exampleShardOf(w.id)][w.id] = ex;
    n += ex.length;
  }
  shards.forEach((s, i) => writeFileSync(join(DATA, "examples", `${levelSlug(level)}-${i}.json`), JSON.stringify(s)));
  if (n) console.error(`${levelSlug(level)}: ${n} câu`);
  total += n;
}
console.error(`Tổng: ${total} câu / ${byId.size} từ`);
