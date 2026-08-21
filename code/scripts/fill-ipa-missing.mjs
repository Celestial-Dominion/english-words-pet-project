// Vá IPA còn TRỐNG trong out/words-stage1.json bằng kaikki.org per-word API (cùng nguồn
// Wiktionary của pipeline — như patch-missing.py nhưng chỉ lấy IPA, sửa tại chỗ stage1).
// Ưu tiên bản US/General American; bọc /…/ theo quy ước bộ từ. Resume an toàn: từ đã có
// IPA thì bỏ qua. Chạy: node scripts/fill-ipa-missing.mjs  → sau đó fill-ipa.mjs (ghép
// từ đa thành phần) rồi build-assemble.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "out");
const PATH = join(OUT, "words-stage1.json");
const words = JSON.parse(readFileSync(PATH, "utf8"));

const missing = words.filter((w) => !w.ipa);
console.log(`Thiếu IPA: ${missing.length} từ`);

const urlsFor = (word) => {
  const w = word.replace(/ /g, "_");
  const forms = [...new Set([w, w[0].toUpperCase() + w.slice(1), w.length <= 4 ? w.toUpperCase() : w])];
  // thư mục kaikki PHÂN BIỆT HOA THƯỜNG: "June" → J/Ju/June.jsonl (như patch-missing.py)
  return forms.map((f) => `https://kaikki.org/dictionary/English/meaning/${f[0]}/${f.slice(0, 2)}/${f}.jsonl`);
};

async function fetchIpa(word) {
  for (const url of urlsFor(word)) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const text = await r.text();
      let first = null;
      for (const line of text.split("\n")) {
        if (!line) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        for (const s of e.sounds ?? []) {
          if (!s.ipa) continue;
          if ((s.tags ?? []).some((t) => /^(us|general-american|genam)$/i.test(t))) return s.ipa;
          first ??= s.ipa;
        }
      }
      if (first) return first;
    } catch {
      /* thử URL kế / bỏ qua */
    }
  }
  return null;
}

const norm = (ipa) => {
  let s = ipa.trim();
  if (s.startsWith("[")) s = `/${s.slice(1).replace(/\]$/, "")}/`;
  if (!s.startsWith("/")) s = `/${s}`;
  if (!s.endsWith("/")) s = `${s}/`;
  return s;
};

let filled = 0;
const failed = [];
const CONC = 6;
for (let i = 0; i < missing.length; i += CONC) {
  const chunk = missing.slice(i, i + CONC);
  const got = await Promise.all(chunk.map((w) => fetchIpa(w.id)));
  chunk.forEach((w, k) => {
    if (got[k]) {
      w.ipa = norm(got[k]);
      filled++;
    } else failed.push(w.id);
  });
  if (i % 60 === 0) console.log(`  ${Math.min(i + CONC, missing.length)}/${missing.length}…`);
}

writeFileSync(PATH, JSON.stringify(words, null, 1));
console.log(`Đã vá: ${filled} · không tìm được: ${failed.length}`);
if (failed.length) console.log(`  còn thiếu: ${failed.slice(0, 40).join(", ")}${failed.length > 40 ? "…" : ""}`);
