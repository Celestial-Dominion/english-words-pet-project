// Mô hình bài Ngữ pháp (docs/ENGLISH_GRAMMAR_PLAYBOOK.md) — dùng chung cho check-grammar / build-grammar / test:
//   content/grammar/inventory.json   điểm ngữ pháp A1–C2 + đồ thị tiên quyết / đối chiếu / liên quan
//   content/grammar/curriculum.json  bài: thứ tự, cấp, nhóm, điểm phủ, regex corpus
//   content/grammar/cast.json        cô giáo + nhân vật hội thoại + giọng
//   content/grammar/{cấp}/{id}.txt   nguồn bài (grammar-format.mjs)
// Nguồn → bài (beats + boards + ex) + kế hoạch TTS từng đoạn + lỗi / cảnh báo. Audio + mốc thời gian:
// build-grammar-audio.py; ghép JSON cuối + chỉ mục: build-grammar.mjs.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { listGrammarSources, loadGrammarSource, splitEnVi, splitTail, splitAnn, parseOptions, parseMarks, parseNarr, parseTimeMark, moveTokens, GrammarFormatError } from "./grammar-format.mjs";
import { loadVocab, profile, ipaOf, HETERONYMS, bandOfKey, LEVEL_LABEL } from "./en-vocab.mjs";
import { SPEC, VOICES } from "./content-spec.mjs";
import { parseKv } from "./content-format.mjs";
import { lineTokens, EXPRESSIONS, GESTURES, parseBubble } from "../../lib/video.ts";
import { BACKGROUND_IDS, PROP_IDS, BUBBLE_IDS, LOOK_IDS } from "../../lib/video-assets.ts";
import { SECTION_IDS, ROLES, BLANK } from "../../lib/grammar.ts";

export const ROOT = join(import.meta.dirname, "..", "..");
export const GDIR = join(ROOT, "content", "grammar");
export const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
// Phiên bản thông số audio (giọng, nghỉ, bitrate…) — tăng để build lại toàn bộ audio.
export const AUDIO_VERSION = 1;
// Số từ tối đa một câu ví dụ theo cấp (như lượt thoại Video) — vượt thì cảnh báo.
const LINE_WORDS = { a1: 10, a2: 14, b1: 20, b2: 26, c1: 32, c2: 36 };
// Tên riêng dùng chung (địa danh hay gặp trong ví dụ) — không tính từ vượt cấp.
const GLOBAL_NAMES = ["Anna", "Tom", "Lisa", "Lan", "Hoa", "Minh", "Mai", "An", "Huy", "John", "Kate", "Peter", "Sarah", "David", "Emma", "Maria", "Paul", "Jack", "Lucy", "Vietnam", "Hanoi", "Hue", "Da Nang", "Saigon", "Ho Chi Minh City", "Ha Long Bay", "London", "Paris", "Tokyo", "New York", "Sydney", "Bangkok", "Seoul", "Japan", "China", "Korea", "Thailand", "England", "France", "Australia", "Canada", "America", "Vietnamese", "English", "French", "Japanese", "Chinese", "Korean", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------- dữ liệu nguồn ----------

let CUR = null;
export function curriculum() {
  if (CUR) return CUR;
  const c = JSON.parse(readFileSync(join(GDIR, "curriculum.json"), "utf8"));
  const byId = new Map();
  const nInLevel = {};
  c.lessons.forEach((l, i) => {
    nInLevel[l.lv] = (nInLevel[l.lv] ?? 0) + 1;
    byId.set(l.id, { ...l, idx: i, n: nInLevel[l.lv] });
  });
  CUR = { cats: c.cats, lessons: [...byId.values()], byId };
  return CUR;
}
let INV = null;
export function inventory() {
  if (INV) return INV;
  const d = JSON.parse(readFileSync(join(GDIR, "inventory.json"), "utf8"));
  INV = { points: new Map(d.points.map((p) => [p.id, { pre: [], vs: [], rel: [], ...p }])), probes: d.probes ?? [] };
  return INV;
}
let CAST = null;
export function castData() {
  return (CAST ??= JSON.parse(readFileSync(join(GDIR, "cast.json"), "utf8")));
}
export function sourcePaths() {
  return new Map(listGrammarSources(GDIR).map((s) => [s.id, s]));
}

// Bài chứa điểm (điểm có thể thuộc nhiều bài — lấy bài ĐẦU TIÊN theo thứ tự học).
export function lessonOfPoint() {
  const C = curriculum();
  const m = new Map();
  for (const l of C.lessons) for (const p of l.pts) if (!m.has(p)) m.set(p, l.id);
  return m;
}

// Quan hệ bài ↔ bài suy từ điểm: pre (tiên quyết), vs (đối xứng), rel.
let RELS = null;
export function lessonRelations() {
  if (RELS) return RELS;
  const C = curriculum();
  const P = inventory().points;
  const owner = lessonOfPoint();
  const out = new Map(C.lessons.map((l) => [l.id, { pre: new Set(), vs: new Set(), rel: new Set() }]));
  for (const l of C.lessons) {
    const r = out.get(l.id);
    for (const pid of l.pts) {
      const p = P.get(pid);
      if (!p) continue;
      for (const q of p.pre) if (owner.get(q) && owner.get(q) !== l.id) r.pre.add(owner.get(q));
      for (const q of p.vs) {
        const o = owner.get(q);
        if (o && o !== l.id) {
          r.vs.add(o);
          out.get(o)?.vs.add(l.id);
        }
      }
      for (const q of p.rel) {
        const o = owner.get(q);
        if (o && o !== l.id) {
          r.rel.add(o);
          out.get(o)?.rel.add(l.id);
        }
      }
    }
  }
  RELS = new Map(
    [...out].map(([id, r]) => {
      const idx = (x) => C.byId.get(x)?.idx ?? 0;
      const sort = (s) => [...s].sort((a, b) => idx(a) - idx(b));
      const pre = sort(r.pre);
      const vs = sort(r.vs);
      return [id, { pre, vs, rel: sort(r.rel).filter((x) => !vs.includes(x) && !pre.includes(x)) }];
    }),
  );
  return RELS;
}

/** Kiểm curriculum ↔ inventory → danh sách lỗi (chặn build). */
export function checkCurriculum() {
  const C = curriculum();
  const { points: P } = inventory();
  const errs = [];
  const seen = new Set();
  const lvIdx = (lv) => LEVELS.indexOf(lv);
  for (const p of P.values()) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errs.push(`điểm id sai dạng: ${p.id}`);
    if (!LEVELS.includes(p.lv)) errs.push(`điểm ${p.id}: cấp lạ ${p.lv}`);
    if (!C.cats[p.cat]) errs.push(`điểm ${p.id}: nhóm lạ ${p.cat}`);
    if (!p.name || !p.vi) errs.push(`điểm ${p.id}: thiếu name/vi`);
    if (![1, 2, 3].includes(p.pri)) errs.push(`điểm ${p.id}: pri phải 1|2|3`);
    for (const k of ["pre", "vs", "rel"])
      for (const q of p[k]) {
        if (!P.has(q)) errs.push(`điểm ${p.id}: ${k} lạ ${q}`);
        else if (k === "pre" && lvIdx(P.get(q).lv) > lvIdx(p.lv)) errs.push(`điểm ${p.id}: tiên quyết ${q} ở cấp cao hơn`);
      }
  }
  const owner = lessonOfPoint();
  for (const l of C.lessons) {
    if (seen.has(l.id)) errs.push(`bài id trùng: ${l.id}`);
    seen.add(l.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.id)) errs.push(`bài id sai dạng: ${l.id}`);
    if (!LEVELS.includes(l.lv)) errs.push(`${l.id}: cấp lạ ${l.lv}`);
    if (!C.cats[l.cat]) errs.push(`${l.id}: nhóm lạ ${l.cat}`);
    if (!l.t || !l.en || !l.pts?.length) errs.push(`${l.id}: thiếu t / en / pts`);
    if (l.kind && l.kind !== "contrast") errs.push(`${l.id}: kind lạ ${l.kind}`);
    for (const pid of l.pts ?? []) {
      const p = P.get(pid);
      if (!p) errs.push(`${l.id}: điểm lạ ${pid}`);
      else if (lvIdx(p.lv) > lvIdx(l.lv)) errs.push(`${l.id}: điểm ${pid} (${p.lv}) cao hơn cấp bài`);
      else
        for (const q of p.pre) {
          const o = owner.get(q);
          if (o && C.byId.get(o).idx > l.idx) errs.push(`${l.id}: điểm ${pid} cần ${q} nhưng bài ${o} đứng SAU`);
        }
    }
    if (l.find)
      try {
        new RegExp(l.find, "u");
      } catch (e) {
        errs.push(`${l.id}: regex find lỗi ${e.message}`);
      }
  }
  // thứ tự theo cấp: bài cấp thấp trước
  C.lessons.forEach((l, i) => {
    if (i && lvIdx(l.lv) < lvIdx(C.lessons[i - 1].lv)) errs.push(`${l.id}: cấp ${l.lv} đứng sau bài cấp ${C.lessons[i - 1].lv}`);
  });
  for (const p of P.values()) if (!owner.has(p.id)) errs.push(`điểm chưa thuộc bài nào: ${p.id} (${p.lv})`);
  for (const pr of inventory().probes)
    try {
      new RegExp(pr.find, "u");
    } catch (e) {
      errs.push(`probe ${pr.id}: regex lỗi ${e.message}`);
    }
  return errs;
}

