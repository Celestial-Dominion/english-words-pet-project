// Ráp bài đọc: rd-batches (câu tiếng Anh gốc) + rd-done (bản dịch) → public/data/readings/*.json
// Chạy: node scripts/build-readings.mjs
// Nguồn mở: Simple English Wikipedia (CC BY-SA), Wikinews (CC BY 2.5) — giữ `src`/`url`
// trong dữ liệu để hiển thị attribution ở cuối bài (yêu cầu của giấy phép).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { levelSlug } from "./lib-levels.mjs";
import { progress } from "./lib-progress.mjs";
import { isBlocked } from "./lib-blocklist.mjs";
import {
  cleanReadingSourceText,
  mergeReadingPairs,
  normalizeReadingSentence,
  normalizeReadingTitle,
} from "./lib-reading-cleanup.mjs";

const HERE = import.meta.dirname;
const DATA = join(HERE, "..", "public", "data");
const BATCH_DIR = join(HERE, "rd-batches");
const DONE_DIR = join(HERE, "rd-done");
mkdirSync(join(DATA, "readings"), { recursive: true });

// bài gốc theo id
const src = new Map();
for (const f of readdirSync(BATCH_DIR).filter((x) => x.endsWith(".json"))) {
  for (const d of JSON.parse(readFileSync(join(BATCH_DIR, f), "utf8"))) src.set(d.id, d);
}

// Nhãn topic MỚI NHẤT lấy từ readings-raw.json (nguồn chuẩn): fetch chuyên đề (--business/--it)
// có thể gắn nhãn cho bài ĐÃ dịch từ trước, mà batch của bài đó thì không được sinh lại →
// đọc topic từ batch là dùng bản đông cứng lúc prep. Ưu tiên nhãn trong raw nếu có.
const rawTopic = new Map();
const RAW_PATH = join(HERE, "out", "readings-raw.json");
if (existsSync(RAW_PATH)) {
  for (const d of JSON.parse(readFileSync(RAW_PATH, "utf8"))) {
    if (d.topic && d.url) rawTopic.set(d.url, d.topic);
  }
}

// Vá thủ công các lỗi nguồn/dịch máy đã được xác minh. Khớp bằng nguyên câu EN để build phải
// dừng nếu nguồn thay đổi, tránh âm thầm áp bản sửa vào nhầm câu hoặc sai phiên bản bài.
const OVERRIDES_PATH = join(HERE, "readings-overrides.json");
const overrideEntries = existsSync(OVERRIDES_PATH)
  ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"))
  : [];
const overrides = new Map(overrideEntries.map((entry) => [entry.id, entry]));
if (overrides.size !== overrideEntries.length) throw new Error("readings-overrides.json có id trùng nhau");
const appliedOverrides = new Set();
const applyOverride = (id, titleEn, titleVi, sentences) => {
  const override = overrides.get(id);
  if (!override) return { titleEn, titleVi, sentences };
  appliedOverrides.add(id);
  const patched = sentences.map((sentence) => ({ ...sentence }));
  for (const correction of override.sentences ?? []) {
    const index = patched.findIndex((sentence) => sentence.en === correction.match_en);
    if (index < 0) throw new Error(`Override lỗi thời: ${id} — không tìm thấy câu "${correction.match_en}"`);
    patched[index] = {
      ...patched[index],
      ...(correction.en ? { en: correction.en } : {}),
      ...(correction.vi ? { vi: correction.vi } : {}),
    };
  }
  return {
    titleEn: override.title_en ?? titleEn,
    titleVi: override.title_vi ?? titleVi,
    sentences: patched,
  };
};

// bản dịch theo id
const vi = new Map();
const doneFiles = existsSync(DONE_DIR) ? readdirSync(DONE_DIR).filter((x) => x.endsWith(".json")) : [];
for (const f of doneFiles) {
  try {
    for (const d of JSON.parse(readFileSync(join(DONE_DIR, f), "utf8"))) {
      if (d?.id && Array.isArray(d.vi)) vi.set(d.id, d);
    }
  } catch (e) {
    console.error(`  file dịch hỏng: ${f} — ${e.message}`);
  }
}

// Máy dịch nhét ký tự vô hình (zero-width space/joiner, BOM, soft hyphen) vào bản VI — mắt
// không thấy nhưng làm hỏng tìm kiếm, TTS và độ dài chuỗi. Chà sạch ở CẢ hai ngôn ngữ.
const INVISIBLE = /[­​‌‍‎‏⁠﻿]/g;
const clean = (s) => String(s ?? "").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim();

