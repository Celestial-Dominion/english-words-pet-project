// Stage 1 — dựng bộ từ B1–C2 + nền A1–A2 (CHƯA có nghĩa Việt, stage 2 do agent dịch).
// Nguồn:
//  - cefrj-a1b2.csv (CEFR-J, CC-BY-SA): nhãn A1..B2
//  - octanove-c1c2.csv (Octanove, CC-BY-SA): nhãn C1..C2
//  - out/wordfreq-en.tsv: tần suất Zipf (wordfreq, trộn nhiều corpus)
//  - out/kaikki-filtered.jsonl (Wiktextract): IPA, POS, forms, register, nghĩa EN, phrasal verbs
// Quy tắc gán cấp (plan mục 1.3):
//  - A1/A2 → level 0 (nền, chỉ tra cứu); B1→1, B2→2, C1→3, C2→4
//  - Từ có nhãn giữ nguyên nhãn; C1/C2 bổ sung từ top tần suất chưa nhãn cho đủ quota
//  - Phrasal verb (kaikki, 2 token verb+particle) gán theo Zipf: ≥4.3→B1, ≥3.8→B2, ≥3.4→C1, còn lại→C2
// Chạy: node scripts/build-words-stage1.mjs  ->  scripts/out/words-stage1.json + báo cáo stderr
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { progress } from "./lib-progress.mjs";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");

// ---- đọc nguồn ----
const readCsv = (name) => {
  // CSV đơn giản: không có dấu phẩy trong ngoặc kép ở 2 file này (đã kiểm tra bằng mắt).
  const lines = readFileSync(join(HERE, name), "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()]));
  });
};

const POS_MAP = {
  noun: "n", verb: "v", vern: "v", adjective: "adj", adverb: "adv", preposition: "prep",
  conjunction: "conj", pronoun: "pron", determiner: "det", number: "num", numeral: "num",
  interjection: "intj", "modal auxiliary verb": "vaux", "modal auxiliary": "vaux",
  "be-verb": "vaux", "do-verb": "vaux", "have-verb": "vaux", "auxiliary verb": "vaux",
  "infinitive-to": "phr", phrase: "phr", "prepositional phrase": "phr", exclamation: "intj",
  // kaikki pos
  adj: "adj", adv: "adv", det: "det", intj: "intj", num: "num", particle: "phr",
  prep: "prep", pron: "pron", prep_phrase: "phr",
};
const mapPos = (p) => POS_MAP[p.toLowerCase()] ?? null;

const LEVEL_OF = { A1: 0, A2: 0, B1: 1, B2: 2, C1: 3, C2: 4 };

// zipf
const zipf = new Map(
  readFileSync(join(OUT, "wordfreq-en.tsv"), "utf8").trim().split("\n")
    .map((l) => { const [w, z] = l.split("\t"); return [w, Number(z)]; }),
);
const zipfOf = (w) => zipf.get(w) ?? 0;

