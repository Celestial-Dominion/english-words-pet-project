// Lắp ráp public/data từ stage1 + bản dịch VI (vi-done/*.json).
// Chạy: node scripts/build-assemble.mjs
// Ra: public/data/words/{b1..c2,foundation}.json + word-levels + lemma-map
// Chỉ xuất từ ĐÃ có nghĩa VI (làm dần theo cấp — từ chưa dịch giữ lại stage1, không mất).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
// Nguồn stage1 (Wiktionary) sinh khá nhiều dạng động từ bịa — "yet → yetted", "put → putten",
// và gắn nhãn bất quy tắc cho ~600 động từ quy tắc. Hai module dưới đây là LUẬT DỌN, chạy
// ngay trong pipeline để bản build sau không đẻ lại rác (chúng cũng chạy độc lập được:
// node scripts/fix-irregular.mjs · node scripts/clean-lemma-map.mjs).
import { fixWords, newStats } from "./fix-irregular.mjs";
import { cleanLemmaMap } from "./clean-lemma-map.mjs";
import { patchRegister } from "./fix-register.mjs";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");
const DONE_DIR = join(HERE, "vi-done");
const DATA = join(HERE, "..", "public", "data");
mkdirSync(join(DATA, "words"), { recursive: true });

const words = JSON.parse(readFileSync(join(OUT, "words-stage1.json"), "utf8"));

// gộp bản dịch
const vi = new Map();
for (const f of existsSync(DONE_DIR) ? readdirSync(DONE_DIR) : []) {
  if (!f.endsWith(".json")) continue;
  const obj = JSON.parse(readFileSync(join(DONE_DIR, f), "utf8"));
  for (const [id, v] of Object.entries(obj)) {
    if (v && typeof v.vi === "string" && v.vi.trim()) vi.set(id, v);
  }
}

const SLUG = { 0: "foundation", 1: "b1", 2: "b2", 3: "c1", 4: "c2" };
const byLevel = { 0: [], 1: [], 2: [], 3: [], 4: [] };
let translated = 0;
for (const w of words) {
  const t = vi.get(w.id);
  if (!t) continue;
  translated++;
  // `search` phải khớp lib/slug.ts:toSearch (bỏ mọi ký tự không phải a-z0-9) — nếu giữ khoảng
  // trắng thì gõ "give up" (→ "giveup") không khớp được chuỗi "give up ..." trong search.
  const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  const searchTokens = [...new Set([w.id, ...(w.variants ?? []), ...(w.forms ?? [])].map(norm).filter(Boolean))];
  const out = { ...w, meaning_vi: t.vi.trim(), search: searchTokens.join(" ") };
  const coll = (t.coll ?? []).map((c) => String(c).trim()).filter(Boolean).slice(0, 5);
  if (coll.length && w.level >= 1) out.collocations = coll;
  byLevel[w.level].push(out);
}

