// Kiểm học liệu nguồn (content/**.txt) — docs/ENGLISH_CONTENT_PLAYBOOK.md §8.
//   node scripts/check-content.mjs [--level b1] [--id rd-b1-…] [--errors] [--draft] [--verbose]
// ✗ = LỖI (exit 1): chặn build.  ! = CẢNH BÁO: đọc và xử lý hoặc chấp nhận có lý do.
// --draft: Story chưa có Video (đang viết dở lô) chỉ là cảnh báo, và chưa bắt buộc câu hỏi đọc hiểu.
import { loadLibrary, loadQuizzes, profileOf } from "./lib/content-model.mjs";
import { LEVEL_KEYS, LEVEL_LABEL, loadVocab, HETERONYMS } from "./lib/en-vocab.mjs";
import { SPEC, TOPICS, GENRES, VOICES, LICENSES } from "./lib/content-spec.mjs";
import { checkQuizzes } from "./lib/quiz-check.mjs";
import { lineTokens, parseBubble, STYLE_KEYS } from "../lib/video.ts";
import { LOOK_IDS, BACKGROUND_IDS, LIT_BACKGROUND_IDS, PROP_IDS, BUBBLE_IDS, BUBBLE_ARG, OUTFIT_IDS, HAT_IDS, HAIR_IDS } from "../lib/video-assets.ts";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY_LEVEL = opt("--level");
const ONLY_ID = opt("--id");
const ERRORS_ONLY = args.includes("--errors");
const DRAFT = args.includes("--draft");
const VERBOSE = args.includes("--verbose");
const REQUIRE_QUIZ = !DRAFT;