// ---- 1. từ có nhãn CEFR ----
/** @type {Map<string, {level:number, pos:Set<string>, variants:Set<string>}>} */
const labeled = new Map();
for (const [file, rows] of [["cefrj-a1b2.csv", readCsv("cefrj-a1b2.csv")], ["octanove-c1c2.csv", readCsv("octanove-c1c2.csv")]]) {
  for (const r of rows) {
    const cefr = (r.CEFR || "").toUpperCase();
    if (!(cefr in LEVEL_OF)) continue;
    const parts = (r.headword || "").split("/").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    const id = parts[0].toLowerCase();
    if (!/^[a-z][a-z' .-]*$/.test(id)) continue; // bỏ headword lạ
    const level = LEVEL_OF[cefr];
    const pos = mapPos(r.pos || "");
    const cur = labeled.get(id);
    if (cur) {
      cur.level = Math.min(cur.level, level); // đa nghĩa/đa POS → cấp thấp nhất (nghĩa phổ biến học sớm)
      if (pos) cur.pos.add(pos);
      parts.slice(1).forEach((v) => cur.variants.add(v.toLowerCase()));
    } else {
      labeled.set(id, { level, pos: new Set(pos ? [pos] : []), variants: new Set(parts.slice(1).map((v) => v.toLowerCase())) });
    }
  }
}

// ---- 2. kaikki enrich map ----
if (!existsSync(join(OUT, "kaikki-filtered.jsonl"))) {
  console.error("THIẾU out/kaikki-filtered.jsonl — chạy filter-kaikki.py trước.");
  process.exit(1);
}
/** @type {Map<string, {pos:Set<string>, ipaUS?:string, ipaAny?:string, senses:Array<{g:string[],tags:string[]}>, forms:Array<{f:string,tags:string[]}>}>} */
const kk = new Map();
// kaikki-extra.jsonl = các từ lấy lẻ từ kaikki.org sau này (fetch-kaikki-words.mjs) — đọc chung.
const kkLines = [
  ...readFileSync(join(OUT, "kaikki-filtered.jsonl"), "utf8").split("\n"),
  ...(existsSync(join(OUT, "kaikki-extra.jsonl")) ? readFileSync(join(OUT, "kaikki-extra.jsonl"), "utf8").split("\n") : []),
];
const kkBar = progress(kkLines.length, "đọc kaikki");
for (const line of kkLines) {
  kkBar.tick(1, `${kk.size} từ`);
  if (!line) continue;
  const e = JSON.parse(line);
  const id = e.w.toLowerCase();
  let cur = kk.get(id);
  if (!cur) {
    cur = { pos: new Set(), senses: [], forms: [] };
    kk.set(id, cur);
  }
  const p = mapPos(e.pos);
  if (p) cur.pos.add(p);
  for (const s of e.sounds ?? []) {
    const tags = (s.tags ?? []).map((t) => t.toLowerCase());
    const isUS = tags.some((t) => t.includes("us") || t.includes("general-american") || t.includes("genam"));
    if (isUS && !cur.ipaUS) cur.ipaUS = s.ipa;
    if (!cur.ipaAny) cur.ipaAny = s.ipa;
  }
  // gắn POS vào sense/form để stage sau phân biệt (past của verb ≠ plural của noun)
  for (const s of e.senses ?? []) cur.senses.push({ ...s, pos: p });
  for (const f of e.forms ?? []) cur.forms.push({ ...f, pos: p });
}

kkBar.done(`${kk.size} từ có dữ liệu Wiktionary`);

// Nghĩa kiểu "present participle of …", "third-person singular … of …" chỉ là DẠNG của từ khác,
// không phải nghĩa thật → không được tính khi xét từ loại chính của cụm.
const FORM_OF_GLOSS = /^(present participle|past participle|past tense|simple past|third-person singular|plural|comparative|superlative|gerund|alternative (form|spelling)|inflection|misspelling)\b/i;
const realSenses = (e) => (e?.senses ?? []).filter((s) => !FORM_OF_GLOSS.test(String(s.g?.[0] ?? "")));

/**
 * Cụm này có phải PHRASAL VERB thật không?
 *  1) tiểu từ/giới từ đứng sau (up, out, after…) — "full stop", "ad lib" rớt ở đây;
 *  2) nghĩa động từ phải là nghĩa CHÍNH, không thua số nghĩa của danh/tính/phó từ và không
 *     phải nghĩa "dạng của…" — "air conditioning" (danh từ), "heads up" (dạng của head up),
 *     "used to" (tính từ) rớt ở đây.
 * Sai ở bước này thì thẻ bị gắn nhầm "cụm động từ" và lọt vào bộ lọc Phrasal verbs.
 */
const PARTICLES = new Set([
  "up", "down", "in", "out", "off", "on", "away", "back", "over", "through", "along", "around",
  "about", "across", "apart", "aside", "by", "forward", "together", "under", "ahead", "after",
  "for", "into", "onto", "with", "without", "upon", "at", "from", "against", "behind", "past",
]);
function isPhrasalVerb(id, e) {
  const parts = id.split(" ");
  if (parts.length < 2) return false;
  if (!PARTICLES.has(parts[parts.length - 1])) return false;
  const byPos = {};
  for (const s of realSenses(e)) byPos[s.pos ?? "?"] = (byPos[s.pos ?? "?"] ?? 0) + 1;
  const v = byPos.v ?? 0;
  if (!v) return false;
  const other = Math.max(0, ...Object.entries(byPos).filter(([p]) => p !== "v").map(([, n]) => n));
  return v >= other;
}

const BAD_SENSE_TAGS = new Set(["obsolete", "archaic", "misspelling", "rare", "nonstandard", "abbreviation", "initialism", "acronym"]);
const usableEntry = (e) => {
  const s0 = e.senses[0];
  if (!s0) return false;
  return !(s0.tags ?? []).some((t) => BAD_SENSE_TAGS.has(String(t).toLowerCase()));
};

// ---- 3. phrasal verbs từ kaikki ----
// wordfreq chấm cụm bằng xấp xỉ (nhân xác suất token) nên hào phóng với mọi "verb+particle";
// giới hạn cứng top ~450 theo điểm, phân bổ 150 B1 / 150 B2 / 100 C1 / 50 C2 (plan mục 1.2).
// LƯU Ý: bộ lọc chỉ cần `pos.has("v")` nên có lọt vài entry chỉ là DẠNG của cụm khác
// ("pissed off" ← piss off, "heads up" ← head up). Chúng vẫn nằm trong bộ từ (đã có nghĩa VI,
// câu ví dụ và audio dựng sẵn ở E1–E2) nhưng KHÔNG còn bị gắn nhãn "phr-v" — xem isPhrasalVerb.
// Muốn thay hẳn bằng cụm động từ thật thì phải dịch + sinh ví dụ + build audio cho từ mới.
const PV_TOTAL = 450;
const pvCandidates = [];
for (const [id, e] of kk) {
  if (!id.includes(" ")) continue;
  if (!e.pos.has("v")) continue;
  if (labeled.has(id)) continue;
  if (!usableEntry(e)) continue; // sense đầu obsolete/rare → bỏ
  pvCandidates.push({ id, z: zipfOf(id) });
}
pvCandidates.sort((a, b) => b.z - a.z);
const phrasal = pvCandidates.slice(0, PV_TOTAL).map(({ id }, i) => ({
  id,
  level: i < 150 ? 1 : i < 300 ? 2 : i < 400 ? 3 : 4,
}));

// ---- 4. ứng viên fill C1/C2 theo tần suất (lọc thật sự ở bước 5, cần biết forms) ----
const QUOTA = { 3: 3000, 4: 2300 };
const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
for (const { level } of labeled.values()) counts[level]++;
for (const { level } of phrasal) counts[level]++;

// Rác từ corpus tần suất: contraction (don't), ký tự lẻ (s, m), danh từ riêng (john, york),
// tục tĩu/lóng mạng (lol, http). Chỉ áp cho từ KHÔNG nhãn CEFR.
const PROPER_GLOSS = /^(a |an |the )?(male |female |unisex )?(given name|surname|nickname|placename|city|town|village|county|state|province|country|river|mountain|island|lake|capital|region|district)\b|^(a|an|the) (city|town|state|country|county|province|river|island|region)\b|\bin (the )?(united states|england|scotland|wales|ireland|france|germany|canada|australia)\b/i;
const BAD_FILL_TAGS = new Set(["vulgar", "offensive", "derogatory", "ethnic-slur", "internet", "text-messaging", "abbreviation", "initialism", "letter", "symbol", "contraction", "pronunciation-spelling", "eye-dialect", "colloquial"]);
// Danh từ riêng (kaikki pos=name): "john", "york", "china" có nghĩa thường hiếm/lóng nhưng
// tần suất cao do tên riêng viết hoa → loại khỏi bước fill. File sinh bởi dump-proper-names.
const properNames = existsSync(join(OUT, "proper-names.txt"))
  ? new Set(readFileSync(join(OUT, "proper-names.txt"), "utf8").split("\n").filter(Boolean))
  : new Set();
if (!properNames.size) console.error("CẢNH BÁO: thiếu out/proper-names.txt — không lọc được danh từ riêng.");

const fillOk = (id) => {
  if (id.length < 3 || id.includes("'")) return false;
  if (properNames.has(id)) return false;
  const lemma = inflectionOf.get(id);
  if (lemma && lemma !== id && !labeled.has(id)) return false; // dạng chia, trừ khi có nhãn CEFR riêng
  const e = kk.get(id);
  const s0 = e.senses[0];
  if (!s0) return false;
  // biến thể/viết tắt của từ khác ("etc" ⊂ "etc.", "info" ⊂ "information") — không phải lemma riêng
  const g0 = ((s0.g ?? [])[0] ?? "").trim();
  if (/^(alternative|alt|clipped|contracted|shortened|abbreviated|informal|colloquial)\s+(form|spelling|version)\s+of\b|^(synonym|abbreviation|contraction|clipping|initialism|acronym)\s+of\b/i.test(g0)) return false;
  if ((s0.tags ?? []).some((t) => BAD_FILL_TAGS.has(String(t).toLowerCase()))) return false;
  // danh từ riêng: mọi sense đều là tên riêng
  const glosses = e.senses.map((x) => (x.g ?? [])[0] ?? "").filter(Boolean);
  if (glosses.length && glosses.every((g) => PROPER_GLOSS.test(g.trim()))) return false;
  return true;
};

// form → lemma gốc (từ toàn bộ kaikki, không chỉ bộ từ đã chọn): "according" ⊂ "accord".
// Cần vì vòng fill xếp theo tần suất, dạng chia có thể được xét TRƯỚC lemma gốc.
const inflectionOf = new Map();
for (const [lemma, e] of kk) {
  if (lemma.includes(" ")) continue;
  for (const f of e.forms ?? []) {
    const form = String(f.f).toLowerCase();
    if (form === lemma || !/^[a-z][a-z'-]*$/.test(form)) continue;
    const cur = inflectionOf.get(form);
    if (!cur || zipfOf(lemma) > zipfOf(cur)) inflectionOf.set(form, lemma);
  }
}

const fillCandidates = [...kk.keys()]
  .filter((id) => !id.includes(" ") && !labeled.has(id) && /^[a-z][a-z-]*$/.test(id))
  .filter((id) => usableEntry(kk.get(id)) && fillOk(id))
  .map((id) => ({ id, z: zipfOf(id) }))
  .filter(({ z }) => z >= 1.8)
  .sort((a, b) => b.z - a.z);

// ---- 5. hợp nhất thành danh sách Word (chưa có meaning_vi) ----
const CLEAN_FORM = /^[a-z][a-z' -]*$/;
const REGISTER_TAGS = { formal: "formal", informal: "informal", colloquial: "informal", slang: "slang", literary: "literary", dated: "dated", humorous: "informal", poetic: "literary" };

// "British standard spelling of behaviour", "Alternative spelling of makeup"… → entry này chỉ là
// biến thể chính tả của từ khác, sẽ được gộp ở bước 5b. Phải đọc GLOSS GỐC của kaikki chứ không
// đọc meaning_en (meaning_en đã đi theo con trỏ lấy nghĩa thật nên không còn dấu vết biến thể).
const SPELLING_OF = /^(?:(?:british|american|commonwealth|canadian|us|uk)\s+)?(?:standard\s+|alternative\s+|informal\s+)?(?:spelling|form)\s+of\s+([a-z' -]+?)\.?$/i;
/** @type {Map<string,string>} id biến thể → id gốc */
const variantOf = new Map();

function buildWord(id, level) {
  const e = kk.get(id);
  const labeledEntry = labeled.get(id);
  const posSet = new Set([...(labeledEntry?.pos ?? []), ...(e?.pos ?? [])]);
  if (id.includes(" ") && posSet.has("v")) {
    if (isPhrasalVerb(id, e)) {
      posSet.clear();
      posSet.add("phr-v"); // phrasal verb là loại riêng
    } else if (!realSenses(e).some((s) => s.pos === "v")) {
      // chỉ có nghĩa "dạng của…" (air conditioning, heads up) → không phải động từ
      posSet.delete("v");
      if (!posSet.size) posSet.add("n");
    }
  }
  if (!posSet.size) posSet.add("n");

  // IPA: ưu tiên bản US (khớp giọng en-US-AriaNeural)
  const ipa = e?.ipaUS ?? e?.ipaAny ?? "";

  // nghĩa EN: gloss đầu của tối đa 3 sense dùng được (cắt gọn — gloss Wiktionary có thể dài cả đoạn)
  const shorten = (g) => {
    let s = String(g).split(/[;:]/)[0].trim();
    if (s.length > 140) s = `${s.slice(0, 137).replace(/\s+\S*$/, "")}…`;
    return s;
  };
  const collectGlosses = (entry, out, allowFormOf) => {
    for (const s of entry?.senses ?? []) {
      if ((s.tags ?? []).some((t) => BAD_SENSE_TAGS.has(String(t).toLowerCase()))) continue;
      const g = (s.g ?? [])[0];
      if (!g || (!allowFormOf && FORM_OF_GLOSS.test(String(g)))) continue;
      const short = shorten(g);
      if (short && !out.includes(short)) out.push(short);
      if (out.length >= 3) return;
    }
  };
  // gloss có thể là "Alternative form of all right; satisfactory; okay" → xét cả bản cắt trước
  // dấu ; để không sót (đây là cách bản trước đây bắt được "alright").
  const rawG0 = String((e?.senses ?? [])[0]?.g?.[0] ?? "").trim();
  const spellingOf = (SPELLING_OF.exec(rawG0) ?? SPELLING_OF.exec(rawG0.split(/[;:]/)[0].trim()))?.[1]?.toLowerCase().trim();
  if (spellingOf && spellingOf !== id) variantOf.set(id, spellingOf);

  const meaning_en = [];
  collectGlosses(e, meaning_en, false);
  if (!meaning_en.length) {
    // Cả entry chỉ là con trỏ ("past participle of piss off", "Alternative spelling of labour")
    // → ĐI THEO con trỏ lấy nghĩa thật, đừng bày cái con trỏ ra cho người học đọc.
    const pointer = (e?.senses ?? []).map((s) => String((s.g ?? [])[0] ?? "")).find((g) => FORM_OF_GLOSS.test(g));
    const target = pointer?.match(/\bof ([a-z][a-z' -]*)/i)?.[1]?.trim().toLowerCase().replace(/[.,]$/, "");
    if (target && target !== id) collectGlosses(kk.get(target), meaning_en, false);
    if (!meaning_en.length) collectGlosses(e, meaning_en, true); // hết cách thì giữ nguyên như cũ
  }

  // register: tag của sense ĐẦU TIÊN (tránh over-tag vì nghĩa phụ)
  const register = [];
  const s0 = (e?.senses ?? [])[0];
  for (const t of s0?.tags ?? []) {
    const r = REGISTER_TAGS[String(t).toLowerCase()];
    if (r && !register.includes(r)) register.push(r);
  }

  // forms: mọi dạng biến hình sạch (cho lemma-map + tra ngược)
  const formSet = new Set();
  let past = null, participle = null, plural = null;
  for (const f of e?.forms ?? []) {
    const form = String(f.f).toLowerCase();
    if (!CLEAN_FORM.test(form) || form === id) continue;
    const tags = (f.tags ?? []).map((t) => String(t).toLowerCase());
    if (tags.includes("table-tags") || tags.includes("inflection-template") || tags.includes("class")) continue;
    if (tags.includes("alternative") || tags.includes("obsolete") || tags.includes("archaic") || tags.includes("nonstandard")) continue; // chính tả sai/cũ — không đưa vào lemma-map
    formSet.add(form);
    if (f.pos === "v" || posSet.has("v") || posSet.has("phr-v")) {
      if (tags.includes("past") && tags.includes("participle")) participle ??= form;
      else if (tags.includes("past")) past ??= form;
    }
    if (f.pos === "n" && tags.includes("plural") && !tags.includes("past")) plural ??= form;
  }

  // bất quy tắc? (so với quy tắc -ed / -s cơ bản)
  const regularPast = (w) => (/e$/.test(w) ? `${w}d` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ied` : `${w}ed`);
  // chỉ ĐỘNG TỪ mới có bảng V1–V2–V3 (đừng để "full stop" hiện "full stopped" vì kaikki có
  // một nghĩa "alternative form of" mang từ loại verb)
  const isVerbWord = posSet.has("v") || posSet.has("phr-v") || posSet.has("vaux");
  const irregular = isVerbWord && past && participle && past !== regularPast(id) ? { past, participle } : undefined;
  const regularPlural = (w) => (/(s|sh|ch|x|z)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
  const irrPlural = plural && posSet.has("n") && plural !== regularPlural(id) ? plural : undefined;

  const variants = [...(labeledEntry?.variants ?? [])].filter((v) => CLEAN_FORM.test(v) && v !== id);
  const search = [id, ...variants, ...formSet].join(" ").toLowerCase().replace(/[^a-z0-9 ]+/g, "");

  return {
    id,
    ipa,
    pos: [...posSet],
    ...(irregular ? { irregular } : {}),
    ...(irrPlural ? { plural: irrPlural } : {}),
    ...(variants.length ? { variants } : {}),
    ...(register.length ? { register } : {}),
    meaning_vi: "", // stage 2: agent dịch
    meaning_en,
    level,
    frequency: 0, // điền sau khi xếp hạng
    forms: [...formSet],
    search,
  };
}

// Bỏ từ RÁC: không có bất kỳ dữ liệu Wiktionary nào (không IPA + không nghĩa EN + không forms)
// → hoặc chính tả sai trong nguồn CEFR ("porten", "bereftly"), hoặc từ không tồn tại thật.
const JUNK = new Set();

// ---- 4b. vốn từ CÔNG VIỆC còn thiếu, lấy từ BSL (plan mục 6) ----
// BSL 1.01 (Browne & Culligan, CC BY-SA 4.0). Gán cấp theo tần suất và KHÔNG bao giờ xuống B1:
// đây là từ chuyên ngành, lộ trình B1 phải giữ nguyên vốn từ phổ thông.
const BSL_FILE = join(OUT, "bsl-101-lemmatized.txt");
// tiền tố/dạng ghép, không phải từ để học thành thẻ
const BSL_SKIP = new Set(["non", "pre", "mid", "sub", "multi", "mini", "inter", "neo", "macro", "ex"]);
const bslLevel = (z) => (z >= 4.0 ? 2 : z >= 3.2 ? 3 : 4);
const bslExtra = [];
if (existsSync(BSL_FILE)) {
  for (const line of readFileSync(BSL_FILE, "utf8").split(/\r?\n/)) {
    const id = line.split(",")[0]?.trim().toLowerCase();
    if (!id || BSL_SKIP.has(id) || labeled.has(id)) continue;
    const e = kk.get(id);
    if (!e || !usableEntry(e)) continue;
    bslExtra.push({ id, level: bslLevel(zipfOf(id)) });
  }
}

const all = [];
for (const [id, { level }] of labeled) all.push(buildWord(id, level));
for (const { id, level } of phrasal) all.push(buildWord(id, level));


// ---- 5a0. fill C1/C2: bỏ qua ứng viên là DẠNG CHIA của từ đã có ("areas" ⊂ "area") ----
const takenForms = new Set();
for (const w of all) {
  takenForms.add(w.id);
  for (const f of w.forms ?? []) takenForms.add(f);
}
let skippedForms = 0;
for (const { id, z } of fillCandidates) {
  if (counts[3] >= QUOTA[3] && counts[4] >= QUOTA[4]) break;
  if (takenForms.has(id)) { skippedForms++; continue; }
  const lv = counts[3] < QUOTA[3] && z >= 2.6 ? 3 : counts[4] < QUOTA[4] ? 4 : null;
  if (lv === null) continue;
  const w = buildWord(id, lv);
  counts[lv]++;
  all.push(w);
  takenForms.add(id);
  for (const f of w.forms ?? []) takenForms.add(f);
}
console.error(`Fill C1/C2: bỏ qua ${skippedForms} dạng chia trùng lemma`);

// BSL vào SAU CÙNG: chỉ thêm từ công việc mà các nguồn trên không có, để không thổi phồng
// quota C1/C2 và không đụng vào bộ từ phổ thông đã ổn định.
let bslAdded = 0;
for (const { id, level } of bslExtra) {
  if (takenForms.has(id)) continue;
  const w = buildWord(id, level);
  all.push(w);
  takenForms.add(id);
  for (const f of w.forms ?? []) takenForms.add(f);
  bslAdded++;
}
console.error(`BSL bổ sung: ${bslAdded} từ công việc chưa có trong bộ`);

// ---- 5a. loại từ rác (không có dữ liệu Wiktionary nào)
for (let i = all.length - 1; i >= 0; i--) {
  const w = all[i];
  if (!w.ipa && !w.meaning_en.length && !(w.forms ?? []).length) {
    JUNK.add(w.id);
    all.splice(i, 1);
  }
}
console.error(`Loại từ rác: ${JUNK.size} (${[...JUNK].slice(0, 10).join(", ")}${JUNK.size > 10 ? "…" : ""})`);

// ---- 5b. gộp entry biến thể chính tả ("British standard spelling of behavior",
// "Alternative spelling of makeup"…) vào từ gốc: bỏ entry, thêm variants+forms cho gốc.
const byId = new Map(all.map((w) => [w.id, w]));
let mergedVariants = 0;
for (let i = all.length - 1; i >= 0; i--) {
  const w = all[i];
  const target = variantOf.get(w.id);
  if (!target) continue;
  const base = byId.get(target);
  if (!base || base === w) continue;
  base.variants = [...new Set([...(base.variants ?? []), w.id, ...(w.variants ?? [])])];
  base.forms = [...new Set([...(base.forms ?? []), w.id, ...(w.forms ?? [])])];
  base.search = `${base.search} ${w.search}`.trim();
  byId.delete(w.id);
  all.splice(i, 1);
  mergedVariants++;
}
console.error(`Gộp biến thể chính tả: ${mergedVariants} entry`);

// hạng tần suất: 1 = phổ biến nhất
all.sort((a, b) => zipfOf(b.id) - zipfOf(a.id));
all.forEach((w, i) => { w.frequency = i + 1; });

writeFileSync(join(OUT, "words-stage1.json"), JSON.stringify(all, null, 1));

// ---- báo cáo ----
const byLevel = {};
for (const w of all) byLevel[w.level] = (byLevel[w.level] ?? 0) + 1;
const pv = all.filter((w) => w.pos.includes("phr-v")).length;
const noIpa = all.filter((w) => !w.ipa).length;
const noEn = all.filter((w) => !w.meaning_en.length).length;
const irr = all.filter((w) => w.irregular).length;
console.error(`Tổng: ${all.length} từ`);
console.error(`Theo cấp: nền=${byLevel[0] ?? 0} B1=${byLevel[1] ?? 0} B2=${byLevel[2] ?? 0} C1=${byLevel[3] ?? 0} C2=${byLevel[4] ?? 0}`);
console.error(`Phrasal verbs: ${pv} · bất quy tắc: ${irr} · thiếu IPA: ${noIpa} · thiếu nghĩa EN: ${noEn}`);