// family (họ từ): nối các lemma cùng gốc ĐÃ xuất. Không có nguồn hình thái từ mở nào trong
// pipeline này, nên suy từ hậu tố phái sinh + hai lớp chống nhầm:
//   1. ngưỡng độ dài gốc theo độ tin cậy của hậu tố (minLen; 99 = luôn phải kiểm chứng),
//   2. kiểm chứng bằng ĐỊNH NGHĨA tiếng Anh — gốc phải được nhắc trong nghĩa của từ phái sinh
//      (hoặc ngược lại). Đây là thứ chặn "legal → leg", "county → count", "ready → read".
const allOut = Object.values(byLevel).flat();
// dọn `irregular` + `forms` TRƯỚC khi sinh lemma-map (lemma-map lấy khoá từ `forms`)
const irrStats = fixWords(allOut, newStats());
// kaikki trả lẫn IPA âm vị /…/ và phiên âm hẹp […]; app hiển thị thẳng nên phải về một kiểu.
// Hai từ kaikki trả phiên âm kiểu Merriam-Webster (ô ē ī, gạch nối) chứ không phải IPA —
// override bằng IPA GenAm chuẩn (kiểm tra đợt rà nội dung 08/2026).
const IPA_OVERRIDE = {
  doorkeeper: "/ˈdɔɹˌkipɚ/",
  digitalize: "/ˈdɪdʒɪtəˌlaɪz/",
  // nhóm land/play: stage1 mang IPA "biến thể kép" ([A] ~ [B]) nên bước ghép từ ghép
  // trước đây dán cả cụm vào giữa — vá bằng GenAm chuẩn.
  land: "/lænd/",
  wetland: "/ˈwɛtlænd/",
  lowland: "/ˈloʊlænd/",
  overland: "/ˈoʊvɚˌlænd/",
  playoff: "/ˈpleɪˌɔf/",
  "play in": "/pleɪ ɪn/",
  "play on": "/pleɪ ɑn/",
  validity: "/vəˈlɪdəti/", // stage1 mang biến thể giữa chuỗi "ɪ~ə" — không tách máy được
};
let ipaFixed = 0;
for (const w of allOut) {
  if (typeof w.ipa !== "string" || !w.ipa) continue;
  const before = w.ipa;
  if (IPA_OVERRIDE[w.id]) w.ipa = IPA_OVERRIDE[w.id];
  // "[phiên âm hẹp]" trần → bọc / /
  if (w.ipa.startsWith("[")) {
    const inner = w.ipa.slice(1).replace(/\]$/, "").trim();
    if (inner) w.ipa = `/${inner}/`;
  }
  // "/âm vị/ [ngữ âm hẹp]" hoặc "/A/ ~ /B/" kép → giữ bản ĐẦU (người học chỉ cần một)
  const dual = w.ipa.match(/^(\/[^/]+\/)\s*[\[~]/);
  if (dual) w.ipa = dual[1];
  // thiếu "/" đóng (vd kaikki trả "/fəˈnɑli") → đóng lại
  if (w.ipa.startsWith("/") && !w.ipa.endsWith("/")) w.ipa = `${w.ipa}/`;
  if (w.ipa !== before) ipaFixed++;
}
if (ipaFixed) console.log(`IPA chuẩn hoá (bọc / /, bỏ bản ngữ âm hẹp, đóng ngoặc, override): ${ipaFixed} từ`);
const regFixed = patchRegister(allOut); // nhãn thô tục/miệt thị kaikki bỏ sót
if (regFixed) console.log(`register bổ sung: ${regFixed} từ`);
const byId = new Map(allOut.map((w) => [w.id, w]));
const SUFFIXES = [
  ["ability", 3], ["ibility", 3], ["ation", 3], ["ition", 3], ["ment", 3], ["ness", 3],
  ["ship", 3], ["hood", 3], ["ism", 3], ["ist", 3], ["ity", 3], ["ful", 3], ["less", 3],
  ["tion", 4], ["sion", 4], ["able", 4], ["ible", 4], ["ify", 4],
  ["wise", 4], ["ward", 4], ["ally", 4], ["ly", 4],
  ["ance", 99], ["ence", 99], ["ical", 99], ["ous", 99], ["ive", 99], ["al", 99],
  ["ize", 99], ["ise", 99], ["er", 99], ["or", 99], ["y", 99],
];
const E_SUFFIXES = new Set(["ation", "ition", "able", "ible"]); // gốc "+e" là chuẩn mực (explore → exploration)
const isVerb = (id) => !!byId.get(id)?.pos?.includes("v");

/**
 * Gốc ứng viên theo TỪNG hậu tố, hậu tố dài trước (quotation: "-ation"→quote đúng hơn
 * "-tion"→quota). Mỗi nhóm kèm cờ auto = nhận thẳng, khỏi kiểm chứng nghĩa.
 */
