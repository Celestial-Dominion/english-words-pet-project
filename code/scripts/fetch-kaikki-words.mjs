// Lấy dữ liệu Wiktionary cho MỘT SỐ từ lẻ trực tiếp từ kaikki.org (không phải quét lại bản dump
// 500MB). Dùng khi bổ sung từ ngoài tập ứng viên ban đầu — ví dụ 223 từ BSL chưa có trong bộ.
//   Nguồn: kaikki.org (Wiktextract, Tatu Ylonen) — CC BY-SA 4.0, đã ghi công ở trang Cài đặt.
// Ra: out/kaikki-extra.jsonl — CÙNG shape với kaikki-filtered.jsonl (w, pos, senses, sounds, forms)
//     nên build-words-stage1 đọc chung được.
// Chạy: node scripts/fetch-kaikki-words.mjs <file-danh-sách.json>
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");
const EXTRA = join(OUT, "kaikki-extra.jsonl");
const KEEP_POS = new Set(["noun", "verb", "adj", "adv", "prep", "conj", "pron", "det", "num", "intj", "phrase", "name", "abbrev"]);

const listFile = process.argv[2] ?? join(OUT, "bsl-missing.json");
const ids = JSON.parse(readFileSync(listFile, "utf8"));

// đã lấy rồi thì bỏ qua (chạy lại an toàn, resume được như build-audio)
const have = new Set();
if (existsSync(EXTRA)) {
  for (const line of readFileSync(EXTRA, "utf8").split("\n")) {
    if (line) have.add(JSON.parse(line).w.toLowerCase());
  }
}

/** kaikki xếp file theo 2 tầng thư mục: /a/ac/accrual.jsonl */
const urlOf = (w) => {
  const a = w[0];
  const b = w.slice(0, 2).padEnd(2, "_");
  return `https://kaikki.org/dictionary/English/meaning/${a}/${b}/${encodeURIComponent(w)}.jsonl`;
};

const compact = (e) => ({
  w: e.word,
  pos: e.pos,
  senses: (e.senses ?? []).slice(0, 6).map((s) => ({
    g: (s.glosses ?? s.raw_glosses ?? []).slice(0, 2),
    tags: (s.tags ?? []).slice(0, 8),
  })),
  sounds: (e.sounds ?? []).filter((s) => s.ipa).slice(0, 12).map((s) => ({ ipa: s.ipa, tags: s.tags ?? [] })),
  forms: (e.forms ?? []).filter((f) => f.form).slice(0, 40).map((f) => ({ f: f.form, tags: (f.tags ?? []).slice(0, 6) })),
});

let ok = 0;
let fail = 0;
const missing = [];
for (const id of ids) {
  if (have.has(id)) continue;
  let text;
  try {
    const res = await fetch(urlOf(id));
    if (!res.ok) throw new Error(String(res.status));
    text = await res.text();
  } catch {
    fail++;
    missing.push(id);
    continue;
  }
  const kept = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    // chỉ giữ entry tiếng Anh, đúng chính tả thường (bỏ danh từ riêng viết hoa)
    if (e.lang_code !== "en" || e.word !== id || !KEEP_POS.has(e.pos)) continue;
    kept.push(JSON.stringify(compact(e)));
  }
  if (!kept.length) {
    fail++;
    missing.push(id);
    continue;
  }
  appendFileSync(EXTRA, `${kept.join("\n")}\n`);
  ok++;
  await new Promise((r) => setTimeout(r, 120)); // lịch sự với kaikki.org
}

if (missing.length) writeFileSync(join(OUT, "kaikki-extra-missing.json"), JSON.stringify(missing, null, 1));
console.error(`kaikki.org: lấy được ${ok} từ · không có/hỏng ${fail}${missing.length ? ` (${missing.slice(0, 12).join(", ")}…)` : ""}`);