// Wikinews mở đầu bằng dòng ngày tháng dính liền câu đầu ("Monday, February 8, 2010 The black
// box…") — đọc rất chướng, cắt bỏ ở CẢ hai ngôn ngữ (bản dịch máy giữ nguyên cấu trúc đó).
// Bản VI có nhiều biến thể hơn hẳn bản EN: "Chủ nhật"/"Chủ Nhật"/"Chúa Nhật", hoa-thường lẫn
// lộn, có/không "ngày", ngày dạng "7 tháng 12 năm 2008" hoặc "19/12/2021", và hay còn dính dấu
// phẩy sau năm ("… năm 2011, công ty…") — không cắt nốt thì câu VI mở đầu bằng dấu phẩy.
// LƯU Ý: không dùng \b cạnh chữ tiếng Việt — \b của JS chỉ hiểu chữ ASCII nên "Thứ\b" luôn hụt.
const DATELINE_EN = /^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})\s+/;
const VI_WEEKDAY = String.raw`(?:Thứ\s*(?:hai|ba|tư|năm|sáu|bảy|[2-7])|Ch[ủú]a?\s*nhật|CN)`;
const VI_DATE = String.raw`(?:ngày\s*)?(?:\d{1,2}\s*tháng\s*\d{1,2}\s*,?\s*năm\s*\d{4}|\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{2,4})`;
const DATELINE_VI = new RegExp(String.raw`^${VI_WEEKDAY}\s*,?\s*${VI_DATE}\s*[,;.]?\s*`, "i");

// Tin Wikinews phần lớn đã cũ (nhiều bài >10 năm). Dateline là chỗ DUY NHẤT còn ngày đăng, nên
// lúc cắt bỏ thì giữ lại thành field `date` ("YYYY-MM-DD") cho UI hiển thị. Bài không có
// dateline (Wikipedia, hội thoại) thì bỏ trống hẳn field, không ghi chuỗi rỗng.
const MONTHS = "january february march april may june july august september october november december".split(" ");
const pad2 = (n) => String(n).padStart(2, "0");
const stripDateline = (sents) => {
  if (!sents.length) return { sentences: sents };
  const [first, ...rest] = sents;
  const m = first.en.match(DATELINE_EN);
  const mi = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  const date = mi >= 0 ? { date: `${m[3]}-${pad2(mi + 1)}-${pad2(m[2])}` } : {};
  const en = first.en.replace(DATELINE_EN, "").trim();
  const vi = first.vi.replace(DATELINE_VI, "").trim();
  return { sentences: en && vi ? [{ ...first, en, vi }, ...rest] : sents, ...date };
};