function famCandidates(id) {
  const groups = [];
  for (const [suf, minLen] of [...SUFFIXES].sort((a, b) => b[0].length - a[0].length)) {
    if (!id.endsWith(suf)) continue;
    const stem = id.slice(0, -suf.length);
    if (stem.length < 3) continue;
    const out = [];
    // gốc 3 ký tự (leg, cub, not) quá dễ trùng ngẫu nhiên → luôn bắt kiểm chứng nghĩa.
    const add = (base, auto) => {
      if (base !== id && base.length >= 3) out.push({ base, auto: auto && base.length >= 4 });
    };
    const auto = stem.length >= minLen;
    add(stem, auto);
    if (suf !== "ally" && stem.endsWith("i")) add(stem.slice(0, -1) + "y", auto); // reli(able) → rely
    if (suf === "ation" || suf === "ition") add(stem + "ate", auto); // don(ation) → donate
    if (stem.endsWith("iz") || stem.endsWith("is")) add(stem + "e", stem.length >= 5); // optimiz(ation) → optimize
    add(stem + "e", E_SUFFIXES.has(suf) && stem.length >= 5); // explor(ation) → explore
    if (suf === "sion") {
      // deci(sion) → decide · conclu(sion) → conclude · confu(sion) → confuse
      add(stem + "de", stem.length >= 4);
      add(stem + "se", stem.length >= 4);
    }
    if (/([bcdfglmnprst])\1$/.test(stem)) add(stem.slice(0, -1), false); // runn(er) → run
    if ((suf === "er" || suf === "or") && stem.length >= 5) {
      // danh từ chỉ tác nhân chỉ đáng tin khi gốc là ĐỘNG TỪ: computer ← compute, nhưng center ↛ cent
      add(stem, isVerb(stem));
      add(stem + "e", isVerb(stem + "e"));
    }
    if (out.length) groups.push(out);
  }
  return groups;
}

// Từ chức năng hay xuất hiện trong định nghĩa → không được coi là bằng chứng cùng họ.
const FAM_STOP = new Set(["not", "the", "and", "one", "any", "all", "who", "out", "off", "own", "use", "way", "act"]);