// requireQuiz: bài đọc / chương truyện chưa có câu hỏi đọc hiểu là LỖI (mặc định; build cũng chặn). --draft thì chỉ thống kê.
export function runChecks({ draft = false, requireQuiz = true } = {}) {
  const { items, errors: fmtErrors } = loadLibrary();
  const byId = new Map();
  const report = new Map(); // id → {e:[], w:[]}
  const libErr = [...fmtErrors];
  const libWarn = [];
  const R = (id) => {
    if (!report.has(id)) report.set(id, { e: [], w: [] });
    return report.get(id);
  };
  for (const m of items) {
    if (byId.has(m.id)) libErr.push(`id trùng: ${m.id} (${m.file} và ${byId.get(m.id).file})`);
    byId.set(m.id, m);
  }
  const v = loadVocab();

  for (const m of items) {
    const r = R(m.id);
    const err = (s) => r.e.push(s);
    const warn = (s) => r.w.push(s);
    const spec = SPEC[m.level];
    const p = profileOf(m);

    if (!m.title?.en || !m.title?.vi) err("thiếu tiêu đề EN | VI");
    if (m.type !== "video") {
      if (!TOPICS.includes(m.topic)) err(`topic lạ: ${m.topic}`);
      if (m.genre && !GENRES.includes(m.genre)) err(`genre lạ: ${m.genre}`);
    }
    // bài phỏng theo nguồn mở: ghi đủ nguồn — tên gốc | tác giả/tuyển tập, giấy phép, đường dẫn (GitHub hoặc trang gốc)
    if (m.type !== "video" && m.source) {
      if (!m.source.title || !m.source.credit) err(`source: phải dạng "Tên gốc | tác giả, tuyển tập (năm)"`);
      if (!LICENSES[m.source.license]) err(`license lạ: "${m.source.license}" (nhận: ${Object.keys(LICENSES).join(" · ")})`);
      if (!/^https:\/\/[\w.-]+\.[a-z]{2,}\/\S+/.test(m.source.url)) err(`source-url phải là đường dẫn https tới nguồn: ${m.source.url || "(trống)"}`);
    }
    if (m.series && (!m.series.id || !Number.isInteger(m.series.order) || m.series.order < 1)) err(`series phải dạng "id thứ-tự": ${m.header.series}`);
    if (!m.sentences.length) err("không có câu nào");

    // ---- từng câu: tách từ, dấu câu, bản dịch ----
    for (const s of m.sentences) checkSentence(s, m, err, warn);

    // ---- từ vựng theo cấp ----
    const overReal = p.over.filter((o) => !o.mwe);
    const overRate = p.nScored ? overReal.length / p.nScored : 0;
    if (m.level !== "c2" && overRate > spec.over) {
      const top = [...new Set(overReal.map((o) => `${o.t}(${LEVEL_LABEL[o.band]})`))].slice(0, 10);
      (overRate > spec.over * 2 ? err : warn)(`từ vượt ${LEVEL_LABEL[m.band]} ${(overRate * 100).toFixed(1)}% > ${(spec.over * 100).toFixed(1)}%: ${top.join(" ")}`);
    } else if (overReal.length && VERBOSE) warn(`vượt cấp (trong ngưỡng): ${[...new Set(overReal.map((o) => o.t))].slice(0, 10).join(" ")}`);
    const unk = [...new Set(p.unknown)].filter((t) => !m.gloss.has(t.toLowerCase()));
    if (unk.length) warn(`ngoài từ điển: ${unk.slice(0, 12).join(" ")}${unk.length > 12 ? ` …+${unk.length - 12}` : ""} (khai names:/gloss: nếu là tên/thuật ngữ)`);
    const density = p.nScored ? p.bands[m.band] / p.nScored : 0;
    // Truyện kể/hội thoại dùng nhiều từ tần suất cao hơn bài đọc → mốc mật độ bằng 60% mốc bài đọc.
    const minDensity = m.type === "story" ? spec.density * 0.6 : spec.density;
    if (minDensity && density < minDensity && m.type !== "video")
      warn(`tỉ lệ từ đúng cấp ${(density * 100).toFixed(1)}% < ${(minDensity * 100).toFixed(0)}% — bài dễ hơn cấp`);

    // ---- độ dài theo loại ----
    const nw = p.nWords;
    const sentAvg = nw / Math.max(1, m.sentences.length);
    if (m.type === "reading") {
      const [lo, hi] = spec.words;
      if (nw < lo * 0.85 || nw > hi * 1.15) warn(`độ dài ${nw} từ (mốc ${lo}–${hi})`);
      if (sentAvg < spec.sent[0] || sentAvg > spec.sent[1]) warn(`câu TB ${sentAvg.toFixed(1)} từ (mốc ${spec.sent[0]}–${spec.sent[1]})`);
      if (m.band >= 2 && m.paras.length < 2) warn("chỉ một đoạn — bài B1+ nên chia đoạn");
    }
    if (m.type === "story") {
      const [clo, chi] = spec.story.ch;
      if (m.chapters.length < clo || m.chapters.length > chi) warn(`${m.chapters.length} chương (mốc ${clo}–${chi})`);
      const [lo, hi] = spec.story.words;
      if (nw < lo * 0.85 || nw > hi * 1.15) warn(`độ dài ${nw} từ (mốc ${lo}–${hi})`);
      if (!m.summary) err("thiếu summary (tiếng Việt, 1 câu)");
      const dialogue = m.sentences.filter((s) => /["“]/.test(s.en)).length;
      if (dialogue < Math.max(2, m.sentences.length * 0.08)) warn(`ít thoại (${dialogue} câu có lời nói) — truyện cần nhân vật nói với nhau`);
      // Truyện tự biên soạn đi cặp với một Video; truyện phỏng theo nguồn mở (source:) không bắt buộc.
      const vid = byId.get(m.video);
      if (!vid && !m.source) (draft ? warn : err)(`chưa có Video ${m.video}`);
    }
    if (m.type === "video") checkVideo(m, byId, err, warn, v);
  }

  // ---- toàn thư viện theo cấp ----
  for (const lv of LEVEL_KEYS) {
    for (const type of ["reading", "story", "video"]) {
      const list = items.filter((m) => m.level === lv && m.type === type);
      if (!list.length) continue;
      // tiêu đề trùng (cùng loại, mọi cấp)
      const titles = new Map();
      for (const m of items.filter((x) => x.type === type)) {
        const k = m.title?.en?.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
        if (!k) continue;
        if (titles.has(k) && titles.get(k) !== m.id && m.level === lv) R(m.id).e.push(`tiêu đề trùng với ${titles.get(k)}`);
        if (!titles.has(k)) titles.set(k, m.id);
      }
      // mở bài / kết bài lặp khuôn
      const cap = Math.max(2, Math.ceil(list.length * 0.12));
      for (const [label, pick] of [
        ["mở bài", (m) => m.sentences[0]?.en],
        ["kết bài", (m) => m.sentences[m.sentences.length - 1]?.en],
      ]) {
        const groups = new Map();
        for (const m of list) {
          const k = first2(pick(m));
          if (!k) continue;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(m.id);
        }
        for (const [k, ids] of groups) if (ids.length > cap && !STOP_OPEN.has(k)) libWarn.push(`${LEVEL_LABEL[LEVEL_KEYS.indexOf(lv)]} ${type}: ${label} "${k}…" lặp ${ids.length} bài (${ids.slice(0, 4).join(", ")}…)`);
      }
      if (type === "reading" && list.length >= 20) {
        const topics = new Map();
        for (const m of list) topics.set(m.topic, (topics.get(m.topic) ?? 0) + 1);
        for (const [t, n] of topics) if (n / list.length > 0.15) libWarn.push(`${lv} reading: chủ đề ${t} chiếm ${n}/${list.length} (>15%)`);
        if (list.length >= 40 && topics.size < SPEC[lv].topics) libWarn.push(`${lv} reading: chỉ ${topics.size} chủ đề (mốc ≥ ${SPEC[lv].topics})`);
        const fp = list.filter(firstPerson).length;
        const fpMax = LEVEL_KEYS.indexOf(lv) >= 4 ? 0.15 : 0.3;
        if (fp / list.length > fpMax) libWarn.push(`${lv} reading: ngôi thứ nhất ${fp}/${list.length} (> ${fpMax * 100}%)`);
      }
      if (type === "story") {
        const names = new Map();
        const vocab = loadVocab();
        // Bỏ phần tên là từ thường/danh xưng (Street trong "Elm Street", Mrs.) — chỉ đếm tên riêng thật. Các phần của một
        // truyện dài (series) tính là MỘT truyện.
        const generic = (n) => vocab.band.has(n) || /^(mrs?|ms|dr|st)\.?$/.test(n);
        for (const m of list)
          for (const n of [...m.names].map((x) => x.replace(/^\^/, "")).filter((x) => !generic(x))) {
            if (!names.has(n)) names.set(n, []);
            const key = m.series ? `${m.series.id}(chuỗi)` : m.id;
            if (!names.get(n).includes(key)) names.get(n).push(key);
          }
        for (const [n, ids] of names) if (ids.length > 2) libWarn.push(`${lv} story: tên "${n}" dùng ở ${ids.length} truyện (${ids.join(", ")})`);
      }
      if (type === "video") {
        const focus = new Map();
        for (const m of list) {
          const k = m.focus?.title?.toLowerCase();
          if (!k) continue;
          if (focus.has(k)) R(m.id).w.push(`trọng tâm nói trùng với ${focus.get(k)} trong cùng cấp`);
          else focus.set(k, m.id);
        }
      }
    }
  }

  // near-duplicate: 5-gram Jaccard trong cùng loại, cùng cấp hoặc cấp kề
  const sh = new Map(items.map((m) => [m.id, shingles(m.sentences.map((s) => s.en).join(" "))]));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.type !== b.type || Math.abs(a.band - b.band) > 1) continue;
      const J = jaccard(sh.get(a.id), sh.get(b.id));
      if (J >= 0.3) R(b.id).e.push(`gần trùng ${a.id} (Jaccard 5-gram ${J.toFixed(2)})`);
      else if (J >= 0.12) R(b.id).w.push(`khá giống ${a.id} (Jaccard ${J.toFixed(2)})`);
    }
  }
  // Video ↔ Story: không chép câu, có chung nhân vật/từ
  for (const m of items.filter((x) => x.type === "video")) {
    const st = byId.get(m.source);
    if (!st || st.type !== "story") continue;
    const storySet = new Set(st.sentences.map((s) => norm(s.en)));
    for (const l of m.lines) if (storySet.has(norm(l.en)) && l.en.split(" ").length > 4) R(m.id).e.push(`dòng ${l.line}: chép nguyên câu truyện "${l.en.slice(0, 50)}"`);
    const J = jaccard(sh.get(m.id), shingles(st.sentences.map((s) => s.en).join(" ")), true);
    if (J > 0.25) R(m.id).w.push(`thoại trùng truyện ${(J * 100).toFixed(0)}% 5-gram — viết lại bằng khẩu ngữ`);
    const pv = profileOf(m);
    const ps = profileOf(st);
    const shared = [...pv.counts.keys()].filter((k) => v.band.get(k) === m.band && ps.counts.has(k));
    if (shared.length < 3) R(m.id).w.push(`chỉ ${shared.length} từ ${LEVEL_LABEL[m.band]} chung với truyện nguồn (nên ≥ 3)`);
    const castNames = Object.values(m.cast).map((c) => c.name.en.toLowerCase());
    if (!castNames.some((n) => n.split(/\s+/).some((p) => st.names.has(p) || st.names.has(`^${p.replace(/\.$/, "")}`))))
      R(m.id).w.push("không nhân vật nào của truyện xuất hiện trong video");
  }
  // chuỗi (series): thứ tự không trùng, liền 1..n trong cùng loại
  for (const type of ["reading", "story"]) {
    const groups = new Map();
    for (const m of items.filter((x) => x.type === type && x.series)) (groups.get(m.series.id) ?? groups.set(m.series.id, []).get(m.series.id)).push(m);
    for (const [sid, list] of groups) {
      const orders = list.map((m) => m.series.order).sort((a, b) => a - b);
      if (new Set(orders).size !== orders.length) libErr.push(`${type} series ${sid}: thứ tự trùng (${orders.join(",")})`);
      else if (orders.some((o, i) => o !== i + 1)) libWarn.push(`${type} series ${sid}: thứ tự không liền 1..${orders.length} (${orders.join(",")})`);
      if (type === "story" && new Set(list.map((m) => m.level)).size > 1) libErr.push(`story series ${sid}: các phần phải cùng cấp`);
    }
  }
  // câu hỏi đọc hiểu
  const quiz = loadQuizzes();
  const qc = checkQuizzes(items, quiz, { requireQuiz });
  for (const [id, r] of qc.perItem) {
    R(id).e.push(...r.e);
    R(id).w.push(...r.w);
  }
  libErr.push(...qc.libErr);
  libWarn.push(...qc.libWarn);
  return { items, report, libErr, libWarn, quiz, quizCoverage: qc.coverage };
}

