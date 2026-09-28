// Phân tích từ vựng tiếng Anh cho học liệu (docs/ENGLISH_CONTENT_PLAYBOOK.md §3): tách token,
// quy MỌI dạng biến hình / rút gọn / phái sinh / từ ghép / cụm động từ tách được về lemma của bộ
// từ app (nguồn sự thật: public/data/words + word-levels + lemma-map), gán band cấp học liệu.
//
// Band (cấp học liệu) = chỉ số trong LEVEL_KEYS: 0 A1 · 1 A2 · 2 B1 · 3 B2 · 4 C1 · 5 C2.
// Bộ nền (level 0 của app) tách A1/A2 theo nhãn CEFR-J; level 1..4 → band 2..5.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const DATA = join(ROOT, "public", "data");
const SCRIPTS = join(ROOT, "scripts");

export const LEVEL_KEYS = ["a1", "a2", "b1", "b2", "c1", "c2"];
export const LEVEL_LABEL = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const bandOfKey = (k) => LEVEL_KEYS.indexOf(k);

// Không phải từ vựng cần học (thán từ, tiếng đệm, danh xưng) — luôn được phép, không tính coverage.
const FREE = new Set(
  "oh ah aha uh um uhm er erm hmm mm mmm wow oops ouch ow hey huh yay ooh whoa phew shh okay ok ha haha hah yep nope mr mrs ms dr st oi yikes ugh hm yuck".split(" "),
);

// Rút gọn → các từ thành phần (đều là từ nền). 's: is/has/sở hữu — chỉ cần gốc.
const CONTRACTION_TAIL = [
  ["n't", "not"],
  ["'re", "are"],
  ["'ve", "have"],
  ["'ll", "will"],
  ["'d", "would"],
  ["'m", "am"],
  ["'s", ""],
];
const IRREG_NEG = { "can't": ["can", "not"], "won't": ["will", "not"], "shan't": ["shall", "not"], "ain't": ["be", "not"], "cannot": ["can", "not"] };

let V = null;

/** Nạp bộ từ một lần (đồng bộ — script build/kiểm). */
export function loadVocab() {
  if (V) return V;
  const levels = JSON.parse(readFileSync(join(DATA, "word-levels.json"), "utf8"));
  const lemmaMap = JSON.parse(readFileSync(join(DATA, "lemma-map.json"), "utf8"));
  const cefrj = new Map();
  for (const line of readFileSync(join(SCRIPTS, "cefrj-a1b2.csv"), "utf8").split("\n").slice(1)) {
    const [hw, , c] = line.split(",");
    if (!hw || !c) continue;
    for (const h of hw.split("/")) {
      const k = h.trim().toLowerCase();
      if (k && (!cefrj.has(k) || c < cefrj.get(k))) cefrj.set(k, c);
    }
  }
  const words = new Map();
  for (const slug of ["foundation", "b1", "b2", "c1", "c2"]) {
    for (const w of JSON.parse(readFileSync(join(DATA, "words", `${slug}.json`), "utf8"))) words.set(w.id, w);
  }
  const band = new Map();
  for (const [id, lv] of Object.entries(levels)) {
    band.set(id, lv === 0 ? (cefrj.get(id) === "A1" ? 0 : 1) : lv + 1);
  }
  // Zipf (wordfreq) cho trọng số coverage; thiếu thì suy từ hạng tần suất.
  const zipf = new Map();
  const zf = join(SCRIPTS, "out", "wordfreq-en.tsv");
  if (existsSync(zf))
    for (const line of readFileSync(zf, "utf8").split("\n")) {
      const [w, z] = line.split("\t");
      if (w && z) zipf.set(w, Number(z));
    }
  // Cụm nhiều từ: chỉ mục theo từ đầu (lemma của từ đầu cho cụm động từ).
  const mwe = new Map();
  for (const id of band.keys()) {
    if (!id.includes(" ")) continue;
    const parts = id.split(" ");
    const w = words.get(id);
    const phrasal = !!w?.pos?.includes("phr-v");
    const first = parts[0];
    if (!mwe.has(first)) mwe.set(first, []);
    mwe.get(first).push({ id, parts, phrasal });
  }
  for (const list of mwe.values()) list.sort((a, b) => b.parts.length - a.parts.length);
  // Dạng bất quy tắc khai trong từ điển (went → go, children → child) — bổ sung lemma-map.
  const irregular = new Map();
  for (const w of words.values()) {
    if (w.irregular) {
      for (const f of [w.irregular.past, w.irregular.participle])
        for (const x of String(f ?? "").split(/[\/,]/)) if (x.trim()) irregular.set(x.trim().toLowerCase(), w.id);
    }
    if (w.plural) irregular.set(w.plural.toLowerCase(), w.id);
  }
  // Vài mục từ của DB lệch hẳn CEFR-J (favourite/neighbour C1 vì DB chỉ có chính tả Anh) → khi KIỂM CẤP
  // dùng band dễ hơn của CEFR-J; mục tiêu coverage vẫn theo DB.
  const CEFR_BAND = { A1: 0, A2: 1, B1: 2, B2: 3 };
  const easier = new Map();
  for (const [id, b] of band) {
    const c = CEFR_BAND[cefrj.get(id)];
    if (c !== undefined && c < b) easier.set(id, c);
  }
  V = { levels, lemmaMap, band, words, zipf, mwe, irregular, easier };
  return V;
}