// ---------- tiện ích ----------

const csv = (s) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
// Tên riêng: viết hoa chỉ khớp token viết hoa ("^mia"); viết thường khớp mọi kiểu chữ.
function nameSet(arr) {
  const out = new Set();
  for (const x of arr)
    for (const part of x.split(/[\s-]+/).filter(Boolean)) {
      const low = part.toLowerCase().replace(/'s$/, "");
      out.add(/[A-Z]/.test(part) ? `^${low}` : low);
    }
  return out;
}
const words = (en) =>
  lineTokens(en)
    .filter((t) => t.w >= 0)
    .map((t) => t.t);
// Ký hiệu TTS đọc lung tung trong lời giảng — viết thành chữ, để ký hiệu trên bảng.
const NARR_BAD = /[/→←=<>{}[\]|~^*#_\\]|\s\+\s/;
// Tiếng Anh lọt ra ngoài [[…]] trong lời giảng (giọng Việt sẽ đọc sai): chữ không thể là âm tiết tiếng Việt.
const VI_SYL = /^(ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdđghklmnpqrstvx])?([aăâeêioôơuưy]+)(ch|ng|nh|[cmnpt])?$/u;
const foldVi = (w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const VI_OK = new Set(["ok", "email", "app", "video", "internet", "online", "wifi", "tv", "tivi", "sms", "ceo", "pha", "sô", "radio", "piano", "taxi", "pizza", "menu", "karaoke"]);
export function englishLeak(viText) {
  const out = [];
  for (const m of viText.matchAll(/[A-Za-zÀ-ỹđĐ]+/gu)) {
    const w = m[0];
    if (/[À-ỹđĐ]/u.test(w)) continue; // có dấu Việt → tiếng Việt
    const low = w.toLowerCase();
    if (VI_OK.has(low) || low.length === 1) continue;
    if (/[fjwz]/.test(low) || !VI_SYL.test(foldVi(low))) out.push(w);
  }
  return out;
}

// ---------- nhân vật ----------

const X_BY_COUNT = { 1: [800], 2: [560, 1040], 3: [420, 800, 1180], 4: [330, 650, 970, 1290] };
const addRate = (a, b) => {
  const n = (x) => Number(String(x ?? "+0%").replace("%", "")) || 0;
  const v = n(a) + n(b);
  return `${v >= 0 ? "+" : ""}${v}%`;
};

// ---------- nguồn bài → bài ----------

/**
 * Dựng bài từ nguồn. Trả { lesson, tts, errors, warns, meta, words: [câu tiếng Anh đã đọc] }.
 * tts[i] = { gap, parts: [{ text, voice, rate, pitch, lang }], words?, cues: [[partIdx, target]] } cho beats[i].
 */
export function buildLesson(id, { paths } = {}) {
  const errors = [];
  const warns = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warns.push(m);
  const C = curriculum();
  const { points: P } = inventory();
  const meta = C.byId.get(id);
  if (!meta) return { errors: [`không có trong curriculum: ${id}`], warns };
  const src = (paths ?? sourcePaths()).get(id);
  if (!src) return { errors: [`chưa có nguồn: content/grammar/${meta.lv}/${id}.txt`], warns, meta };
  if (src.level !== meta.lv) err(`nguồn nằm ở thư mục ${src.level} nhưng curriculum ghi ${meta.lv}`);
  let parsed;
  try {
    parsed = loadGrammarSource(src.path);
  } catch (e) {
    if (e instanceof GrammarFormatError) return { errors: [e.message], warns, meta };
    throw e;
  }
  const { header: H, steps, ex: exSrc } = parsed;
  if (parsed.id !== id) err(`id trong file (${parsed.id}) ≠ tên file (${id})`);
  const lv = meta.lv;
  const band = bandOfKey(lv);
  const spec = SPEC[lv];
  const T = castData().teacher;
  const roster = castData().roster;
  const V = loadVocab();

  if (!H.sum) err("thiếu sum:");
  const forms = (H.form ?? []).map(({ value }) => {
    const p = splitEnVi(value);
    return p ? { f: p.en, vi: p.vi } : { f: value.trim() };
  });
  if (!forms.length) err("thiếu form: (công thức cho bảng tóm tắt)");

  // ---- cast ----
  const cast = {};
  const voices = {};
  const castIds = csv((H.cast ?? "").replace(/\s+/g, ","));
  castIds.forEach((raw, i) => {
    const [cid, opt] = raw.split(":");
    const r = roster[cid];
    if (!r) return err(`vai lạ trong cast: ${cid} (xem content/grammar/cast.json)`);
    const call = opt === "call" || opt?.startsWith("call=") ? { ...(opt.startsWith("call=") ? { bg: opt.slice(5) } : {}) } : undefined;
    if (call?.bg && !BACKGROUND_IDS.includes(call.bg)) err(`call bối cảnh lạ: ${call.bg}`);
    if (!LOOK_IDS.includes(r.look)) err(`look lạ của ${cid}: ${r.look}`);
    cast[cid] = { name: { en: r.name, vi: r.vi ?? r.name }, look: r.look, ...(r.style ? { style: r.style } : {}), x: X_BY_COUNT[castIds.length]?.[i] ?? 300 + i * 330, ...(call ? { call } : {}) };
    voices[cid] = { voice: r.voice, rate: addRate(spec.video.rate, r.rate), pitch: r.pitch ?? "+0Hz" };
    if (!VOICES.has(r.voice)) err(`giọng ${r.voice} của ${cid} không thuộc bộ en-US`);
  });
  const vkeys = Object.values(voices).map((v) => `${v.voice}|${v.rate}|${v.pitch}`);
  if (new Set(vkeys).size !== vkeys.length) err("hai vai trùng hẳn giọng (voice+rate+pitch)");
  const baseVoices = Object.values(voices).map((v) => v.voice);
  if (new Set(baseVoices).size !== baseVoices.length) warn("hai vai cùng một giọng gốc — khó phân biệt khi nghe");
  const bg = H.bg?.trim();
  if (bg && !BACKGROUND_IDS.includes(bg)) err(`bối cảnh lạ: ${bg}`);
  if (castIds.length && !bg) err("có cast nhưng thiếu bg: (bối cảnh hội thoại)");
  const props = [];
  for (const { value } of H.prop ?? []) {
    const kv = parseKv(value);
    const pid = kv._[0];
    if (!PROP_IDS.includes(pid)) err(`đạo cụ lạ: ${pid}`);
    const x = Number(kv.x);
    if (!Number.isFinite(x)) err(`đạo cụ ${pid} thiếu x=`);
    props.push({ id: pid, x, ...(kv.y !== undefined ? { y: Number(kv.y) } : {}), ...(kv._.includes("back") ? { back: true } : {}), ...(kv.scale !== undefined ? { scale: Number(kv.scale) } : {}) });
  }

  const names = nameSet([...GLOBAL_NAMES, ...Object.values(cast).map((c) => c.name.en), ...csv(H.names)]);
  const gloss = new Set(csv(H.gloss).flatMap((g) => [g.toLowerCase(), ...g.toLowerCase().split(/\s+/)]));

  // ---- bước → beats + boards ----
  const beats = [];
  const boards = [{ type: "title" }];
  const tts = [];
  const spoken = []; // câu tiếng Anh được đọc (kiểm từ vựng)
  let cur = 0;
  let sec = "hook";
  const seenSec = new Set();
  let secChanged = false;
  let secBoard = 0; // chỉ số bảng đầu tiên dựng trong phần hiện tại
  let prevKind = null;
  let prevWho = null;
  const board = (b) => {
    const key = JSON.stringify(b);
    if (JSON.stringify(boards[cur]) === key) return cur;
    boards.push(b);
    cur = boards.length - 1;
    return cur;
  };
  const teacherEn = { voice: T.voice, rate: spec.rate, pitch: "+0Hz" };
  const narrVoice = { voice: T.narrator.voice, rate: T.narrator.rate, pitch: "+0Hz" };
  const gapFor = (kind, who, pause) => {
    if (!beats.length) return 0.5;
    let g = kind === "n" ? 0.55 : prevKind === "n" ? 0.45 : who === prevWho ? 0.55 : 0.7;
    if (secChanged) g += 0.35;
    if (typeof pause === "number" && Number.isFinite(pause)) g = pause;
    return Math.round(g * 1000) / 1000;
  };

  const checkEn = (en, at) => {
    if (/\s{2,}/.test(en)) err(`${at}: khoảng trắng kép`);
    if (/\s[,.;:!?]/.test(en)) err(`${at}: khoảng trắng trước dấu câu`);
    const glued = /[a-z][,;!?][A-Za-z]|[a-z]{2}\.[A-Z][a-z]/.exec(en);
    if (glued && !/\b(?:[A-Z]\.){2,}|\d[.,]\d/.test(en)) err(`${at}: dính chữ "${glued[0]}"`);
    if (/[“”‘’]/.test(en)) err(`${at}: dùng nháy thẳng " ' trong câu tiếng Anh`);
    if (/[{}[\]]/.test(en)) err(`${at}: còn ký hiệu đánh dấu {…} / […]`);
    if (en.includes(BLANK)) err(`${at}: câu đọc thành tiếng không được có chỗ trống ___`);
  };

  // ann: "happy nod @mug ~clock:7:30 lily:happy pause=0.8 ipa=used:just"
  const parseAnn = (ann, at, allowScene) => {
    const out = { ipa: {} };
    for (const tok of ann.split(/\s+/).filter(Boolean)) {
      if (/^pause=/.test(tok)) out.pause = Number(tok.slice(6));
      else if (/^ipa=/.test(tok)) {
        for (const pair of tok.slice(4).split(",")) {
          const k = pair.indexOf(":");
          if (k < 1) err(`${at}: ipa= sai dạng (từ:IPA)`);
          else out.ipa[pair.slice(0, k).toLowerCase()] = pair.slice(k + 1);
        }
      } else if (allowScene && EXPRESSIONS.includes(tok)) (out.scene ??= {}).expression = tok;
      else if (allowScene && GESTURES.includes(tok)) (out.scene ??= {}).gesture = tok;
      else if (allowScene && tok.startsWith("@")) {
        if (!props.some((p) => p.id === tok.slice(1))) err(`${at}: @${tok.slice(1)} không có trong prop:`);
        (out.scene ??= {}).prop = tok.slice(1);
      } else if (allowScene && tok.startsWith("~")) {
        if (!BUBBLE_IDS.includes(parseBubble(tok.slice(1)).id)) err(`${at}: bong bóng lạ ${tok}`);
        (out.scene ??= {}).bubble = tok.slice(1);
      } else if (allowScene && /^[a-z][a-z0-9-]*:[a-z]+$/.test(tok) && cast[tok.split(":")[0]] && EXPRESSIONS.includes(tok.split(":")[1])) {
        const [who, e] = tok.split(":");
        ((out.scene ??= {}).react ??= {})[who] = e;
      } else err(`${at}: chú thích lạ "${tok}"`);
    }
    return out;
  };

  // Từ nhiều cách đọc mà dạng từ điển (CMU, cách đọc đầu) gần như luôn đúng trong câu ví dụ → không bắt khai.
  const HET_DEFAULT = new Set(["house", "live", "minute", "wind", "closes"]);
  // “used to” / “use to” thói quen quá khứ tự nhận ra (không đứng sau be/get — “was used to pump” là bị động, phải khai tay)
  const BE_GET = new Set(["am", "is", "are", "was", "were", "be", "been", "being", "get", "gets", "got", "getting", "i'm", "you're", "he's", "she's", "it's", "we're", "they're"]);
  const DETS = new Set(["the", "a", "an", "my", "your", "our", "his", "her", "their", "its", "this", "that", "these", "those", "it", "them", "me", "us", "him", "some", "any", "every"]);
  const NOUN_BEFORE = new Set(["the", "a", "an", "no", "of", "in", "for", "any", "some", "much", "its", "my", "your", "our", "his", "her", "their"]);
  const NOUN_STRESS = { contract: "ˈkɑntrækt", contracts: "ˈkɑntrækts", project: "ˈprɑdʒɛkt", projects: "ˈprɑdʒɛkts", record: "ˈrɛkɚd", records: "ˈrɛkɚdz", increase: "ˈɪnkris", decrease: "ˈdikris", object: "ˈɑbdʒɪkt", objects: "ˈɑbdʒɪkts", produce: "ˈproʊdus", progress: "ˈprɑɡrɛs", permit: "ˈpɝmɪt", export: "ˈɛkspɔrt", exports: "ˈɛkspɔrts", import: "ˈɪmpɔrt", imports: "ˈɪmpɔrts", protest: "ˈproʊtɛst", protests: "ˈproʊtɛsts", conflict: "ˈkɑnflɪkt", subject: "ˈsʌbdʒɪkt", subjects: "ˈsʌbdʒɪkts", suspect: "ˈsʌspɛkt", contest: "ˈkɑntɛst", insult: "ˈɪnsʌlt", conduct: "ˈkɑndʌkt", desert: "ˈdɛzɚt" };
  const SUBJ = new Set(["he", "she", "it", "who", "which", "that", "someone", "everyone", "nobody", "one", "family", "friend", "brother", "sister", "mom", "dad"]);
  const GIFT_KIND = new Set(["birthday", "wedding", "christmas", "anniversary", "leaving", "farewell", "retirement", "graduation"]); // … present = quà
  const POSS_DET = new Set(["my", "your", "his", "her", "our", "their", "its", "the", "a", "an", "this", "that", "these", "those", "some", "any", "every", "no", "each"]);
  const autoIpa = (lw, prev, next, next2, prev2) => {
    // be / get used to + V-ing / đại từ / từ hạn định = đã quen, dần quen → /just/ (be used to + nguyên thể = bị động, phải khai)
    if (lw === "used" && next === "to" && BE_GET.has(prev ?? "") && next2 && (/ing$/.test(next2) || DETS.has(next2))) return "just";
    // read: sau modal / to / do → /rid/; sau have / had (phân từ) → /rɛd/
    if (lw === "read" && ["can", "could", "will", "would", "should", "must", "may", "might", "to", "don't", "doesn't", "didn't", "do", "does", "did", "let's", "please", "i'll", "you'll", "we'll", "they'll"].includes(prev ?? "")) return "rid";
    if (lw === "read" && ["have", "has", "had", "having", "i've", "you've", "we've", "they've", "haven't", "hasn't", "hadn't"].includes(prev ?? "")) return "rɛd";
    // trạng từ chen giữa: have only / just / already / never read → /rɛd/; can't even / will just read → /rid/
    if (lw === "read" && ["only", "just", "already", "never", "ever", "recently", "finally", "even", "not", "also", "all"].includes(prev ?? "")) {
      if (["have", "has", "had", "i've", "you've", "we've", "they've", "he's", "she's", "haven't", "hasn't", "hadn't"].includes(prev2 ?? "")) return "rɛd";
      if (["can", "can't", "could", "couldn't", "will", "won't", "would", "should", "must", "may", "might", "to", "don't", "doesn't", "didn't", "please"].includes(prev2 ?? "")) return "rid";
    }
    // đầu câu (mệnh lệnh: Read this…) → /rid/
    if (lw === "read" && prev === undefined) return "rid";
    // câu hỏi đảo: Can I read…? Did you read…? Have you read…?
    if (lw === "read" && ["i", "you", "we", "they", "he", "she"].includes(prev ?? "")) {
      if (["can", "could", "will", "would", "should", "may", "might", "do", "does", "did", "shall"].includes(prev2 ?? "")) return "rid";
      if (["have", "has", "had"].includes(prev2 ?? "")) return "rɛd";
    }
    // close: sau to / modal / trợ động từ / please → động từ /kloʊz/; close to…, so / very / too close → tính từ /kloʊs/
    if (lw === "close" && ["to", "can", "could", "will", "would", "should", "must", "may", "might", "don't", "doesn't", "didn't", "please", "i'll", "we'll", "you'll", "they'll", "let's", "and"].includes(prev ?? "") && next !== "to") return "kloʊz";
    if (lw === "close" && (next === "to" || ["so", "very", "too", "quite", "really", "pretty", "fairly"].includes(prev ?? ""))) return "kloʊs";
    if (lw === "lives" && SUBJ.has(prev ?? "")) return "lɪvz";
    if (lw === "lives" && POSS_DET.has(prev ?? "")) return "laɪvz";
    // “X lives in / with / near…” (sau tên riêng, danh từ) → động từ; danh từ sở hữu đã bắt ở dòng trên
    if (lw === "lives" && ["in", "at", "with", "near", "on", "alone", "here", "there", "abroad", "by", "next", "nearby", "upstairs", "downstairs", "together", "happily"].includes(next ?? "")) return "lɪvz";
    if ((lw === "present" || lw === "presents") && (POSS_DET.has(prev ?? "") || GIFT_KIND.has(prev ?? ""))) return lw === "present" ? "ˈprɛzənt" : "ˈprɛzənts";
    // present sau to / modal → động từ /prɪˈzɛnt/ (trình bày, trao)
    if (lw === "present" && ["to", "can", "could", "will", "would", "should", "must", "may", "might", "i'll", "we'll", "you'll", "they'll", "please"].includes(prev ?? "")) return "prɪˈzɛnt";
    // danh từ nhấn âm đầu (a contract, the record, an increase…) sau từ hạn định / sở hữu
    if (NOUN_STRESS[lw] && (POSS_DET.has(prev ?? "") || /^\d/.test(prev ?? "") || ["new", "big", "small", "huge", "sharp", "slight", "large", "school", "world", "first", "last", "next", "price", "tax", "steady", "rapid", "sudden", "gradual", "dramatic", "significant", "major", "further", "general", "overall"].includes(prev ?? ""))) return NOUN_STRESS[lw];
    // danh từ use: “use of…”, “no use”, “excessive / daily… use” → /jus/
    if (lw === "use" && (next === "of" || ["no", "excessive", "heavy", "daily", "regular", "frequent", "careful", "good", "wide", "widespread", "common", "personal", "public"].includes(prev ?? ""))) return "jus";
    // động từ use / used / uses + từ hạn định, đại từ → /juz/ (danh từ “the use of” đứng sau mạo từ, sở hữu)
    if (DETS.has(next) && !NOUN_BEFORE.has(prev ?? "")) {
      if (lw === "use") return "juz";
      if (lw === "uses") return "ˈjuzɪz";
      if (lw === "used" && !BE_GET.has(prev)) return "juzd";
    }
    // động từ use sau to / modal / trợ động từ / đại từ chủ ngữ (trừ “didn't use to”, “you use to” = thói quen, xử lý dưới)
    const VERB_BEFORE = new Set(["to", "can", "could", "will", "would", "should", "must", "may", "might", "don't", "doesn't", "didn't", "never", "please", "i", "you", "we", "they", "let's", "and", "who", "which", "that", "often", "usually", "always", "sometimes"]);
    if (lw === "use" && VERB_BEFORE.has(prev ?? "") && next !== "to") return "juz";
    if (lw === "used" && next !== "to" && next !== undefined) return "juzd"; // /just/ chỉ có trong “used to”
    if (next !== "to" || BE_GET.has(prev)) return null;
    if (lw === "used") return "just";
    if (lw === "use" && /^(did|didn't|didnt)$/.test(prev ?? "")) return "jus";
    if (lw === "use" && ["you", "i", "we", "they", "he", "she", "it"].includes(prev ?? "")) return "jus";
    return null;
  };
  const ipaFor = (en, override, at) => {
    const ws = words(en);
    const low = ws.map((w) => w.toLowerCase().replace(/’/g, "'"));
    return ws.map((w, i) => {
      const lw = low[i];
      const o = override[lw];
      if (o && o !== "=") return o;
      const auto = o ? null : autoIpa(lw, low[i - 1], low[i + 1], low[i + 2], low[i - 2]);
      if (auto) return auto;
      if (!o && HETERONYMS.has(lw) && !HET_DEFAULT.has(lw)) err(`${at}: từ nhiều cách đọc "${w}" — khai [ipa=${lw}:…] theo nghĩa trong câu (hoặc ${lw}:= nếu đúng dạng từ điển)`);
      return ipaOf(w);
    });
  };

  const narrBeat = (text, bi, at, extra = {}) => {
    const parts = parseNarr(text);
    if (!parts.length) return err(`${at}: lời giảng rỗng`);
    for (const p of parts) {
      if (p.v !== undefined) {
        if (NARR_BAD.test(p.v)) err(`${at}: lời giảng có ký hiệu TTS đọc sai (viết thành chữ): "${p.v.trim().slice(0, 50)}"`);
        const leak = englishLeak(p.v);
        if (leak.length) warn(`${at}: nghi tiếng Anh ngoài [[…]] (giọng Việt đọc sai): ${leak.slice(0, 6).join(" ")}`);
      } else if (/[{}]/.test(p.e)) err(`${at}: [[…]] không được chứa {…}`);
    }
    if (text.length > 300) warn(`${at}: lời giảng dài ${text.length} ký tự — tách thành 2 đoạn cho dễ theo`);
    const i = beats.length;
    beats.push({ k: "n", sec, parts: parts.map((p) => (p.v !== undefined ? { v: p.v } : { e: p.e })), b: bi, ...extra });
    const cues = [];
    parts.forEach((p, pi) => {
      if (p.e === undefined) return;
      const tgt = cueTarget(boards[bi], p.e, beats);
      if (tgt >= 0) cues.push([pi, tgt]);
    });
    tts.push({
      gap: gapFor("n", null, extra.pause),
      // mảnh Việt mở bằng dấu câu (", rồi…") → bỏ dấu ở đầu cho TTS (bản hiện giữ nguyên)
      parts: parts.map((p) => (p.v !== undefined ? { text: p.v.trim().replace(/^[,.;:!?…]+\s*/, ""), ...narrVoice, lang: "vi" } : { text: p.e, ...teacherEn, lang: "en" })),
      cues,
    });
    delete beats[i].pause;
    secChanged = false;
    prevKind = "n";
    prevWho = null;
    return i;
  };

  const lineBeat = (raw, vi, bi, at, { who, note, bad, ann = "" } = {}) => {
    if (/[A-Za-z]\{|\}[A-Za-z]|\s\{'/.test(raw)) err(`${at}: vùng nhấn {…} cắt giữa một từ — bao trọn cả từ`);
    const { text: en, hl } = parseMarks(raw);
    for (const [, , r] of hl) if (!ROLES.includes(r)) err(`${at}: vai nhấn lạ "${r}"`);
    checkEn(en, at);
    if (!vi) err(`${at}: thiếu nghĩa Việt`);
    else if (/[[\]{}]/.test(vi)) err(`${at}: nghĩa Việt còn ký hiệu […] / {…} — gộp chú thích vào MỘT cặp [...] cuối dòng`);
    if (!/^["'(]?[A-Z0-9]/.test(en)) warn(`${at}: câu không mở bằng chữ hoa`);
    if (who && !cast[who]) err(`${at}: người nói "${who}" không có trong cast:`);
    const a = parseAnn(ann, at, !!who);
    const ipa = ipaFor(en, a.ipa, at);
    const nw = words(en).length;
    if (nw > LINE_WORDS[lv] + 4) warn(`${at}: câu dài ${nw} từ (cấp ${lv.toUpperCase()} ≲ ${LINE_WORDS[lv]})`);
    const i = beats.length;
    beats.push({
      k: "e",
      sec,
      en,
      vi,
      ipa,
      ...(hl.length ? { hl } : {}),
      ...(who ? { who } : {}),
      ...(note ? { note } : {}),
      ...(bad ? { bad } : {}),
      ...(a.scene ? { ann: a.scene } : {}),
      b: bi,
    });
    const voice = who ? voices[who] ?? teacherEn : teacherEn;
    tts.push({ gap: gapFor("e", who ?? null, a.pause), parts: [{ text: en, ...voice, lang: "en" }], words: words(en), cues: [] });
    spoken.push(en);
    secChanged = false;
    prevKind = "e";
    prevWho = who ?? null;
    return i;
  };

  // gom các bước cùng nhóm liền nhau (vs · tl · th/tb · pron · rank)
  const GROUP = { vs: "vs", tl: "tl", th: "tb", tb: "tb", pron: "pron", rank: "rank" };
  for (let si = 0; si < steps.length; si++) {
    const st = steps[si];
    const at = `dòng ${st.n}`;
    if (st.kind === "sec") {
      if (!SECTION_IDS.includes(st.sec)) err(`${at}: phần lạ #${st.sec} (${SECTION_IDS.join(" ")} · practice)`);
      else {
        if (seenSec.has(st.sec)) warn(`${at}: phần #${st.sec} xuất hiện lại`);
        seenSec.add(st.sec);
        sec = st.sec;
        secChanged = beats.length > 0;
        secBoard = boards.length;
      }
      continue;
    }
    if (st.kind === "narr") {
      const { body, ann } = splitAnn(st.text);
      const a = ann ? parseAnn(ann, at, false) : {};
      // lời giảng mở một phần mới → thẻ tên phần (không để lời giảng "Ý nghĩa" nói trên cảnh hội thoại của phần trước)
      const bi = sec === "recap" ? (boards[cur]?.type === "recap" ? cur : board({ type: "recap" })) : beats.length && cur < secBoard ? board({ type: "title", sec }) : cur;
      narrBeat(body, bi, at, a.pause !== undefined ? { pause: a.pause } : {});
      continue;
    }
    if (st.kind === "line") {
      const { body, ann } = splitAnn(st.body);
      const [main, note] = splitTail(body);
      const p = splitEnVi(main);
      if (!p) {
        err(`${at}: câu ví dụ phải dạng "EN | VI"`);
        continue;
      }
      let bi;
      if (st.keep) {
        const t = boards[cur]?.type;
        if (!["timeline", "formula", "table", "sound", "move", "title", "recap"].includes(t)) err(`${at}: "+" chỉ giữ được bảng trục thời gian / công thức / bảng / phát âm / di chuyển (bảng hiện tại: ${t})`);
        bi = cur;
      } else bi = board({ type: "line", beat: beats.length });
      lineBeat(p.en, p.vi, bi, at, { note, ann });
      continue;
    }
    if (st.kind === "talk") {
      const { body, ann } = splitAnn(st.body);
      const p = splitEnVi(body);
      if (!p) {
        err(`${at}: lượt thoại phải dạng "vai: EN | VI [chú thích]"`);
        continue;
      }
      lineBeat(p.en, p.vi, board({ type: "scene" }), at, { who: st.who, ann });
      continue;
    }
    if (st.kind === "quiz") {
      const { body: qbody, ann: qann } = splitAnn(st.body);
      const k = qbody.indexOf(" => ");
      if (k < 0) {
        err(`${at}: thử nhớ lại phải dạng "? câu hỏi => English | VI"`);
        continue;
      }
      const q = qbody.slice(0, k).trim();
      const p = splitEnVi(qbody.slice(k + 4));
      if (!p) {
        err(`${at}: đáp án thử nhớ lại phải dạng "English | VI"`);
        continue;
      }
      const bi = board({ type: "quiz", q: parseNarr(q).map((x) => x.v ?? x.e).join(""), beat: beats.length + 1 });
      narrBeat(q, bi, at, { hold: 1 });
      lineBeat(p.en, p.vi, board({ type: "line", beat: beats.length }), at, { ann: qann });
      continue;
    }
    // bước có khoá
    const key = st.key;
    if (key === "f" || key === "f2") {
      const [body, cap] = splitTail(st.body);
      const row = body.split(" + ").map((c) => c.trim()).filter(Boolean).map((c) => {
        const m = /^\[([^[\]]*)\]([,.;:!?…]*)$/.exec(c); // [chip] có thể kèm dấu câu ngay sau: [When],
        return m ? { x: (m[1].trim() + m[2]), en: 1 } : { x: c };
      });
      if (!row.length) err(`${at}: công thức rỗng`);
      for (const c of row) if (/[[\]]/.test(c.x)) err(`${at}: ô công thức “${c.x}” lệch ngoặc [ ] — mỗi ô tách bằng “ + ”, [..] phải bao trọn một ô`);
      if (key === "f2") {
        const b = boards[cur];
        if (b?.type !== "formula" || b.rows.length > 1) err(`${at}: f2: phải đi ngay sau f:`);
        else {
          boards[cur] = { ...b, rows: [...b.rows, row], ...(cap ? { cap } : {}) };
        }
      } else board({ type: "formula", rows: [row], ...(cap ? { cap } : {}) });
      const next = steps[si + 1];
      if (!(next?.kind === "narr" || (next?.kind === "step" && next.key === "f2") || (next?.kind === "line" && next.keep)))
        warn(`${at}: công thức nên có lời giảng ngay sau (> …)`);
      continue;
    }
    if (key === "x") {
      const k1 = st.body.indexOf(" => ");
      const k2 = st.body.indexOf(" >> ");
      if (k1 < 0 || k2 < 0 || k2 < k1) {
        err(`${at}: lỗi thường gặp phải dạng "x: câu sai => câu đúng | VI >> lời giải thích"`);
        continue;
      }
      const badRaw = st.body.slice(0, k1).trim();
      const { body: goodRaw, ann: xAnn } = splitAnn(st.body.slice(k1 + 4, k2));
      const p = splitEnVi(goodRaw);
      const expl = st.body.slice(k2 + 4).trim();
      if (!p || !expl) {
        err(`${at}: lỗi thường gặp thiếu câu đúng / nghĩa / lời giải thích`);
        continue;
      }
      const badM = parseMarks(badRaw);
      if (badM.text === parseMarks(p.en).text) err(`${at}: câu sai trùng câu đúng`);
      const bi = board({ type: "fix", beat: beats.length + 1 });
      narrBeat(expl, bi, at);
      lineBeat(p.en, p.vi, bi, at, { ann: xAnn, bad: { en: badM.text, ...(badM.hl.length ? { hl: badM.hl } : {}) } });
      continue;
    }
    if (key === "mv") {
      const k = st.body.indexOf(" => ");
      if (k < 0) {
        err(`${at}: di chuyển từ phải dạng "mv: trước => sau"`);
        continue;
      }
      const from = moveTokens(st.body.slice(0, k));
      const to = moveTokens(st.body.slice(k + 4));
      if (from.length < 2 || to.length < 2) err(`${at}: di chuyển cần ≥2 khối mỗi bên`);
      board({ type: "move", from, to });
      if (steps[si + 1]?.kind !== "narr") warn(`${at}: di chuyển từ nên có lời giảng ngay sau`);
      continue;
    }
    const g = GROUP[key];
    if (!g) {
      err(`${at}: bước lạ ${key}:`);
      continue;
    }
    // gom nhóm
    const group = [st];
    while (steps[si + 1]?.kind === "step" && GROUP[steps[si + 1].key] === g) group.push(steps[++si]);
    if (g === "vs") {
      const items = group.map((x) => {
        const [body, label] = splitTail(x.body);
        const { body: b2, ann } = splitAnn(body);
        return { p: splitEnVi(b2), label, ann, n: x.n };
      });
      if (items.length < 2) err(`${at}: vs cần ≥2 câu liền nhau`);
      for (const x of items) if (/[[\]{}]/.test(x.label ?? "")) err(`dòng ${x.n}: nhãn vs còn […] — chú thích đặt TRƯỚC “||”`);
      if (items.some((x) => !x.p)) {
        err(`${at}: vs phải dạng "vs: EN | VI || nhãn"`);
        continue;
      }
      const labels = items.map((x) => x.label);
      const first = beats.length;
      const bi = board({ type: "pair", beats: items.map((_, k) => first + k), ...(labels.some(Boolean) ? { labels } : {}) });
      items.forEach((x) => lineBeat(x.p.en, x.p.vi, bi, `dòng ${x.n}`, { ann: x.ann }));
      continue;
    }
    if (g === "tl") {
      const marks = group.map((x) => {
        const m = parseTimeMark(x.body);
        if (!m) err(`dòng ${x.n}: mốc trục thời gian phải dạng "tl: -2..0 nhãn | nghĩa" (hoặc now, ~ = tiếp diễn)`);
        else if (Math.abs(m.at) > 3 || Math.abs(m.to ?? 0) > 3) err(`dòng ${x.n}: mốc ngoài khoảng −3…3`);
        return m;
      }).filter(Boolean);
      board({ type: "timeline", marks });
      continue;
    }
    if (g === "tb") {
      let head;
      const rows = [];
      for (const x of group) {
        const cells = x.body.split(" | ").map((c) => c.trim());
        if (x.key === "th") {
          if (head || rows.length) err(`dòng ${x.n}: th: phải là dòng đầu của bảng`);
          head = cells;
        } else rows.push(cells);
      }
      const w = head?.length ?? rows[0]?.length ?? 0;
      if (!rows.length) err(`${at}: bảng không có dòng tb:`);
      if (rows.some((r) => r.length !== w)) err(`${at}: các dòng bảng không cùng số cột`);
      if (w > 4) warn(`${at}: bảng ${w} cột — khó đọc trên điện thoại`);
      board({ type: "table", ...(head ? { head } : {}), rows });
      if (steps[si + 1]?.kind !== "narr" && !(steps[si + 1]?.kind === "line" && steps[si + 1].keep)) warn(`${at}: bảng nên có lời giảng ngay sau`);
      continue;
    }
    if (g === "pron") {
      const rows = group.map((x) => {
        const c = x.body.split(" | ").map((s) => s.trim());
        if (c.length < 2 || c.length > 3) err(`dòng ${x.n}: pron phải dạng "dạng viết | dạng nói | IPA" (IPA có thể bỏ)`);
        const [a, b, ipa] = c;
        const auto = ipa ?? (b && !b.startsWith("/") ? ipaOf(b) : ipaOf(a));
        if (!auto) err(`dòng ${x.n}: không tra được IPA cho "${b ?? a}" — ghi tay cột thứ ba`);
        return { a, ...(b ? { b } : {}), ipa: (auto ?? "").replace(/^\/|\/$/g, "") };
      });
      board({ type: "sound", rows });
      continue;
    }
    if (g === "rank") {
      const items = [];
      const bi0 = boards.length;
      const rankBoard = { type: "rank", items };
      boards.push(rankBoard);
      cur = bi0;
      for (const x of group) {
        const { body: rBody, ann: rAnn } = splitAnn(x.body);
        const c = rBody.split(" | ").map((s) => s.trim());
        const grade = c[0];
        if (!["best", "ok", "odd", "bad"].includes(grade) || c.length < 2) {
          err(`dòng ${x.n}: rank phải dạng "rank: best|ok|odd|bad | EN | VI"`);
          continue;
        }
        const en = c[1];
        const vi = c[2] ?? "";
        const it = { en: parseMarks(en).text, ...(vi ? { vi } : {}), g: grade };
        if (grade === "best" || grade === "ok") {
          if (!vi) err(`dòng ${x.n}: câu ${grade} cần nghĩa Việt`);
          it.beat = beats.length;
          lineBeat(en, vi, bi0, `dòng ${x.n}`, { ann: rAnn });
        } else checkEn(it.en, `dòng ${x.n}`);
        items.push(it);
      }
      if (!items.some((x) => x.g === "best")) err(`${at}: rank cần ít nhất một câu best`);
      continue;
    }
  }

  // ---- hội thoại: ai có mặt ở khúc nào, đứng đâu ----
  // Chỗ đứng cố định cả bài theo thứ tự xuất hiện (người 1 trái, người 2 phải, người 3 vào giữa…); mỗi vai bước vào
  // ngay trước câu đầu tiên mình nói và rời cảnh sau khúc cuối cùng mình có mặt (khúc = các câu thoại liền trong một phần).
  const dlg = beats.filter((b) => b.k === "e" && b.who);
  if (dlg.length) {
    const blocks = [];
    dlg.forEach((b, li) => {
      const last = blocks[blocks.length - 1];
      if (!last || last.sec !== b.sec) blocks.push({ sec: b.sec, from: li, to: li, who: [] });
      const bl = blocks[blocks.length - 1];
      bl.to = li;
      if (!bl.who.includes(b.who)) bl.who.push(b.who);
    });
    const order = [];
    for (const b of dlg) if (!order.includes(b.who)) order.push(b.who);
    const room = order.filter((m) => !cast[m]?.call);
    const hasCall = order.some((m) => cast[m]?.call);
    const SLOTS = hasCall ? { 1: [1000], 2: [760, 1180], 3: [640, 1280, 960] } : { 1: [800], 2: [560, 1040], 3: [420, 1180, 800], 4: [330, 1290, 650, 970] };
    const xs = SLOTS[room.length];
    if (!xs) err(`hội thoại có ${room.length} người trong cảnh — tối đa ${hasCall ? 3 : 4}`);
    room.forEach((m, i) => (cast[m].x = xs?.[i] ?? 300 + i * 330));
    for (const [k, c] of Object.entries(cast)) {
      if (c.call) c.x = 250;
      const bs = blocks.filter((bl) => bl.who.includes(k));
      if (!bs.length) {
        warn(`vai ${k} có trong cast nhưng không nói câu nào`);
        continue;
      }
      if (bs[0].from > 0) c.from = bs[0].from;
      if (bs[bs.length - 1].to < dlg.length - 1) c.until = bs[bs.length - 1].to;
    }
  } else if (castIds.length) warn("có cast nhưng không có câu hội thoại");

  // ---- kiểm nội dung ----
  const eBeats = beats.filter((b) => b.k === "e");
  const secs = new Set(beats.map((b) => b.sec));
  if (!secs.has("form")) warn("thiếu phần #form");
  if (!secs.has("examples") && !secs.has("real")) warn("thiếu phần #examples / #real");
  if (!secs.has("mistakes")) warn("thiếu phần #mistakes");
  if (!secs.has("recall")) warn("thiếu phần #recall (thử nhớ lại)");
  if (!secs.has("recap")) warn("thiếu phần #recap");
  if (!dlg.length) warn("không có hội thoại (mẫu trong lời nói thật)");
  if (eBeats.length < 8) warn(`ít câu ví dụ (${eBeats.length})`);
  const plain = eBeats.filter((b) => b.sec !== "recall" && !b.bad);
  const dup = plain.map((b) => b.en).filter((s, i, a) => a.indexOf(s) !== i);
  if (dup.length) warn(`câu lặp trong bài: ${[...new Set(dup)].join(" · ")}`);
  // bảng công thức / di chuyển / bảng / phát âm không có lời giảng nào → bảng chết (không hiện ra)
  const used = new Set(beats.map((b) => b.b));
  boards.forEach((b, k) => {
    if (k && !used.has(k)) err(`bảng ${k} (${b.type}) không có đoạn nào hiện nó — thêm lời giảng / câu ví dụ ngay sau`);
  });

  // ---- bài tập ----
  const ex = buildExercises(exSrc, beats, { err, warn, spoken });
  if (ex.length < 5) warn(`ít bài tập (${ex.length})`);
  const kinds = new Set(ex.map((e) => e.k));
  if (kinds.size < 3) warn(`bài tập ít dạng (${[...kinds].join(", ")})`);

  // ---- từ vựng ----
  const lw = [];
  for (const w of csv(H.words)) {
    if (!V.band.has(w)) {
      err(`words: "${w}" không có trong bộ từ (headword)`);
      continue;
    }
    lw.push({ id: w, ipa: ipaOf(w), vi: String(V.words.get(w)?.meaning_vi ?? "").trim(), level: V.band.get(w) });
  }
  const prof = profile(spoken, { names, level: band });
  const over = prof.over.filter((o) => !o.mwe && !gloss.has(o.lemma) && !gloss.has(o.t.toLowerCase()));
  const overRate = prof.nScored ? over.length / prof.nScored : 0;
  if (lv !== "c2" && over.length && overRate > spec.over) warn(`từ vượt ${LEVEL_LABEL[band]} ${(overRate * 100).toFixed(1)}%: ${[...new Set(over.map((o) => `${o.t}(${LEVEL_LABEL[o.band]})`))].slice(0, 10).join(" ")}`);
  const unk = [...new Set(prof.unknown)].filter((t) => !gloss.has(t.toLowerCase()));
  if (unk.length) warn(`ngoài từ điển: ${unk.slice(0, 10).join(" ")} (khai names:/gloss: nếu là tên/thuật ngữ)`);

  const lesson = {
    id,
    lv,
    n: meta.n,
    cat: meta.cat,
    t: meta.t,
    en: meta.en,
    ...(meta.reg ? { reg: meta.reg } : {}),
    ...(meta.kind ? { kind: meta.kind } : {}),
    sum: H.sum ?? "",
    forms,
    pts: meta.pts.map((p) => ({ id: p, name: P.get(p)?.name ?? p, vi: P.get(p)?.vi ?? "" })),
    ...(Object.keys(cast).length ? { cast } : {}),
    ...(bg ? { bg } : {}),
    ...(props.length ? { props } : {}),
    beats,
    boards,
    ex,
    ...(lw.length ? { words: lw } : {}),
  };
  return { lesson, tts, errors, warns, meta, spoken };
}

// Chỗ trên bảng ứng với mảnh tiếng Anh trong lời giảng (−1 = không có).
function cueTarget(b, frag, beats) {
  if (!b) return -1;
  const f = frag.toLowerCase().replace(/[.,!?]+$/, "").trim();
  if (!f) return -1;
  const eq = (x) => String(x ?? "").toLowerCase().replace(/[.,!?]+$/, "").trim() === f;
  const has = (x) => String(x ?? "").toLowerCase().includes(f);
  switch (b.type) {
    case "line": {
      const L = beats[b.beat];
      if (!L?.hl) return -1;
      return L.hl.findIndex(([a, e]) => eq(L.en.slice(a, e)));
    }
    case "formula": {
      const flat = b.rows.flat();
      const k = flat.findIndex((c) => c.en && eq(c.x));
      return k >= 0 ? k : flat.findIndex((c) => c.en && c.x.toLowerCase().split(/\s*\/\s*/).some((y) => y === f));
    }
    case "pair": {
      const hits = b.beats.map((bi, k) => (has(beats[bi]?.en) ? k : -1)).filter((k) => k >= 0);
      return hits.length === 1 ? hits[0] : -1;
    }
    case "table":
      return b.rows.findIndex((r) => r.some((c) => eq(c) || c.toLowerCase().split(/\s*\/\s*/).some((y) => y === f)));
    case "sound":
      return b.rows.findIndex((r) => eq(r.a) || eq(r.b));
    case "timeline":
      return b.marks.findIndex((m) => eq(m.label));
    case "move":
      return b.to.findIndex((t) => eq(t));
    case "rank": {
      const hits = b.items.map((it, k) => (has(it.en) ? k : -1)).filter((k) => k >= 0);
      return hits.length === 1 ? hits[0] : -1;
    }
    default:
      return -1;
  }
}

export function hashStr(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}
function pickStable(arr, n, seed) {
  return [...arr].sort((a, b) => hashStr(seed + a) - hashStr(seed + b)).slice(0, n);
}

// Nguồn bài tập → bài tập. Tự thêm "nghe rồi chọn" và "câu nào tự nhiên" nếu nguồn chưa có.
function buildExercises(list, beats, { err, warn, spoken }) {
  const out = [];
  const lines = beats.map((b, i) => [b, i]).filter(([b]) => b.k === "e");
  const one = (o, a, at) => {
    if (o.length < 2) err(`${at}: cần ≥2 phương án`);
    if (a.length !== 1) err(`${at}: cần đúng MỘT phương án đánh dấu * (đang có ${a.length})`);
    if (new Set(o.map((x) => x.toLowerCase())).size !== o.length) err(`${at}: phương án trùng`);
    return a[0] ?? 0;
  };
  for (const e of list) {
    const at = `dòng ${e.n} (${e.kind})`;
    const [body, ...tails] = e.body.split(" || ");
    const why = tails.filter((t) => !t.startsWith("alt:")).join(" ").trim();
    const W = why ? { why } : {};
    const k = e.kind;
    if (k === "fill" || k === "contrast" || k === "choice" || k === "fix") {
      const p = body.indexOf(" | ");
      if (p < 0) {
        err(`${at}: phải dạng "${k}: ${k === "choice" ? "đề" : "câu"} | phương án / phương án* / …"`);
        continue;
      }
      const stem = body.slice(0, p).trim();
      const { o, a } = parseOptions(body.slice(p + 3));
      const ai = one(o, a, at);
      if ((k === "fill" || k === "contrast") && !stem.includes(BLANK)) err(`${at}: câu cần chỗ trống ${BLANK}`);
      if (k === "fix" && stem.includes(BLANK)) err(`${at}: câu sai không có chỗ trống`);
      if (k === "fix" && o.some((x) => x === stem)) err(`${at}: phương án trùng câu sai`);
      out.push(k === "choice" ? { k, q: stem, o, a: ai, ...W } : { k, stem, o, a: ai, ...W });
      if (k !== "choice" && k !== "fix") spoken.push(stem.replace(BLANK, o[ai] ?? ""));
      else if (k === "fix") spoken.push(o[ai] ?? "");
    } else if (k === "natural") {
      const { o, a } = parseOptions(body);
      const ai = one(o, a, at);
      out.push({ k, o, a: ai, ...W });
      spoken.push(o[ai] ?? "");
    } else if (k === "transform") {
      const p = body.indexOf(" | ");
      const q2 = body.indexOf(" >> ");
      if (p < 0 || q2 < p) {
        err(`${at}: phải dạng "transform: yêu cầu | câu gốc >> phương án / phương án* …"`);
        continue;
      }
      const q = body.slice(0, p).trim();
      const stem = body.slice(p + 3, q2).trim();
      const { o, a } = parseOptions(body.slice(q2 + 4));
      const ai = one(o, a, at);
      out.push({ k, q, stem, o, a: ai, ...W });
      spoken.push(stem, o[ai] ?? "");
    } else if (k === "type") {
      const p = body.indexOf(" | ");
      if (p < 0) {
        err(`${at}: phải dạng "type: câu có ${BLANK} | đáp án / đáp án khác"`);
        continue;
      }
      const stem = body.slice(0, p).trim();
      const ans = body
        .slice(p + 3)
        .split(" / ")
        .map((x) => x.replace(/\*$/, "").trim())
        .filter(Boolean);
      if (!stem.includes(BLANK)) err(`${at}: câu cần chỗ trống ${BLANK}`);
      if (!ans.length) err(`${at}: thiếu đáp án`);
      out.push({ k, stem, ans, ...W });
      spoken.push(stem.replace(/\s*\([^)]*\)/g, "").replace(BLANK, ans[0] ?? ""));
    } else if (k === "order") {
      const p = body.indexOf(" | ");
      if (p < 0) {
        err(`${at}: phải dạng "order: khối / khối / khối. | nghĩa Việt"`);
        continue;
      }
      const raw = body.slice(0, p).trim();
      const vi = body.slice(p + 3).trim();
      const m = raw.match(/([.?!]+)$/);
      const end = m ? m[1] : ".";
      const parts = raw
        .replace(/([.?!]+)$/, "")
        .split(" / ")
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length < 3) err(`${at}: sắp xếp cần ≥3 khối`);
      if (!vi) err(`${at}: sắp xếp cần nghĩa Việt`);
      const alt = tails
        .filter((t) => t.startsWith("alt:"))
        .map((t) => {
          const ps = t.slice(4).trim().replace(/([.?!]+)$/, "").split(" / ").map((x) => x.trim());
          const usedIdx = new Set();
          const idx = ps.map((q) => {
            const j = parts.findIndex((x, xi) => x === q && !usedIdx.has(xi));
            usedIdx.add(j);
            return j;
          });
          if (idx.some((j) => j < 0) || idx.length !== parts.length) err(`${at}: alt không khớp khối: ${t}`);
          return idx;
        });
      out.push({ k, parts, ...(alt.length ? { alt } : {}), end, vi, ...W });
      spoken.push(parts.join(" ") + end);
    } else if (k === "listen") {
      const p = body.indexOf(" | ");
      const sent = parseMarks(p < 0 ? body.trim() : body.slice(0, p).trim()).text;
      const hit = lines.find(([b]) => b.en === sent && !b.bad);
      if (!hit) {
        err(`${at}: không thấy câu "${sent}" được đọc trong bài`);
        continue;
      }
      const [b, bi] = hit;
      if (p >= 0) {
        const { o, a } = parseOptions(body.slice(p + 3));
        const ai = one(o, a, at);
        const en = o.every((x) => !/[À-ỹđ]/u.test(x));
        if (en && o[ai] !== sent) err(`${at}: phương án đúng phải chính là câu được đọc`);
        out.push({ k, beat: bi, o, a: ai, ...(en ? { en: 1 } : {}), ...W });
      } else {
        const others = lines.filter(([x]) => x.vi && x.vi !== b.vi && !x.bad).map(([x]) => x.vi);
        const o = pickStable([...new Set(others)], 3, b.en);
        const a = hashStr(b.en) % (o.length + 1);
        o.splice(a, 0, b.vi);
        out.push({ k, beat: bi, o, a, ...W });
      }
    }
  }
  if (!out.some((x) => x.k === "listen")) {
    const cand = lines.filter(([b]) => ["examples", "real", "form"].includes(b.sec) && !b.bad);
    if (cand.length >= 4) {
      const [b, bi] = cand[hashStr(cand.map(([x]) => x.en).join("")) % cand.length];
      const others = lines.filter(([x]) => x.vi && x.vi !== b.vi && !x.bad).map(([x]) => x.vi);
      const o = pickStable([...new Set(others)], 3, b.en);
      const a = hashStr(b.en) % (o.length + 1);
      o.splice(a, 0, b.vi);
      out.push({ k: "listen", beat: bi, o, a });
    }
  }
  if (!out.some((x) => x.k === "natural")) {
    const m = lines.find(([b]) => b.bad);
    if (m) {
      const [b] = m;
      const a = hashStr(b.en) % 2;
      out.push({ k: "natural", o: a ? [b.bad.en, b.en] : [b.en, b.bad.en], a });
    }
  }
  if (!out.length) warn("không có bài tập (#practice)");
  return out;
}

// ---------- corpus (Bài đọc · Truyện · Video) ----------

let CORPUS = null;
/** Mọi câu tiếng Anh trong thư viện đã build: [{ type, id, level, band, title, en }]. */
export function corpus() {
  if (CORPUS) return CORPUS;
  const out = [];
  const LIB = join(ROOT, "public", "data", "library");
  const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
  for (const r of read(join(LIB, "readings-index.json")) ?? []) {
    const d = read(join(LIB, "readings", `${r.id}.json`));
    for (const s of d?.sentences ?? []) out.push({ type: "reading", id: r.id, level: r.level, band: bandOfKey(r.level), title: r.title_en, en: s.en });
  }
  for (const r of read(join(LIB, "stories-index.json")) ?? []) {
    const d = read(join(LIB, "stories", `${r.id}.json`));
    for (const ch of d?.chapters ?? []) for (const s of ch.sentences) out.push({ type: "story", id: r.id, level: r.level, band: bandOfKey(r.level), title: r.title_en, en: s.en });
  }
  for (const r of read(join(LIB, "videos-index.json")) ?? []) {
    const d = read(join(LIB, "videos", `${r.id}.json`));
    for (const l of d?.lines ?? []) out.push({ type: "video", id: r.id, level: r.level, band: bandOfKey(r.level), title: r.title.en, en: l.en, focus: d.focus?.lines?.includes(d.lines.indexOf(l)) ? 1 : 0 });
  }
  CORPUS = out;
  return out;
}

export function findRe(src) {
  return src ? new RegExp(src, "u") : null;
}