/** `host` có nhắc tới `target` trong định nghĩa tiếng Anh không (bỏ qua chính từ host). */
function mentionsWord(host, target) {
  const text = (host?.meaning_en ?? []).join(" ").toLowerCase();
  // gốc ngắn (≤4) phải khớp ĐÚNG token, không cho khớp tiền tố ("not" ↛ "notice").
  const exact = target.length <= 4;
  const key = target.length >= 6 ? target.slice(0, target.length - 1) : target;
  for (const t of text.match(/[a-z']+/g) ?? []) {
    if (t === host.id || t.startsWith(host.id)) continue; // "ready" trong nghĩa của chính "ready"
    if (t === target) return !FAM_STOP.has(target);
    if (!exact && t.startsWith(key) && t.length <= key.length + 4) return true;
  }
  return false;
}

let famAuto = 0;
let famGloss = 0;
for (const w of allOut) {
  if (w.id.includes(" ")) continue; // cụm đa từ không tham gia họ từ
  const fam = new Set(w.family ?? []);
  // hậu tố dài trước; dừng ở nhóm ĐẦU TIÊN nhận được gốc — tránh "-tion" cướp việc của "-ation".
  for (const group of famCandidates(w.id)) {
    const best = new Map(); // base -> có đường nào auto không
    for (const c of group) {
      if (byId.has(c.base)) best.set(c.base, (best.get(c.base) ?? false) || c.auto);
    }
    let hit = false;
    for (const [base, auto] of best) {
      if (auto) famAuto++;
      else if (mentionsWord(w, base) || mentionsWord(byId.get(base), w.id)) famGloss++;
      else continue;
      fam.add(base);
      hit = true;
    }
    if (hit) break;
  }
  if (fam.size) w.family = [...fam];
  else delete w.family;
}
// chiều ngược lại (decide <- decision)
const famBack = new Map();
for (const w of allOut) for (const f of w.family ?? []) {
  if (!famBack.has(f)) famBack.set(f, new Set());
  famBack.get(f).add(w.id);
}
for (const w of allOut) {
  const back = famBack.get(w.id);
  if (back) w.family = [...new Set([...(w.family ?? []), ...back])];
}

// xuất theo cấp
for (const [lv, arr] of Object.entries(byLevel)) {
  arr.sort((a, b) => a.frequency - b.frequency);
  writeFileSync(join(DATA, "words", `${SLUG[lv]}.json`), JSON.stringify(arr, null, 1));
}

// levels + lemma-map (chỉ những từ đã xuất). KHÔNG còn words-index.json: 868KB deploy kèm mà
// không nơi nào đọc — tìm kiếm xuyên cấp chạy bằng word-levels.json (156KB) + file từng cấp.
const wordLevels = Object.fromEntries(allOut.map((w) => [w.id, w.level]));
writeFileSync(join(DATA, "word-levels.json"), JSON.stringify(wordLevels, null, 0));

// Dạng RÚT GỌN: "don't" → do, "won't" → will. Không có bảng này thì reader tra hụt (phần trước
// dấu nháy của "don't" là "don" — không phải từ nào cả) hoặc tra SAI ("won't" → "won" → win).
// Plan mục 3.4 đã hẹn xử lý contraction; đây là chỗ làm.
const CONTRACTIONS = {
  "don't": "do", "doesn't": "do", "didn't": "do",
  "isn't": "be", "aren't": "be", "wasn't": "be", "weren't": "be", "ain't": "be",
  "haven't": "have", "hasn't": "have", "hadn't": "have",
  "won't": "will", "wouldn't": "will", "can't": "can", "cannot": "can", "couldn't": "can",
  "shouldn't": "should", "mustn't": "must", "shan't": "shall", "needn't": "need",
  "i'm": "i", "i've": "i", "i'll": "i", "i'd": "i",
  "you're": "you", "you've": "you", "you'll": "you", "you'd": "you",
  "he's": "he", "he'll": "he", "he'd": "he",
  "she's": "she", "she'll": "she", "she'd": "she",
  "it's": "it", "it'll": "it", "it'd": "it",
  "we're": "we", "we've": "we", "we'll": "we", "we'd": "we",
  "they're": "they", "they've": "they", "they'll": "they", "they'd": "they",
  "that's": "that", "there's": "there", "here's": "here", "what's": "what",
  "who's": "who", "let's": "let", "gonna": "go", "wanna": "want", "gotta": "get",
};

const lemmaMap = {};
for (const w of allOut) {
  for (const f of [...(w.forms ?? []), ...(w.variants ?? [])]) {
    const key = f.toLowerCase();
    if (key === w.id) continue;
    // dạng trùng giữa 2 lemma → ưu tiên lemma tần suất cao hơn (số rank nhỏ hơn)
    const cur = lemmaMap[key];
    if (!cur || w.frequency < cur.frequency) lemmaMap[key] = { id: w.id, frequency: w.frequency };
  }
}
// contraction ghi ĐÈ lên suy luận từ forms (bảng tay chính xác hơn)
const lemmaOut = Object.fromEntries(Object.entries(lemmaMap).map(([k, v]) => [k, v.id]));
let contractionsAdded = 0;
for (const [form, lemma] of Object.entries(CONTRACTIONS)) {
  if (!byId.has(lemma)) continue; // lemma đích phải có trong bộ từ mới tra được
  lemmaOut[form] = lemma;
  contractionsAdded++;
}
// Dạng nào TỰ NÓ đã là một word id thì phải để lookupWord rơi về chính nó — lib/data.ts tra
// lemma-map TRƯỚC word-levels, nên "book" → bake, "ground" → grind làm bấm-tra-từ nhảy sai.
const { map: lemmaClean, dropped } = cleanLemmaMap(lemmaOut, wordLevels, allOut);
writeFileSync(join(DATA, "lemma-map.json"), JSON.stringify(lemmaClean, null, 0));

const counts = Object.entries(byLevel).map(([lv, arr]) => `${SLUG[lv]}=${arr.length}`).join(" ");
const famWords = allOut.filter((w) => w.family?.length).length;
console.error(`Đã xuất ${translated}/${words.length} từ (${counts}) · lemma-map ${Object.keys(lemmaClean).length} entry`);
console.error(`Bất quy tắc: +${irrStats.added.length} thêm · ${irrStats.corrected.length} sửa · ${irrStats.removedRegular.length + irrStats.removedNotVerb.length} xoá nhãn sai · ${irrStats.formsRemoved} dạng bịa bỏ khỏi forms`);
console.error(`lemma-map dọn: -${dropped.collision.length} trùng word id · -${dropped.notVerb.length} dạng bịa · -${dropped.stale.length} rác sót`);
console.error(`Dạng rút gọn: +${contractionsAdded} (don't → do, won't → will…)`);
console.error(`Họ từ: ${famAuto} liên kết theo hậu tố + ${famGloss} liên kết được định nghĩa xác nhận · ${famWords} từ có họ`);
