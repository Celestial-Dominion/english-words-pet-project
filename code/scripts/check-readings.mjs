// QA bài đọc đã xuất ra public/data/readings/*.json.
// Chạy: node scripts/check-readings.mjs [--fix]
// Kiểm tra:
//   - khớp số câu EN/VI, không câu rỗng
//   - bản dịch còn sót tiếng Anh (dịch máy hay bỏ nguyên câu khi gặp câu lạ)
//   - độ phủ từ vựng thật so với cấp được gán (tính lại, không tin số cũ)
//   - câu cụt do tách nhầm ở viết tắt ("… U.S." / "Open …")
//   - markup/tên file ảnh từ nguồn Wiki lọt vào nội dung
//   - trùng lặp bài, tiêu đề rỗng, thiếu attribution (src/url)
// --fix: làm sạch rác nguồn, gộp câu bị tách cụt và ghi đè file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug } from "./lib-levels.mjs";
import {
  cleanReadingSourceText,
  hasReadingSourceNoise,
  mergeReadingPairs,
  shouldMergeReadingSentences,
} from "./lib-reading-cleanup.mjs";

const HERE = import.meta.dirname;
const DATA = join(HERE, "..", "public", "data");
const FIX = process.argv.includes("--fix");

const levels = JSON.parse(readFileSync(join(DATA, "word-levels.json"), "utf8"));
const lemmaMap = JSON.parse(readFileSync(join(DATA, "lemma-map.json"), "utf8"));
const knownAt = (lv) => {
  const s = new Set();
  for (const [id, l] of Object.entries(levels)) if (l <= lv) s.add(id);
  return s;
};
const KNOWN = { 1: knownAt(1), 2: knownAt(2), 3: knownAt(3), 4: knownAt(4) };

const norm = (w) => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
const isKnown = (raw, lv) => {
  const w = norm(raw);
  if (!w || /^\d/.test(w)) return true;
  const set = KNOWN[lv];
  if (set.has(w)) return true;
  const lemma = lemmaMap[w];
  if (lemma && set.has(lemma)) return true;
  const base = w.split("'")[0];
  return set.has(base) || (lemmaMap[base] ? set.has(lemmaMap[base]) : false);
};
const coverage = (sentences, lv) => {
  let total = 0, ok = 0;
  for (const s of sentences) {
    const ws = s.split(/\s+/);
    for (let i = 0; i < ws.length; i++) {
      if (!norm(ws[i])) continue;
      if (i > 0 && /^[A-Z]/.test(ws[i]) && !/^[A-Z]+$/.test(ws[i])) continue;
      total++;
      if (isKnown(ws[i], lv)) ok++;
    }
  }
  return total ? ok / total : 0;
};

// dấu hiệu bản dịch còn nguyên tiếng Anh: không có ký tự tiếng Việt có dấu và
// tỉ lệ từ tiếng Anh cao (chấp nhận câu toàn tên riêng/số).
const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const looksEnglish = (en, vi) => {
  if (VI_CHARS.test(vi)) return false;
  const a = en.toLowerCase().split(/\s+/).filter(Boolean);
  const b = new Set(vi.toLowerCase().split(/\s+/).filter(Boolean));
  if (a.length < 4) return false;
  const same = a.filter((w) => b.has(w)).length / a.length;
  return same > 0.6;
};

let totalDocs = 0, totalSent = 0;
const problems = { mismatch: [], empty: [], untranslated: [], lowCov: [], truncated: [], sourceNoise: [], noAttr: [] };
const seenTitle = new Map();
let fixedCount = 0;

for (const lv of [1, 2, 3, 4]) {
  const path = join(DATA, "readings", `${levelSlug(lv)}.json`);
  if (!existsSync(path)) continue;
  const docs = JSON.parse(readFileSync(path, "utf8"));
  let changed = false;

  for (const d of docs) {
    totalDocs++;
    totalSent += d.sentences.length;

    // Hội thoại là nội dung do dự án tự viết → không có nguồn ngoài để ghi công.
    if (!d.speakers && (!d.src || !d.url)) problems.noAttr.push(d.id);
    if (!d.title_vi?.trim()) problems.empty.push(`${d.id} (tiêu đề VI rỗng)`);

    const key = d.title_en.toLowerCase();
    if (seenTitle.has(key)) problems.mismatch.push(`TRÙNG: ${d.id} ≡ ${seenTitle.get(key)}`);
    else seenTitle.set(key, d.id);

    // gộp câu bị tách cụt
    if (FIX) {
      const cleaned = d.sentences
        .map((s) => ({
          ...s,
          en: cleanReadingSourceText(s.en, "en"),
          vi: cleanReadingSourceText(s.vi, "vi"),
        }))
        .filter((s) => s.en && s.vi);
      const merged = mergeReadingPairs(cleaned);
      fixedCount += d.sentences.length - merged.length;
      changed ||= JSON.stringify(merged) !== JSON.stringify(d.sentences);
      d.sentences = merged;
    }

    for (const [i, s] of d.sentences.entries()) {
      if (!s.en?.trim() || !s.vi?.trim()) problems.empty.push(`${d.id}[${i}]`);
      else if (looksEnglish(s.en, s.vi)) problems.untranslated.push(`${d.id}[${i}]: "${s.vi.slice(0, 45)}"`);
      if (hasReadingSourceNoise(s.en) || hasReadingSourceNoise(s.vi)) problems.sourceNoise.push(`${d.id}[${i}]`);
      // chỉ là CỤT khi còn câu sau nối tiếp — câu cuối bài kết thúc bằng "etc." là hợp lệ
      if (!FIX && i < d.sentences.length - 1 && shouldMergeReadingSentences(s.en, d.sentences[i + 1].en)) {
        problems.truncated.push(`${d.id}[${i}]: "…${s.en.slice(-30)}"`);
      }
    }

    const cov = coverage(d.sentences.map((s) => s.en), lv);
    if (cov < 0.88) problems.lowCov.push(`${d.id} (${(cov * 100).toFixed(1)}% ở ${levelSlug(lv)})`);
  }

  if (FIX && changed) writeFileSync(path, JSON.stringify(docs));
}

console.log(`Bài: ${totalDocs} · câu: ${totalSent}`);
const report = (label, arr, n = 8) => {
  if (arr.length) console.log(`${label} (${arr.length}): ${arr.slice(0, n).join(" | ")}${arr.length > n ? " …" : ""}`);
};
report("TRÙNG/LỆCH", problems.mismatch);
report("RỖNG", problems.empty);
report("CHƯA DỊCH (còn nguyên tiếng Anh)", problems.untranslated);
report("CÂU CỤT (tách nhầm ở viết tắt)", problems.truncated, 5);
report("RÁC NGUỒN WIKI", problems.sourceNoise, 8);
report("ĐỘ PHỦ THẤP (<88%)", problems.lowCov, 5);
report("THIẾU ATTRIBUTION", problems.noAttr);
if (FIX) console.log(`Đã gộp ${fixedCount} câu bị tách cụt.`);
if (!Object.values(problems).some((a) => a.length)) console.log("SẠCH ✓");
