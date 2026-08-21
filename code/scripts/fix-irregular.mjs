// Sửa trường `irregular` + `forms` của động từ trong public/data/words/*.json.
//
// Chạy:  node scripts/fix-irregular.mjs          (sửa file thật)
//        node scripts/fix-irregular.mjs --dry    (chỉ in thống kê, không ghi)
//
// Ba lớp lỗi được xử lý (theo đúng thứ tự ưu tiên trong fixWord):
//   1. NOT_A_VERB   — hư từ / danh từ bị máy sinh dạng động từ ("yet → yetted") → xoá `irregular`.
//   2. ZERO_CHANGE  — động từ không đổi dạng (put/put/put) → đặt lại past = participle = lemma.
//   3. IRREGULAR    — bảng tay cho các bất quy tắc bị gán sai (come → came/came).
//   4. Luật quy tắc — past === participle && khớp dạng thêm -ed/-d/-ied/-cked/gấp-đôi-phụ-âm
//      → đây là động từ QUY TẮC, xoá nhãn `irregular` (giữ nguyên `forms`).
//
// Cùng lúc dọn các dạng bịa trong `forms` (putten, setted, het…) và dựng lại `search`
// cho khớp (search sinh từ id + variants + forms, xem scripts/build-assemble.mjs).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORDS_DIR = join(HERE, "..", "public", "data", "words");
export const LEVEL_FILES = ["foundation", "b1", "b2", "c1", "c2"];

// ---------------------------------------------------------------------------
// 1. Động từ KHÔNG đổi dạng: V1 = V2 = V3
// ---------------------------------------------------------------------------
export const ZERO_CHANGE = new Set([
  "set", "hit", "put", "cut", "let", "cost", "hurt", "shut", "spread", "split",
  "burst", "cast", "broadcast", "upset", "quit", "bet", "shed", "rid", "slit",
  "thrust", "bid", "read", "forecast", "offset", "preset", "reset", "wed",
  "knit", "fit", "wet", "sweat",
  // biến thể có tiền tố, thêm nếu bộ từ có
  "overcast", "recast", "miscast", "rebroadcast", "outbid", "misread", "reread",
  "undercut", "typeset", "inset", "sublet", "rewed",
]);

// ---------------------------------------------------------------------------
// 2. Bảng tay: lemma → [past, participle]
// ---------------------------------------------------------------------------
export const IRREGULAR = {
  // V3 = V1
  come: ["came", "come"],
  become: ["became", "become"],
  overcome: ["overcame", "overcome"],
  run: ["ran", "run"],
  overrun: ["overran", "overrun"],
  rerun: ["reran", "rerun"],
  redo: ["redid", "redone"],
  // V2 = V1 nhưng V3 khác
  beat: ["beat", "beaten"],
  // đúng nhưng trùng dạng quy tắc → phải khai ở đây để luật (4) không xoá nhầm
  hear: ["heard", "heard"],
  overhear: ["overheard", "overheard"],
  rehear: ["reheard", "reheard"],
  // sai trong dữ liệu gốc
  spit: ["spat", "spat"],
  // trợ động từ: participle bịa (mayed / willed) → dùng chính dạng quá khứ, như can → could
  may: ["might", "might"],
  will: ["would", "would"],
  can: ["could", "could"],
  // Bất quy tắc THÔNG DỤNG vốn thiếu hẳn trường `irregular` (dạng đúng đã nằm sẵn trong
  // `forms`, chỉ chưa được gắn nhãn). Không đụng burn/learn/dream/leap: tiếng Anh Mỹ
  // hiện đại dùng dạng quy tắc (burned/learned…) nên để chúng là động từ quy tắc.
  bear: ["bore", "borne"],
  lead: ["led", "led"],
  ring: ["rang", "rung"],
  show: ["showed", "shown"],
  stick: ["stuck", "stuck"],
  strike: ["struck", "struck"],
  wind: ["wound", "wound"],
  sew: ["sewed", "sewn"],
  swell: ["swelled", "swollen"],
  prove: ["proved", "proven"],
};