const STOP_OPEN = new Set();
const first2 = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function shingles(text) {
  const w = norm(text).split(" ");
  const out = new Set();
  for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(" "));
  return out;
}
// containment=true: tỉ lệ shingle của A nằm trong B (video so với truyện dài hơn nhiều).
function jaccard(a, b, containment = false) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return containment ? inter / a.size : inter / (a.size + b.size - inter);
}
function firstPerson(m) {
  const n = m.sentences.filter((s) => /\b(I|I'm|I've|my|me)\b/.test(s.en)).length;
  return n >= Math.max(2, m.sentences.length * 0.3);
}

const V_ = loadVocab();
const VI_LETTERS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
function checkSentence(s, m, err, warn) {
  const at = `dòng ${s.line}`;
  const en = s.en;
  if (/\s{2,}/.test(en)) err(`${at}: khoảng trắng kép`);
  if (/\s[,.;:!?]/.test(en)) err(`${at}: khoảng trắng trước dấu câu`);
  const glued = /[a-z][,;!?][A-Za-z]|[a-z]{2}\.[A-Z][a-z]/.exec(en);
  if (glued && !/\b(?:[A-Z]\.){2,}|\d[.,]\d/.test(en)) err(`${at}: dính chữ "${glued[0]}"`);
  if (/[“”‘’]/.test(en)) warn(`${at}: dùng nháy thẳng " ' trong nguồn (thống nhất tách từ/TTS)`);
  const q = (en.match(/"/g) ?? []).length;
  if (q % 2 && m.type !== "video") warn(`${at}: số dấu " lẻ (thoại mở ngoặc qua nhiều câu?)`);
  // dòng ngắn không dấu câu (tiêu đề mục, chữ ký, nhãn "Date: …") là bình thường
  if (!/[.!?…:"')\]]$/.test(en) && en.split(/\s+/).length > 8 && !["practical", "letter"].includes(m.genre)) warn(`${at}: câu không kết bằng dấu câu`);
  if (!/^["'(\[]?[A-Z0-9$£€]/.test(en) && !/^\.\.\./.test(en)) warn(`${at}: câu không mở bằng chữ hoa`);
  // bản dịch
  const vi = s.vi;
  const enWords = en.split(/\s+/).length;
  if (!VI_LETTERS.test(vi) && enWords > 3) warn(`${at}: bản dịch không có dấu tiếng Việt?`);
  const ratio = vi.length / Math.max(1, en.length);
  if (enWords > 4 && (ratio < 0.5 || ratio > 2.6)) warn(`${at}: độ dài bản dịch lệch (×${ratio.toFixed(2)})`);
  const nums = (x) => (x.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  const miss = nums(en).filter((n) => !nums(vi).includes(n));
  if (miss.length) warn(`${at}: số ${miss.join(",")} không có trong bản dịch`);
  if (/\?\s*"?$/.test(en) && !/\?/.test(vi)) warn(`${at}: câu hỏi nhưng bản dịch không có "?"`);
  // Còn sót tiếng Anh: chuỗi ≥4 từ ASCII liền nhau mà ≥3 từ là từ tiếng Anh có trong bộ từ và có trong
  // câu gốc (âm tiết Việt không dấu như "xin nghe", "con trai" không tính).
  const enSet = new Set(en.toLowerCase().match(/[a-z]+/g) ?? []);
  for (const m of vi.matchAll(/\b(?:[A-Za-z]{2,}\s+){3,}[A-Za-z]{2,}\b/g)) {
    const ws = m[0].toLowerCase().split(/\s+/);
    const eng = ws.filter((w) => w.length >= 3 && enSet.has(w) && V_.band.has(w));
    if (eng.length >= 3) warn(`${at}: bản dịch còn tiếng Anh "${m[0].slice(0, 40)}"`);
  }
}

function checkVideo(m, byId, err, warn, v) {
  const spec = SPEC[m.level];
  const st = byId.get(m.source);
  if (!m.source) err("thiếu source: st-…");
  else if (!st || st.type !== "story") err(`source không phải truyện có sẵn: ${m.source}`);
  else {
    if (st.level !== m.level) err(`truyện nguồn khác cấp (${st.level})`);
    if (st.video !== m.id) err(`id video phải là ${st.video} (khớp truyện)`);
  }
  if (!m.summary) err("thiếu summary (tiếng Việt)");
  if (!BACKGROUND_IDS.includes(m.scene.background)) err(`bối cảnh lạ: ${m.scene.background}`);
  if (m.scene.weather && !["rain", "snow"].includes(m.scene.weather)) err(`thời tiết lạ: ${m.scene.weather}`);
  const n = m.lines.length;
  const [lo, hi] = spec.video.lines;
  if (n < lo || n > hi + 4) warn(`${n} lượt (mốc ${lo}–${hi})`);
  const propIds = new Set();
  for (const p of m.scene.props) {
    if (!PROP_IDS.includes(p.id)) err(`dòng ${p.line}: đạo cụ lạ ${p.id}`);
    if (propIds.has(p.id)) err(`đạo cụ đặt 2 lần: ${p.id}`);
    propIds.add(p.id);
    if (!Number.isFinite(p.x)) err(`đạo cụ ${p.id}: thiếu x`);
    for (const k of ["from", "until"]) if (p[k] !== undefined && !(Number.isInteger(p[k]) && p[k] >= 0 && p[k] < n)) err(`đạo cụ ${p.id}.${k} ngoài số câu`);
  }
  const cast = m.cast;
  if (!Object.keys(cast).length) err("thiếu cast");
  const accents = new Set();
  for (const [id, c] of Object.entries(cast)) {
    const at = `cast ${id}`;
    if (!LOOK_IDS.includes(c.look)) err(`${at}: look lạ ${c.look}`);
    if (!c.name.en) err(`${at}: thiếu name=`);
    if (!Number.isFinite(c.x)) err(`${at}: thiếu x=`);
    if (!VOICES.has(c.voice)) err(`${at}: giọng lạ/không phải en-US ${c.voice}`);
    if (c.pitch && !/^[+-]\d+Hz$/.test(c.pitch)) err(`${at}: pitch dạng +5Hz`);
    if (c.rate && !/^[+-]\d+%$/.test(c.rate)) err(`${at}: rate dạng -5%`);
    for (const k of ["from", "until"]) if (c[k] !== undefined && !(Number.isInteger(c[k]) && c[k] >= 0 && c[k] < n)) err(`${at}.${k} ngoài số câu`);
    if (c.from !== undefined && c.until !== undefined && c.from > c.until) err(`${at}: from > until`);
    for (const [k, val] of Object.entries(c.style ?? {})) {
      if (!STYLE_KEYS.includes(k)) err(`${at}: style lạ ${k}`);
      if (k === "outfit" && !OUTFIT_IDS.includes(val)) err(`${at}: outfit lạ ${val}`);
      if (k === "hat" && !HAT_IDS.includes(val)) err(`${at}: hat lạ ${val}`);
      if (k === "hair" && !HAIR_IDS.includes(val)) err(`${at}: hair lạ ${val}`);
    }
    if (c.call?.bg && !BACKGROUND_IDS.includes(c.call.bg)) err(`${at}: call.bg lạ ${c.call.bg}`);
    accents.add(c.style?.accent ?? c.look);
  }
  // hai nhân vật cùng đứng trong cảnh quá sát nhau → chồng hình (trẻ con ~200 đơn vị bề ngang)
  const onStage = Object.entries(cast).filter(([, c]) => !c.call);
  for (let i = 0; i < onStage.length; i++)
    for (let j = i + 1; j < onStage.length; j++) {
      const [a, ca] = onStage[i];
      const [b, cb] = onStage[j];
      const overlap = (ca.from ?? 0) <= (cb.until ?? 1e9) && (cb.from ?? 0) <= (ca.until ?? 1e9);
      if (overlap && Math.abs(ca.x - cb.x) < 230) warn(`${a} và ${b} đứng quá sát (x cách ${Math.abs(ca.x - cb.x)} < 230)`);
    }
  const voices = Object.values(cast).map((c) => `${c.voice}|${c.pitch ?? ""}|${c.rate ?? ""}`);
  if (new Set(voices).size < voices.length) err("hai vai cùng giọng + cùng pitch/rate — người nghe không phân biệt được");
  const present = (id, i) => !cast[id] || ((cast[id].from ?? 0) <= i && i <= (cast[id].until ?? 1e9));
  m.lines.forEach((l, i) => {
    const at = `dòng ${l.line}`;
    for (const sp of Array.isArray(l.speaker) ? l.speaker : [l.speaker]) {
      if (!cast[sp]) err(`${at}: người nói lạ ${sp}`);
      else if (!present(sp, i)) err(`${at}: ${sp} nói khi chưa vào / đã rời cảnh`);
    }
    for (const id of Object.keys(l.react ?? {})) if (!present(id, i)) err(`${at}: react ${id} khi không có mặt`);
    if (l.badAnn?.length) err(`${at}: chú thích lạ ${l.badAnn.join(" ")}`);
    if (l.prop && !propIds.has(l.prop)) err(`${at}: @${l.prop} không có trong prop:`);
    if (l.thoughtBubble) {
      const { id, arg } = parseBubble(l.thoughtBubble);
      if (!BUBBLE_IDS.includes(id)) err(`${at}: bong bóng lạ ${id}`);
      const kind = BUBBLE_ARG[id];
      if (kind && !arg) err(`${at}: bong bóng ${id} cần tham số (${kind})`);
      if (kind === "time" && arg && !/^\d{1,2}:\d{2}$/.test(arg)) err(`${at}: clock cần H:MM`);
    }
    if (l.visual?.fade !== undefined && !(l.visual.fade > 0 && l.visual.fade <= 10)) err(`${at}: fade 0–10 s`);
    if (l.visual?.lights && !LIT_BACKGROUND_IDS.includes(m.scene.background)) warn(`${at}: bối cảnh ${m.scene.background} không có hiệu ứng đèn`);
    if (l.visual?.lights && i === 0 && l.visual.fade) warn(`${at}: lights ở câu đầu là trạng thái ban đầu (không có fade) — đặt ở câu sau nếu muốn chuyển dần`);
    if (l.pause !== undefined && !(l.pause >= 0 && l.pause <= 4)) err(`${at}: pause 0–4 s`);
    // heteronym: phải khai IPA theo ngữ cảnh
    for (const tk of lineTokens(l.en)) {
      if (tk.w < 0) continue;
      const lw = tk.t.toLowerCase();
      if (HETERONYMS.has(lw) && !(l.ipaOverride && lw in l.ipaOverride)) err(`${at}: "${tk.t}" đọc tuỳ nghĩa — khai ipa=${lw}:… (hoặc ${lw}:= nếu đúng dạng từ điển)`);
    }
    const nw = l.en.split(/\s+/).length;
    const maxW = [10, 14, 20, 26, 32, 36][m.band];
    if (nw > maxW) warn(`${at}: lượt dài ${nw} từ (mốc ≤ ${maxW}) — tách 2 lượt cho dễ nghe`);
  });
  // từ đích
  const p = profileOf(m);
  if (!m.words.length) warn("chưa khai words: (từ/cụm đích của bài)");
  for (const w of m.words) {
    if (w.free) {
      if (!m.lines.some((l) => l.en.toLowerCase().includes(w.en.toLowerCase()))) err(`cụm "${w.en}" không có trong thoại`);
      continue;
    }
    if (!v.band.has(w.en)) err(`từ đích không có trong bộ từ: ${w.en} (cụm tự do viết "cụm = nghĩa")`);
    else if (!p.counts.has(w.en)) err(`từ đích không xuất hiện trong thoại: ${w.en}`);
  }
  // trọng tâm nói
  if (!m.focus) err("thiếu focus: (trọng tâm nói)");
  else {
    if (!m.focus.pattern || !m.focus.explain || !m.focus.keys.length) err("focus thiếu pattern/explain/keys");
    const hits = m.lines.filter((l) => m.focus.keys.some((k) => l.en.toLowerCase().includes(k.toLowerCase()))).length;
    if (hits === 0) err("không câu nào chứa khoá của focus");
    else if (hits < 2) warn("khoá focus chỉ xuất hiện 1 lần — nên ≥ 2 câu minh hoạ");
  }
}

// ---------- chạy trực tiếp ----------
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { items, report, libErr, libWarn, quizCoverage } = runChecks({ draft: DRAFT, requireQuiz: REQUIRE_QUIZ });
  let nErr = libErr.length;
  let nWarn = libWarn.length;
  const shown = items.filter((m) => (!ONLY_LEVEL || m.level === ONLY_LEVEL) && (!ONLY_ID || m.id === ONLY_ID));
  for (const lv of LEVEL_KEYS) {
    const list = shown.filter((m) => m.level === lv);
    if (!list.length) continue;
    const cnt = (t) => list.filter((m) => m.type === t).length;
    const qc = quizCoverage[lv] ?? { r: 0, rAll: 0, ch: 0, chAll: 0 };
    console.log(`\n== ${LEVEL_LABEL[LEVEL_KEYS.indexOf(lv)]}: ${cnt("reading")} reading · ${cnt("story")} story · ${cnt("video")} video · câu hỏi: ${qc.r}/${qc.rAll} bài đọc, ${qc.ch}/${qc.chAll} chương`);
    for (const m of list) {
      const r = report.get(m.id) ?? { e: [], w: [] };
      nErr += r.e.length;
      nWarn += r.w.length;
      if (!r.e.length && (ERRORS_ONLY || !r.w.length)) continue;
      console.log(`  ${m.id}`);
      for (const e of r.e) console.log(`    ✗ ${e}`);
      if (!ERRORS_ONLY) for (const w of r.w) console.log(`    ! ${w}`);
    }
  }
  for (const e of libErr) console.log(`✗ ${e}`);
  if (!ERRORS_ONLY) for (const w of libWarn) if (!ONLY_LEVEL || w.startsWith(ONLY_LEVEL) || w.toLowerCase().startsWith(ONLY_LEVEL)) console.log(`! ${w}`);
  console.log(`\n${shown.length} bài · ${nErr} lỗi · ${nWarn} cảnh báo`);
  process.exit(nErr ? 1 : 0);
}