// Bài trong category "Economy and business" của Wikinews lỏng lẻo: lọt cả tin ca nhạc, thể thao.
// Giữ lại bài thật sự có vốn từ kinh doanh (đếm theo headword BSL, không dùng nhãn cuối cùng
// để tránh phụ thuộc vòng: nhãn được tính TỪ chính kho bài đọc này).
const BSL_FILE = join(HERE, "out", "bsl-101-lemmatized.txt");
const BSL = new Set(
  existsSync(BSL_FILE)
    ? readFileSync(BSL_FILE, "utf8").split(/\r?\n/).map((l) => l.split(",")[0].trim().toLowerCase()).filter(Boolean)
    : [],
);
const MIN_BIZ_WORDS = 3;
const bizWordCount = (sents) => {
  const hit = new Set();
  for (const s of sents) for (const w of s.en.toLowerCase().match(/[a-z']+/g) ?? []) if (BSL.has(w)) hit.add(w);
  return hit.size;
};

const bar = progress(src.size, "ráp bài đọc");
const byLevel = { 1: [], 2: [], 3: [], 4: [] };
const skipped = [];
let blocked = 0;
for (const [id, d] of src) {
  bar.tick(1, `${Object.values(byLevel).flat().length} bài`);
  // Lưới chắn thứ hai cho readings-blocklist.json — phòng khi bài bị chặn lỡ nằm sẵn trong
  // rd-batches (batch cũ, hoặc ai đó thêm tay). Lưới thứ nhất ở prep-reading-batches.mjs.
  if (isBlocked(id, d.url)) { blocked++; continue; }
  const t = vi.get(id);
  if (!t) continue;
  // số câu dịch phải khớp số câu gốc, nếu không bản dịch lệch dòng → bỏ, chờ dịch lại
  if (t.vi.length !== d.sentences.length) {
    skipped.push(`${id} (gốc ${d.sentences.length} câu, dịch ${t.vi.length})`);
    continue;
  }
  const stripped = stripDateline(d.sentences.map((en, i) => ({ en: clean(en), vi: clean(t.vi[i]) })));
  const cleanedSentences = mergeReadingPairs(
    stripped.sentences
      .map((pair) => ({
        ...pair,
        en: cleanReadingSourceText(pair.en, "en"),
        vi: normalizeReadingSentence(cleanReadingSourceText(pair.vi, "vi")),
      }))
      .filter((pair) => pair.en && pair.vi),
  );
  const corrected = applyOverride(
    id,
    clean(d.title_en),
    clean(t.title_vi) || clean(d.title_en),
    cleanedSentences,
  );
  const { date } = stripped;
  const topic = rawTopic.get(d.url) ?? d.topic;
  byLevel[d.level].push({
    id,
    level: d.level,
    title_en: corrected.titleEn,
    title_vi: normalizeReadingTitle(corrected.titleVi),
    sentences: corrected.sentences,
    ...(date ? { date } : {}),
    src: d.src,
    url: d.url,
    ...(topic ? { topic } : {}),
  });
}
bar.done(`${Object.values(byLevel).flat().length} bài có đủ bản dịch`);
if (blocked) console.error(`Chặn ${blocked} bài theo readings-blocklist.json`);
const staleOverrides = overrideEntries.filter((entry) => !appliedOverrides.has(entry.id));
if (staleOverrides.length) {
  throw new Error(`Override không áp dụng được: ${staleOverrides.map((entry) => entry.id).join(", ")}`);
}

// lọc bài gắn nhãn business nhưng nội dung không dính dáng kinh doanh
let offTopicDropped = 0;
for (const lv of Object.keys(byLevel)) {
  byLevel[lv] = byLevel[lv].filter((d) => {
    if (d.topic !== "business" || d.speakers) return true;
    if (bizWordCount(d.sentences) >= MIN_BIZ_WORDS) return true;
    offTopicDropped++;
    return false;
  });
}
if (offTopicDropped) console.error(`Bỏ ${offTopicDropped} bài "kinh tế" không đủ vốn từ kinh doanh`);

// ---- HỘI THOẠI (module Tiếng Anh công việc) ----
// Khác bài đọc: tiếng Anh + bản dịch đều do agent viết (nội dung dạy chính, không dùng máy dịch),
// nguồn ở scripts/dialogues/*.json. Ráp CHUNG vào readings để dùng lại toàn bộ hạ tầng có sẵn:
// reader bấm-tra từ, nghe cả bài, đánh dấu đã đọc, "Gặp lại trong ngữ cảnh", audio manifest.
const DLG_DIR = join(HERE, "dialogues");
let dlgCount = 0;
for (const f of existsSync(DLG_DIR) ? readdirSync(DLG_DIR).filter((x) => x.endsWith(".json")) : []) {
  for (const d of JSON.parse(readFileSync(join(DLG_DIR, f), "utf8"))) {
    if (!byLevel[d.level]) continue;
    byLevel[d.level].push({
      id: d.id,
      level: d.level,
      title_en: d.title_en,
      title_vi: d.title_vi,
      sentences: d.turns.map((t) => ({ en: clean(t.en), vi: clean(t.vi), sp: t.sp ?? 0 })),
      topic: d.topic ?? "business",
      speakers: d.speakers,
    });
    dlgCount++;
  }
}
if (dlgCount) console.error(`Hội thoại: +${dlgCount} bài`);

const index = [];
for (const [lv, arr] of Object.entries(byLevel)) {
  arr.sort((a, b) => a.title_en.localeCompare(b.title_en));
  writeFileSync(join(DATA, "readings", `${levelSlug(Number(lv))}.json`), JSON.stringify(arr));
  for (const d of arr) {
    index.push({
      id: d.id, level: d.level, title_en: d.title_en, title_vi: d.title_vi, n: d.sentences.length,
      ...(d.topic ? { topic: d.topic } : {}),
      ...(d.speakers ? { dialogue: true } : {}),
    });
  }
}
writeFileSync(join(DATA, "readings-index.json"), JSON.stringify(index));

const counts = Object.entries(byLevel).map(([lv, a]) => `${levelSlug(Number(lv))}=${a.length}`).join(" ");
console.error(`Xuất ${index.length} bài (${counts})`);
if (skipped.length) console.error(`LỆCH SỐ CÂU — bỏ ${skipped.length}: ${skipped.slice(0, 5).join(" | ")}`);