// ---------------------------------------------------------------------------
// 3. Entry KHÔNG phải động từ (hư từ, danh từ) — xoá `irregular` + dạng động từ bịa.
//    Danh sách cố ý bảo thủ: chỉ liệt kê từ chắc chắn không dùng như động từ trong
//    tiếng Anh học thuật/đời thường. Các từ lưỡng lự (vet, bin, prep, scam, gig,
//    crib, wig, screenshot…) được GIỮ NGUYÊN.
// ---------------------------------------------------------------------------
export const NOT_A_VERB = new Set([
  // hư từ / từ chức năng
  "and", "at", "but", "in", "on", "they", "you", "just", "about", "more", "no",
  "one", "why", "yet", "yes", "lot", "times", "away", "must", "should", "self",
  "something", "anything", "everything", "really", "less", "despite", "way",
  "hey", "whom", "whose", "ahem",
  // tính từ không có nghĩa động từ
  "bad", "glad", "sad", "mad", "grim", "smug", "glum", "fun", "sorry", "daily", "super",
  // danh từ bị sinh dạng động từ
  "son", "internet", "membership", "hardship", "fellowship", "flagship",
  "peanut", "saucepan", "hedgehog", "octopus", "squid", "histogram", "telegram",
  "webcam", "barbershop", "nightclub", "caravan", "haircut", "handbag", "motel",
  "doorstep", "subplot", "subset", "backlog", "sir", "dad", "mom", "mum", "cad",
  "slob", "brat", "thug", "plum", "bun", "gem", "yen", "quid", "whim", "prom",
  "cub", "cod", "hen", "poly", "standby", "make-up", "hip-hop", "tomato",
  "lobster", "rose", "life", "night", "boy", "brother", "language", "wit",
  // danh từ ghép bị tách ra rồi chia như động từ ("downfall → downfell")
  "downfall", "intake", "outbreak", "landslide", "twilight", "flashlight", "fed up",
]);

// Động từ QUY TẮC nhưng mang dạng cổ nên luật (4) không bắt được.
export const FORCE_REGULAR = new Set(["fix", "bless"]);

// Dạng bịa không suy ra được bằng luật → liệt kê tay.
export const BAD_FORMS = {
  hit: ["het", "hitself"],
  yet: ["yoten", "yot", "yotten"],
  fit: ["fitten"],
  may: ["maying", "mayed"],
  "fed up": ["feds up"],
};

// Dạng biến hình THẬT, dù trông giống dạng quy tắc → không được xoá khỏi `forms`.
// (bet/betted, fit/fitted… đều tồn tại; ta chỉ chọn dạng phổ biến hơn làm `irregular`.)
export const KEEP_FORMS = new Set([
  "fitted", "wetted", "knitted", "betted", "wedded", "sweated", "beaten",
  "bade", "bidden", "spat",
  // dạng quy tắc thuộc NGHĨA KHÁC của cùng mặt chữ — vẫn là tiếng Anh thật
  "ringed", "winded", "leaded", "burnt", "dreamt", "learnt", "leapt",
]);

// Từ không so sánh hơn được → xoá "more X" / "most X" khỏi `forms`.
const NON_GRADABLE_EXTRA = new Set(["set", "cut", "broadcast", "offset", "read", "put", "reset"]);

// ---------------------------------------------------------------------------
// Sinh dạng quy tắc để nhận diện
// ---------------------------------------------------------------------------
const dbl = (l) => l + l.slice(-1);