// Số thứ tự / số đếm: DB xếp cấp lộn xộn (sixth C1, thirteenth C2) → coi là số, không kiểm cấp.
const NUMBER_WORDS = new Set(
  "zero fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth thirtieth fortieth fiftieth hundredth thousandth millionth".split(" "),
);
export const isFree = (lw) => FREE.has(lw) || NUMBER_WORDS.has(lw) || (/s$/.test(lw) && NUMBER_WORDS.has(lw.replace(/e?s$/, "")));

// ---------- Tách token ----------

// Từ (có ' hoặc - bên trong), số (1,500 · 3.5 · 1990s · 21st · 10%), còn lại là dấu câu.
const TOKEN_RE = /(?:[A-Za-z]\.){2,}|[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ]+(?:['’][A-Za-z]+)*(?:-[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ]+(?:['’][A-Za-z]+)*)*['’]?|\$?\d+(?:[.,]\d+)*(?:%|s|st|nd|rd|th|am|pm|k|m)?|\S/g;

/** Chuỗi → token {t, kind: "w"|"n"|"p", i} (i = vị trí ký tự). */
export function tokenize(text) {
  const out = [];
  const s = text.replace(/’/g, "'");
  for (const m of s.matchAll(TOKEN_RE)) {
    const t = m[0];
    const kind = /^[A-Za-zÀ-ÿ]/.test(t) ? "w" : /\d/.test(t) ? "n" : "p";
    out.push({ t, kind, i: m.index });
  }
  return out;
}

// ---------- Lemma ----------

const VOWEL = /[aeiou]/;
function inflectionBases(lw) {
  const c = [];
  const add = (b) => b && b.length >= 2 && c.push(b);
  if (lw.endsWith("ies")) add(lw.slice(0, -3) + "y");
  if (lw.endsWith("ves")) (add(lw.slice(0, -3) + "f"), add(lw.slice(0, -3) + "fe"));
  if (lw.endsWith("es")) add(lw.slice(0, -2));
  if (lw.endsWith("s") && !lw.endsWith("ss")) add(lw.slice(0, -1));
  if (lw.endsWith("ied")) add(lw.slice(0, -3) + "y");
  if (lw.endsWith("ed")) {
    add(lw.slice(0, -2));
    add(lw.slice(0, -1));
    if (/(.)\1ed$/.test(lw)) add(lw.slice(0, -3));
  }
  if (lw.endsWith("ying")) add(lw.slice(0, -4) + "ie");
  if (lw.endsWith("ing")) {
    add(lw.slice(0, -3));
    add(lw.slice(0, -3) + "e");
    if (/(.)\1ing$/.test(lw)) add(lw.slice(0, -4));
  }
  for (const [suf, cut] of [
    ["iest", 4],
    ["ier", 3],
  ])
    if (lw.endsWith(suf)) add(lw.slice(0, -cut) + "y");
  for (const suf of ["est", "er"]) {
    if (!lw.endsWith(suf)) continue;
    const b = lw.slice(0, -suf.length);
    add(b);
    add(b + "e");
    if (/(.)\1$/.test(b)) add(b.slice(0, -1));
  }
  return c;
}

// Phái sinh thường gặp — chỉ dùng khi chính dạng đó KHÔNG có trong bộ từ. Band = band của gốc.
const DERIV_SUFFIX = [
  ["ily", (b) => [b + "y"]],
  ["ically", (b) => [b + "ic", b + "ical"]],
  ["ly", (b) => [b, b + "le", b + "e"]],
  ["iness", (b) => [b + "y"]],
  ["ness", (b) => [b]],
  ["fully", (b) => [b]],
  ["ful", (b) => [b]],
  ["less", (b) => [b]],
  ["ment", (b) => [b]],
  ["able", (b) => [b, b + "e"]],
  ["ation", (b) => [b + "e", b]],
  ["ity", (b) => [b, b + "e"]],
  ["ist", (b) => [b, b + "y"]],
  ["ism", (b) => [b]],
  ["ise", (b) => [b]],
  ["ize", (b) => [b]],
  ["er", (b) => [b, b + "e"]],
  ["or", (b) => [b, b + "e"]],
  ["ish", (b) => [b, b + "e"]],
  ["hood", (b) => [b]],
  ["ship", (b) => [b]],
];
const DERIV_PREFIX = ["un", "re", "dis", "in", "im", "il", "ir", "non", "over", "under", "mis", "pre", "co", "sub", "anti", "self-", "semi", "multi", "inter", "super", "out"];

/**
 * Một từ (chữ thường, không rút gọn) → { lemma, band, how } hoặc null.
 * how: "id" | "map" | "infl" | "deriv" | "compound".
 */
export function lemmaOf(lw) {
  const v = loadVocab();
  const has = (x) => v.band.has(x);
  if (has(lw)) return { lemma: lw, band: v.band.get(lw), how: "id" };
  const ir = v.irregular.get(lw);
  if (ir && has(ir)) return { lemma: ir, band: v.band.get(ir), how: "map" };
  const mapped = v.lemmaMap[lw];
  if (mapped && has(mapped)) return { lemma: mapped, band: v.band.get(mapped), how: "map" };
  for (const b of inflectionBases(lw)) if (has(b)) return { lemma: b, band: v.band.get(b), how: "infl" };
  // phái sinh (có thể kèm biến hình: "carefully", "unhappiness", "rebuilt")
  const inflOrSelf = [lw, ...inflectionBases(lw)];
  for (const form of inflOrSelf) {
    for (const [suf, bases] of DERIV_SUFFIX) {
      if (!form.endsWith(suf) || form.length - suf.length < 3) continue;
      const stem = form.slice(0, -suf.length);
      const cands = [...bases(stem), ...(/(.)\1$/.test(stem) ? [stem.slice(0, -1)] : [])];
      for (const b of cands) {
        const r = has(b) ? { lemma: b, band: v.band.get(b) } : v.lemmaMap[b] && has(v.lemmaMap[b]) ? { lemma: v.lemmaMap[b], band: v.band.get(v.lemmaMap[b]) } : null;
        if (r) return { ...r, how: "deriv" };
      }
    }
    for (const p of DERIV_PREFIX) {
      if (!form.startsWith(p) || form.length - p.length < 3) continue;
      const rest = form.slice(p.length);
      // form đã bỏ biến hình thì phần còn lại phải là từ gốc — không biến hình lần hai
      // (rehearsed → "rehears" → re + hears → hear là sai)
      const r = has(rest) ? rest : form === lw ? v.lemmaMap[rest] : null;
      if (r && has(r)) return { lemma: r, band: v.band.get(r), how: "deriv" };
      if (form === lw) for (const b of inflectionBases(rest)) if (has(b)) return { lemma: b, band: v.band.get(b), how: "deriv" };
    }
  }
  // từ ghép viết liền: hai phần đều có trong bộ từ (bookshop, sunlight)
  for (let k = 3; k <= lw.length - 3; k++) {
    const a = lw.slice(0, k);
    const b = lw.slice(k);
    const ra = has(a) ? a : null;
    const rb = has(b) ? b : v.lemmaMap[b] && has(v.lemmaMap[b]) ? v.lemmaMap[b] : inflectionBases(b).find(has);
    if (ra && rb && VOWEL.test(a) && VOWEL.test(b)) {
      return { lemma: lw, band: Math.max(v.band.get(ra), v.band.get(rb)), how: "compound", parts: [ra, rb] };
    }
  }
  return null;
}

/**
 * Token từ (nguyên dạng) → danh sách phần tử phân tích [{lemma, band, how}] (rút gọn / từ gạch nối có
 * thể ra nhiều phần); [] = không xác định được. `names` = Set tên riêng (chữ thường).
 */
export function analyzeWord(raw, { names, sentenceStart } = {}) {
  const v = loadVocab();
  const t = raw.replace(/’/g, "'").replace(/'$/, "");
  // bỏ dấu (café → cafe, naïve → naive) — bộ từ viết không dấu
  const lw = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const raw0 = t.toLowerCase();
  const cap = /^[A-Z]/.test(t);
  const isName = (k) => names?.has(k) || (cap && names?.has(`^${k}`));
  if (isName(lw) || isName(raw0) || isName(lw.replace(/'s$/, "")) || isName(raw0.replace(/'s$/, "")))
    return [{ lemma: lw.replace(/'s$/, ""), band: -1, how: "name" }];
  if (isFree(lw)) return [{ lemma: lw, band: -1, how: "free" }];
  if (IRREG_NEG[lw]) return IRREG_NEG[lw].map((x) => ({ lemma: x, band: v.band.get(x) ?? 0, how: "contr" }));
  if (v.band.has(lw)) {
    // Dạng có mục từ riêng nhưng cũng là biến hình của từ dễ hơn (running ← run, been ← be):
    // kiểm cấp theo band thấp hơn, coverage tính cả hai.
    const b0 = v.band.get(lw);
    // -er/-est chỉ là biến hình của tính/trạng từ, và gốc phải liệt kê dạng này (taller ← tall;
    // commander, manufacturer KHÔNG phải biến hình của command, manufacture)
    const inflOf = (x) => {
      if (!v.band.has(x)) return false;
      const rec = v.words.get(x);
      if (rec?.forms?.length) return rec.forms.includes(lw);
      return !/(er|est)$/.test(lw) || (rec?.pos ?? []).some((p) => p === "adj" || p === "adv");
    };
    const base = v.irregular.get(lw) ?? v.lemmaMap[lw] ?? inflectionBases(lw).find(inflOf);
    if (base && base !== lw && v.band.has(base) && v.band.get(base) < b0)
      return [{ lemma: lw, band: b0, how: "id", alt: { lemma: base, band: v.band.get(base) } }];
    return [{ lemma: lw, band: b0, how: "id" }];
  }
  if (IRREG_NEG[lw]) return IRREG_NEG[lw].map((x) => ({ lemma: x, band: v.band.get(x) ?? 0, how: "contr" }));
  if (lw.includes("'")) {
    for (const [tail, word] of CONTRACTION_TAIL) {
      if (!lw.endsWith(tail)) continue;
      const head = lw.slice(0, -tail.length);
      const h = analyzeWord(head, { names, sentenceStart });
      if (!h.length) {
        // tên riêng sở hữu (Maria's) — chữ hoa đầu
        if (/^[A-Z]/.test(t)) return [{ lemma: head, band: -1, how: "name" }];
        return [];
      }
      return word ? [...h, { lemma: word, band: v.band.get(word) ?? 0, how: "contr" }] : h;
    }
  }
  if (lw.includes("-")) {
    const whole = lemmaOf(lw);
    if (whole && whole.how !== "compound") return [whole];
    const parts = lw.split("-").filter(Boolean);
    const res = parts.map((p) => lemmaOf(p) ?? (isFree(p) ? { lemma: p, band: -1, how: "free" } : null));
    if (res.every(Boolean)) return res.map((r) => ({ ...r, how: r.how === "id" ? "hyphen" : r.how }));
    return [];
  }
  const r = lemmaOf(lw);
  if (r) {
    // chữ hoa GIỮA câu mà dạng gốc là từ thường hiếm → vẫn coi là từ (Bank, Street…); tên riêng
    // thật phải khai `names:`.
    return [r];
  }
  return [];
}

// ---------- Phân tích văn bản ----------

const OBJ_GAP = new Set("it them him her me us you this that these those one something everything anything someone everyone".split(" "));
const DET = new Set("the a an my your his her its our their this that these those some any".split(" "));

/**
 * Phân tích một câu. Trả về token từ kèm phân tích + cụm nhiều từ tìm thấy.
 * opts: { names: Set<string> }
 */
export function analyzeSentence(text, opts = {}) {
  const v = loadVocab();
  const toks = tokenize(text);
  const words = [];
  let start = true;
  for (const tk of toks) {
    if (tk.kind === "p") {
      // "Mr." / "Ms." / "Dr." không kết thúc câu
      const prev = words[words.length - 1]?.t.toLowerCase();
      if (/[.!?…]/.test(tk.t) && !(tk.t === "." && ["mr", "mrs", "ms", "dr", "st"].includes(prev))) start = true;
      continue;
    }
    if (tk.kind === "n") {
      words.push({ t: tk.t, i: tk.i, res: [{ lemma: tk.t, band: -1, how: "num" }] });
      start = false;
      continue;
    }
    const res = analyzeWord(tk.t, { names: opts.names, sentenceStart: start });
    // Chữ hoa không tra được → tên riêng (giữa câu) hoặc "chưa rõ" (đầu câu, chưa khai names)
    if (!res.length && /^[A-Z]/.test(tk.t)) {
      words.push({ t: tk.t, i: tk.i, res: [{ lemma: tk.t.toLowerCase(), band: -1, how: start ? "cap?" : "name?" }] });
    } else words.push({ t: tk.t, i: tk.i, res });
    start = false;
  }
  // Cụm nhiều từ (MWE): từ đầu so theo lemma; cụm động từ cho phép tân ngữ chen giữa.
  const mwes = [];
  // lemma + dạng gốc dễ hơn (given → give, found → find) để "given up" vẫn khớp "give up"
  const lemmas = words.map((w) => w.res.flatMap((r) => (r.alt ? [r.lemma, r.alt.lemma] : [r.lemma])));
  const lower = words.map((w) => w.t.toLowerCase().replace(/’/g, "'"));
  for (let i = 0; i < words.length; i++) {
    const heads = new Set([lower[i], ...lemmas[i]]);
    for (const h of heads) {
      for (const m of v.mwe.get(h) ?? []) {
        const rest = m.parts.slice(1);
        // liền nhau
        let ok = rest.every((p, k) => {
          const j = i + 1 + k;
          if (j >= words.length) return false;
          if (lower[j] === p) return true;
          // từ cuối được biến hình (living rooms, credit cards)
          return k === rest.length - 1 && lemmas[j].includes(p);
        });
        let end = i + rest.length;
        if (!ok && m.phrasal && rest.length === 1) {
          // tách được: "pick it up", "turn the lights off" (≤3 token chen, là tân ngữ ngắn)
          for (let gap = 1; gap <= 3 && !ok; gap++) {
            const j = i + 1 + gap;
            if (j >= words.length || lower[j] !== rest[0]) continue;
            const mid = lower.slice(i + 1, j);
            const objOk = (mid.length === 1 && OBJ_GAP.has(mid[0])) || (mid.length >= 2 && DET.has(mid[0]));
            if (objOk) {
              ok = true;
              end = j;
            }
          }
        }
        if (ok) {
          mwes.push({ id: m.id, band: v.band.get(m.id), from: i, to: end });
          break;
        }
      }
    }
  }
  return { words, mwes };
}

/**
 * Hồ sơ từ vựng của một văn bản (mảng câu). Trả về:
 *  counts: Map<lemma, n> (từ + cụm đã xác định, KHÔNG gồm tên/số/thán từ)
 *  bands: số token theo band; over: [{t, lemma, band}] vượt cấp; unknown: [token]; names: Set
 *  nWords: số token từ (gồm tên, không gồm số/dấu câu)
 */
export function profile(sentences, { names, level } = {}) {
  const v = loadVocab();
  const counts = new Map();
  const bands = [0, 0, 0, 0, 0, 0];
  const over = [];
  const unknown = [];
  const foundNames = new Set();
  let nWords = 0;
  let nScored = 0;
  const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const s of sentences) {
    const { words, mwes } = analyzeSentence(s, { names });
    // token thuộc một cụm ĐÚNG/DƯỚI cấp (credit card, living room) không tính vượt cấp riêng lẻ
    const inMwe = new Set();
    const anyMwe = new Set();
    // band thấp nhất của cụm chứa token: "according" (→ accord, C1) trong "according to" (B1) là B1
    const mweBand = new Map();
    for (const m of mwes)
      for (let k = m.from; k <= m.to; k++) {
        anyMwe.add(k);
        if (level !== undefined && m.band <= level) inMwe.add(k);
        if (m.band >= 0) mweBand.set(k, Math.min(mweBand.get(k) ?? 9, m.band));
      }
    for (const [wi, w] of words.entries()) {
      if (w.res[0]?.how === "num") continue;
      nWords++;
      if (!w.res.length) {
        if (!anyMwe.has(wi)) unknown.push(w.t);
        continue;
      }
      const r0 = w.res[0];
      if (r0.how === "name" || r0.how === "name?" || r0.how === "cap?") {
        foundNames.add(w.t.replace(/'s$/, ""));
        if (r0.how === "cap?") unknown.push(w.t);
        continue;
      }
      if (r0.how === "free") continue;
      const eff = (r) => Math.min(r.band, r.alt?.band ?? 9, v.easier.get(r.lemma) ?? 9);
      const b = Math.min(Math.max(...w.res.map(eff)), mweBand.get(wi) ?? 9);
      nScored++;
      if (b >= 0) bands[b]++;
      for (const r of w.res) {
        if (r.how === "compound") for (const p of r.parts ?? []) bump(p);
        else if (r.band >= 0) bump(r.lemma);
        if (r.alt) bump(r.alt.lemma);
      }
      if (level !== undefined && b > level && !inMwe.has(wi)) over.push({ t: w.t, lemma: w.res.find((r) => eff(r) === b)?.lemma ?? w.t, band: b });
    }
    // Cụm vượt cấp mà mọi thành phần đều được phép (pick up, give up) KHÔNG tính vào tỉ lệ vượt
    // cấp — chỉ ghi nhận (mwe: true) để người viết biết.
    for (const m of mwes) {
      bump(m.id);
      if (level !== undefined && m.band > level) over.push({ t: m.id, lemma: m.id, band: m.band, mwe: true });
    }
  }
  return { counts, bands, over, unknown, names: foundNames, nWords, nScored };
}

/** Trọng số tần suất của một lemma (Zipf 1..7; cụm nhiều từ lấy Zipf thấp nhất của các phần). */
export function weightOf(lemma) {
  const v = loadVocab();
  const z = (w) => v.zipf.get(w) ?? (v.words.get(w)?.frequency ? Math.max(1, 7 - Math.log10(v.words.get(w).frequency + 1) * 1.2) : 2);
  if (!lemma.includes(" ")) return z(lemma);
  // cụm hiếm hơn nhiều so với từng thành phần: ước lượng thô = Zipf thành phần hiếm nhất − 2
  return Math.min(...lemma.split(" ").map(z)) - 2;
}

// Từ đích KHÔNG đặt mục tiêu phủ (tục/xúc phạm) — vẫn tra cứu được trong từ điển.
const NOT_TARGET = /\b(fuck|shit|bitch|fag|horny|jerk off|cunt|dick|piss|bastard|slut|whore|nigg|retard)/;
export const isTarget = (id) => {
  const v = loadVocab();
  if (NOT_TARGET.test(id)) return false;
  // Từ đệm/số được analyzer coi là tự do thì không thể "phủ" → không tính là từ đích.
  if (isFree(id) || isFree(id.replace(/\.$/, ""))) return false;
  const reg = v.words.get(id)?.register ?? [];
  return !reg.some((r) => r === "vulgar" || r === "offensive");
};

/** Danh sách từ đích của band (lemma), sắp theo tần suất giảm dần. */
export function targetWords(band) {
  const v = loadVocab();
  const out = [];
  for (const [id, b] of v.band) if (b === band && isTarget(id)) out.push(id);
  return out.sort((a, b) => weightOf(b) - weightOf(a));
}

// ---------- IPA theo token (lớp phát âm của transcript Video) ----------

const CONTR_IPA = {
  "i'm": "aɪm", "you're": "jʊɹ", "we're": "wɪɹ", "they're": "ðɛɹ", "it's": "ɪts", "that's": "ðæts", "what's": "wʌts",
  "there's": "ðɛɹz", "here's": "hɪɹz", "he's": "hiz", "she's": "ʃiz", "let's": "lɛts", "who's": "huz", "where's": "wɛɹz",
  "how's": "haʊz", "don't": "doʊnt", "doesn't": "ˈdʌzənt", "didn't": "ˈdɪdənt", "can't": "kænt", "won't": "woʊnt",
  "isn't": "ˈɪzənt", "aren't": "ɑɹnt", "wasn't": "ˈwʌzənt", "weren't": "wɝnt", "haven't": "ˈhævənt", "hasn't": "ˈhæzənt",
  "hadn't": "ˈhædənt", "couldn't": "ˈkʊdənt", "wouldn't": "ˈwʊdənt", "shouldn't": "ˈʃʊdənt", "mustn't": "ˈmʌsənt",
  "i've": "aɪv", "you've": "juv", "we've": "wiv", "they've": "ðeɪv", "i'll": "aɪl", "you'll": "jul", "we'll": "wil",
  "they'll": "ðeɪl", "he'll": "hil", "she'll": "ʃil", "it'll": "ˈɪtəl", "that'll": "ˈðætəl", "i'd": "aɪd", "you'd": "jud",
  "we'd": "wid", "they'd": "ðeɪd", "he'd": "hid", "she'd": "ʃid", "there'll": "ðɛɹl", "who'd": "hud", "what're": "ˈwʌtɚ",
  "gonna": "ˈɡʌnə", "wanna": "ˈwɑnə", "gotta": "ˈɡɑtə", "okay": "oʊˈkeɪ", "ok": "oʊˈkeɪ", "mr": "ˈmɪstɚ", "mrs": "ˈmɪsɪz",
  "ms": "mɪz", "dr": "ˈdɑktɚ", "oh": "oʊ", "wow": "waʊ", "hey": "heɪ", "um": "ʌm", "uh": "ʌ", "hmm": "hm", "ah": "ɑ",
  "oops": "ups", "yeah": "jɛə", "yep": "jɛp", "nope": "noʊp", "ouch": "aʊtʃ", "huh": "hʌ",
};

let KAIKKI_US = null;
function kaikkiUs(lw) {
  if (!KAIKKI_US) {
    KAIKKI_US = new Map();
    const p = join(SCRIPTS, "out", "kaikki-filtered.jsonl");
    if (existsSync(p))
      for (const line of readFileSync(p, "utf8").split("\n")) {
        if (!line) continue;
        const e = JSON.parse(line);
        const w = String(e.w).toLowerCase();
        if (KAIKKI_US.has(w)) continue;
        const us = (e.sounds ?? []).find((s) => s.ipa?.startsWith("/") && (s.tags ?? []).some((t) => /^(US|General-American)$/.test(t)));
        if (us) KAIKKI_US.set(w, us.ipa);
      }
  }
  return KAIKKI_US.get(lw);
}

// Chuẩn hoá hiển thị GA: bỏ ranh giới âm tiết ".", nối âm "͡", dấu phi âm tiết "̯", dấu dài "ː"
// (GA không đánh độ dài — bộ từ trộn nguồn nên có mục còn dấu RP).
const clean = (ipa) =>
  String(ipa ?? "")
    .split(/,\s*|\s+~\s+/)[0]
    .replace(/^[\/[]|[\/\]]$/g, "")
    .replace(/[.̯͡ː]/g, "")
    .trim();
const sEnd = (b) => (/(s|z|ʃ|ʒ|tʃ|dʒ)$/.test(b) ? "ɪz" : /[ptkfθ]$/.test(b) ? "s" : "z");
const edEnd = (b) => (/[td]$/.test(b) ? "ɪd" : /(p|k|f|s|ʃ|tʃ|θ)$/.test(b) ? "t" : "d");

// CMUdict → IPA GA (scripts/build-cmu-ipa.py): NGUỒN CHÍNH cho lớp phát âm học liệu. IPA trong bộ từ của
// app trộn nguồn nên nhiều từ cơ bản sai (does /doʊz/, are /ɛəɹ/) — chỉ dùng làm dự phòng cho từ hiếm.
let CMU = null;
function cmu(lw) {
  if (!CMU) {
    CMU = new Map();
    const p = join(SCRIPTS, "out", "cmu-ipa.tsv");
    if (existsSync(p))
      for (const line of readFileSync(p, "utf8").split("\n")) {
        const k = line.indexOf("\t");
        if (k > 0) CMU.set(line.slice(0, k), line.slice(k + 1).split("\t")[0]);
      }
  }
  return CMU.get(lw);
}

/**
 * IPA (GA, dạng trích dẫn) cho một token/lemma, "" nếu không có dữ liệu đáng tin. Thứ tự: CMUdict (cả dạng
 * biến hình, rút gọn) → biến hình đều suy từ IPA gốc CMU → kaikki mục US/General-American → bộ từ. Không đoán.
 */
export function ipaOf(raw) {
  const v = loadVocab();
  const lw = raw.toLowerCase().replace(/’/g, "'").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lw.includes(" ")) {
    const parts = lw.split(" ").map((x) => ipaOf(x));
    return parts.every(Boolean) ? parts.join(" ") : "";
  }
  if (lw === "ok" || lw === "okay") return "oʊˈkeɪ";
  const c = cmu(lw);
  if (c) return c;
  if (CONTR_IPA[lw]) return CONTR_IPA[lw];
  if (lw.includes("-")) {
    const parts = lw.split("-").map((x) => ipaOf(x));
    return parts.every(Boolean) ? parts.join("-") : "";
  }
  if (lw.endsWith("'s")) {
    const b = ipaOf(lw.slice(0, -2));
    return b ? b + sEnd(b) : "";
  }
  const tryBase = (b) => cmu(b) ?? "";
  const NV = (pos) => !pos.length || pos.some((p) => p === "n" || p === "v" || p === "phr-v");
  const V_ = (pos) => !pos.length || pos.some((p) => p === "v" || p === "phr-v");
  const ADJ = (pos) => !pos.length || pos.some((p) => p === "adj" || p === "adv");
  // [đuôi, các gốc thử, IPA từ gốc, từ loại gốc hợp lệ]
  const rules = [
    [/ies$/, (w) => [w.slice(0, -3) + "y"], (b) => b + "z", NV],
    [/es$/, (w) => [w.slice(0, -2)], (b) => b + sEnd(b), NV],
    [/s$/, (w) => [w.slice(0, -1)], (b) => b + sEnd(b), NV],
    [/ied$/, (w) => [w.slice(0, -3) + "y"], (b) => b + "d", V_],
    [/ed$/, (w) => [w.slice(0, -2), w.slice(0, -1), w.slice(0, -3)], (b) => b + edEnd(b), V_],
    [/ing$/, (w) => [w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4)], (b) => b + "ɪŋ", V_],
    [/ly$/, (w) => [w.slice(0, -2)], (b) => b + "li", ADJ],
  ];
  for (const [re, bases, fn, posOk] of rules) {
    if (!re.test(lw)) continue;
    for (const b of bases(lw)) {
      if (b.length < 2) continue;
      const bi = tryBase(b);
      if (bi && posOk(v.words.get(b)?.pos ?? [])) return fn(bi);
    }
  }
  const k = kaikkiUs(lw);
  if (k) return clean(k);
  const own = v.words.get(lw)?.ipa;
  return own ? clean(own) : "";
}

// Từ đồng tự khác âm (heteronym) — IPA phụ thuộc nghĩa/từ loại trong câu. Transcript Video phải
// khai theo ngữ cảnh (ipa=read:rɛd) hoặc xác nhận dạng từ điển (ipa=read:=).
export const HETERONYMS = new Set(
  "read lead live lives close closes use uses used record records present presents object objects content desert deserts minute wind winds wound tear tears bow bows row rows bass dove produce refuse permit permits project projects subject subjects increase increases decrease decreases contract contracts conduct conflict conflicts contest convert excuse excuses house abuse separate separates estimate estimates graduate graduates moderate alternate alternates associate associates advocate advocates delegate delegates duplicate appropriate approximate elaborate intimate articulate deliberate polish invalid resume sow sewer lives".split(" "),
);
