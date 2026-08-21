// Sinh manifest audio (text → tên file) cho từ và câu; PHẢI khớp lib/tts.ts + lib/slug.ts.
//   node scripts/build-audio-manifest.mjs [b1 b2 …]   (mặc định: mọi cấp có dữ liệu)
// Ra: out/audio-words.json, out/audio-sentences.json — [{text,file}], đã khử trùng.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug, exampleShardOf, EXAMPLE_SHARDS } from "./lib-levels.mjs";

// ---- bản sao logic lib/slug.ts (node không import .ts trực tiếp) ----
const LIGATURES = { œ: "oe", Œ: "OE", æ: "ae", Æ: "AE" };
const deburr = (s) => s.replace(/[œŒæÆ]/g, (c) => LIGATURES[c] ?? c).normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => deburr(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const hash4 = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36).slice(0, 4).padStart(4, "0");
};
const audioName = (s) => `${slug(s) || "x"}-${hash4(s)}`;
const hashLong = (s) => {
  let h1 = 5381, h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (c + (h2 << 6) + (h2 << 16) - h2) | 0;
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36).padStart(7, "0")}`;
};

const HERE = import.meta.dirname;
const DATA = join(HERE, "..", "public", "data");
const sel = process.argv.slice(2).map((s) => s.toLowerCase());
// Giọng nam cho vai thứ 2 trong hội thoại (chốt 09/08). Giọng chính vẫn là en-US-AriaNeural
// và KHÔNG đổi — chỉ file hội thoại mới dùng giọng này nên không phải build lại audio cũ.
const MALE_VOICE = "en-US-GuyNeural";

const words = [];
const sentences = [];
const seenW = new Set();
const seenS = new Set();

for (const level of [0, 1, 2, 3, 4]) {
  const cefr = levelSlug(level);
  if (sel.length && !sel.includes(cefr)) continue;
  const wordsPath = join(DATA, "words", `${cefr}.json`);
  if (!existsSync(wordsPath)) continue;

  const shards = Array.from({ length: EXAMPLE_SHARDS }, (_, i) => {
    const p = join(DATA, "examples", `${cefr}-${i}.json`);
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  });

  // Câu trong BÀI ĐỌC — reader phát tuần tự từng câu khi bấm "Nghe cả bài".
  const readingsPath = join(DATA, "readings", `${cefr}.json`);
  if (existsSync(readingsPath)) {
    for (const d of JSON.parse(readFileSync(readingsPath, "utf8"))) {
      for (const s of d.sentences) {
        // Hội thoại: lượt của vai 1 đọc bằng GIỌNG NAM → file riêng "-m" + ghi voice vào manifest.
        const male = (s.sp ?? 0) === 1;
        const sf = `${hashLong(s.en)}${male ? "-m" : ""}.mp3`;
        if (!seenS.has(sf)) {
          seenS.add(sf);
          sentences.push({ text: s.en, file: sf, ...(male ? { voice: MALE_VOICE } : {}) });
        }
      }
    }
  }

  for (const w of JSON.parse(readFileSync(wordsPath, "utf8"))) {
    const wf = `${audioName(w.id)}.mp3`;
    if (!seenW.has(wf)) {
      seenW.add(wf);
      words.push({ text: w.id, file: wf });
    }
    for (const ex of shards[exampleShardOf(w.id)][w.id] ?? []) {
      const sf = `${hashLong(ex.en)}.mp3`;
      if (!seenS.has(sf)) {
        seenS.add(sf);
        sentences.push({ text: ex.en, file: sf });
      }
    }
  }
}

writeFileSync(join(HERE, "out", "audio-words.json"), JSON.stringify(words));
writeFileSync(join(HERE, "out", "audio-sentences.json"), JSON.stringify(sentences));
console.error(`Cấp: ${sel.length ? sel.join(",") : "TẤT CẢ"} · từ ${words.length} · câu ${sentences.length}`);