function pastCandidates(l) {
  const s = new Set([l + "ed", l + "d", dbl(l) + "ed"]);
  if (l.endsWith("y")) s.add(l.slice(0, -1) + "ied");
  if (l.endsWith("e")) s.add(l.slice(0, -1) + "ed");
  if (l.endsWith("c")) s.add(l + "ked");
  return s;
}
function ingCandidates(l) {
  const s = new Set([l + "ing", dbl(l) + "ing"]);
  if (l.endsWith("e")) s.add(l.slice(0, -1) + "ing");
  if (l.endsWith("c")) s.add(l + "king");
  if (l.endsWith("ie")) s.add(l.slice(0, -2) + "ying");
  return s;
}
/** Dạng -en/-n bịa: putten, setten, comen, becomen, bursten… */
function enCandidates(l) {
  const s = new Set([l + "en", dbl(l) + "en", l + "ten", l + "n"]);
  if (l.endsWith("e")) s.add(l + "n");
  return s;
}

/**
 * `id` và `form` chỉ khác nhau ĐÚNG một từ → trả [từ gốc, từ đã chia].
 * Nhờ vậy luật dùng chung được cho "stop → stopped" và "turn down → turned down".
 */
function inflectedPair(id, form) {
  const a = id.split(" ");
  const b = String(form).split(" ");
  if (a.length !== b.length) return null;
  let idx = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (idx >= 0) return null; // khác nhau ở >1 từ → không phải chia dạng
    idx = i;
  }
  return idx < 0 ? null : [a[idx], b[idx]];
}

function isRegularPast(id, past) {
  const p = inflectedPair(id, past);
  return !!p && pastCandidates(p[0]).has(p[1]);
}

/** Ghép past/participle cho cụm động từ: "hold" + "hold up" → "held up". */
function applyToHead(id, inflected) {
  const parts = id.split(" ");
  parts[0] = inflected;
  return parts.join(" ");
}

// `search` phải khớp scripts/build-assemble.mjs (lib/slug.ts:toSearch).
const norm = (x) =>
  x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
export function buildSearch(w) {
  return [...new Set([w.id, ...(w.variants ?? []), ...(w.forms ?? [])].map(norm).filter(Boolean))].join(" ");
}

/**
 * Bỏ khỏi `forms` các dạng động từ bịa của `id`.
 * @param stripS  cũng bỏ "more X"/"most X" (dùng cho hư từ / từ không so sánh được)
 */
function stripFakeForms(w, { moreMost }) {
  const before = w.forms ?? [];
  if (!before.length) return 0;
  const explicit = new Set(BAD_FORMS[w.id] ?? []);
  const kept = before.filter((f) => {
    if (explicit.has(f)) return false;
    if (KEEP_FORMS.has(f)) return true;
    if (moreMost && /^(more|most) /.test(f)) return false;
    const pair = inflectedPair(w.id, f);
    if (!pair) return true;
    const [base, inf] = pair;
    if (inf === w.irregular?.past || inf === w.irregular?.participle) return true;
    if (f === w.irregular?.past || f === w.irregular?.participle) return true;
    if (ingCandidates(base).has(inf)) return true; // -ing luôn hợp lệ với động từ thật
    return !(pastCandidates(base).has(inf) || enCandidates(base).has(inf));
  });
  if (kept.length === before.length) return 0;
  w.forms = kept;
  return before.length - kept.length;
}

/** Với hư từ/danh từ: bỏ cả -ing lẫn -ed (chúng đều là dạng bịa), giữ -s (số nhiều thật). */
function stripVerbFormsFromNonVerb(w) {
  const before = w.forms ?? [];
  if (!before.length) return 0;
  const explicit = new Set(BAD_FORMS[w.id] ?? []);
  const kept = before.filter((f) => {
    if (explicit.has(f)) return false;
    if (/^(more|most) /.test(f)) return false;
    const pair = inflectedPair(w.id, f);
    if (!pair) return true;
    const [base, inf] = pair;
    return !(pastCandidates(base).has(inf) || ingCandidates(base).has(inf) || enCandidates(base).has(inf));
  });
  if (kept.length === before.length) return 0;
  w.forms = kept;
  return before.length - kept.length;
}

// ---------------------------------------------------------------------------
export function fixWords(words, stats) {
  for (const w of words) {
    const id = w.id;
    const headWord = id.split(" ")[0];
    const isVerbish = (w.pos ?? []).some((p) => p.includes("v"));
    const hadIrregular = !!w.irregular;
    const formsBefore = JSON.stringify(w.forms ?? []);

    // (1) không phải động từ
    if (NOT_A_VERB.has(id)) {
      if (hadIrregular) {
        delete w.irregular;
        stats.removedNotVerb.push(id);
      }
      stats.formsRemoved += stripVerbFormsFromNonVerb(w);
    } else if (FORCE_REGULAR.has(id)) {
      if (hadIrregular) {
        delete w.irregular;
        stats.removedRegular.push(id);
      }
    } else {
      // (2)+(3) bảng tay, áp cho cả cụm động từ theo từ đầu
      let target = null;
      if (ZERO_CHANGE.has(id)) target = [id, id];
      else if (IRREGULAR[id]) target = IRREGULAR[id];
      else if (id.includes(" ") && isVerbish) {
        if (ZERO_CHANGE.has(headWord)) target = [applyToHead(id, headWord), applyToHead(id, headWord)];
        else if (IRREGULAR[headWord])
          target = [applyToHead(id, IRREGULAR[headWord][0]), applyToHead(id, IRREGULAR[headWord][1])];
      }

      if (target) {
        const [past, participle] = target;
        const old = w.irregular;
        if (!old) stats.added.push(`${id}: ${past} / ${participle}`);
        else if (old.past !== past || old.participle !== participle)
          stats.corrected.push(`${id}: ${old.past}/${old.participle} → ${past}/${participle}`);
        w.irregular = { past, participle };
        stats.formsRemoved += stripFakeForms(w, { moreMost: NON_GRADABLE_EXTRA.has(id) });
      } else if (hadIrregular && w.irregular.past === w.irregular.participle && isRegularPast(id, w.irregular.past)) {
        // (4) động từ quy tắc bị gắn nhãn bất quy tắc
        delete w.irregular;
        stats.removedRegular.push(id);
      }
    }

    if (formsBefore !== JSON.stringify(w.forms ?? [])) {
      const s = buildSearch(w);
      if (s !== w.search) {
        w.search = s;
        stats.searchRebuilt++;
      }
    }
  }
  return stats;
}

export function newStats() {
  return {
    added: [], corrected: [], removedRegular: [], removedNotVerb: [],
    formsRemoved: 0, searchRebuilt: 0,
  };
}

// ---------------------------------------------------------------------------
function main() {
  const dry = process.argv.includes("--dry");
  const stats = newStats();
  let totalWords = 0;
  const sizes = [];
  for (const slug of LEVEL_FILES) {
    const p = join(WORDS_DIR, `${slug}.json`);
    const raw = readFileSync(p, "utf8");
    const words = JSON.parse(raw);
    totalWords += words.length;
    fixWords(words, stats);
    const out = JSON.stringify(words, null, 1); // GIỮ ĐÚNG format hiện có (indent 1 space)
    sizes.push(`${slug}: ${words.length} từ, ${raw.length} → ${out.length} byte`);
    if (!dry) writeFileSync(p, out);
  }

  const show = (label, arr, n = 40) => {
    console.log(`\n${label}: ${arr.length}`);
    console.log("  " + arr.slice(0, n).join("\n  ") + (arr.length > n ? `\n  … +${arr.length - n} nữa` : ""));
  };
  console.log(`Tổng ${totalWords} từ trong ${LEVEL_FILES.length} file`);
  sizes.forEach((s) => console.log("  " + s));
  show("THÊM `irregular` (trước đây thiếu)", stats.added);
  show("SỬA `irregular` (giá trị sai)", stats.corrected);
  show("XOÁ `irregular` — không phải động từ", stats.removedNotVerb, 200);
  show("XOÁ `irregular` — động từ QUY TẮC", stats.removedRegular, 25);
  console.log(`\nDạng bịa bỏ khỏi \`forms\`: ${stats.formsRemoved} · dựng lại \`search\`: ${stats.searchRebuilt} từ`);
  if (dry) console.log("\n(--dry: KHÔNG ghi file)");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
