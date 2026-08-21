// Dọn public/data/lemma-map.json (dạng biến hình → lemma).
//
// Chạy:  node scripts/clean-lemma-map.mjs          (sửa file thật)
//        node scripts/clean-lemma-map.mjs --dry    (chỉ in thống kê)
//
// CHẠY SAU scripts/fix-irregular.mjs — luật (C) đồng bộ lại theo `forms` đã được dọn.
//
// Ba luật xoá:
//   (A) `form` CHÍNH NÓ là một word id (có trong word-levels.json) và form !== lemma.
//       lib/data.ts:lookupWord tra lemma-map TRƯỚC word-levels, nên những entry này
//       khiến bấm-tra-từ nhảy sai ("is" → i, "book" → bake, "ground" → grind).
//       Ngoại lệ: WHITELIST các dạng bất quy tắc THẬT (was → be, went → go…).
//   (B) form sinh máy từ hư từ / danh từ không phải động từ (anding, atted, "more in").
//   (C) đồng bộ: entry không suy ra được từ `forms`/`variants` hiện tại của bộ từ và
//       cũng không phải dạng rút gọn (don't, won't…) → rác còn sót.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LEVEL_FILES, NOT_A_VERB } from "./fix-irregular.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "public", "data");

// ---------------------------------------------------------------------------
// WHITELIST: form → lemma được GIỮ dù `form` cũng là một word id độc lập.
// Chỉ gồm dạng bất quy tắc THẬT — nhảy về nguyên thể có ích hơn là ở lại mặt chữ.
// ---------------------------------------------------------------------------
const WL = (lemma, ...forms) => forms.map((f) => `${f}\t${lemma}`);
export const WHITELIST = new Set([
  ...WL("be", "was", "were", "been", "am", "is", "are"),
  ...WL("go", "went", "gone"),
  ...WL("have", "had", "has"),
  ...WL("do", "did", "does", "done"),
  ...WL("say", "said"),
  ...WL("make", "made"),
  ...WL("take", "took", "taken"),
  ...WL("see", "saw", "seen"),
  ...WL("come", "came"),
  ...WL("get", "got", "gotten"),
  ...WL("find", "found"),
  ...WL("leave", "left"),
  ...WL("feel", "felt"),
  ...WL("keep", "kept"),
  ...WL("tell", "told"),
  ...WL("become", "became"),
  ...WL("think", "thought"),
  ...WL("bring", "brought"),
  ...WL("buy", "bought"),
  ...WL("catch", "caught"),
  ...WL("teach", "taught"),
  ...WL("sell", "sold"),
  ...WL("hold", "held"),
  ...WL("meet", "met"),
  ...WL("run", "ran"),
  ...WL("sit", "sat"),
  ...WL("stand", "stood"),
  ...WL("lose", "lost"),
  ...WL("pay", "paid"),
  ...WL("mean", "meant"),
  ...WL("send", "sent"),
  ...WL("build", "built"),
  ...WL("spend", "spent"),
  ...WL("win", "won"),
  ...WL("fall", "fell", "fallen"),
  ...WL("know", "knew", "known"),
  ...WL("grow", "grew", "grown"),
  ...WL("draw", "drew", "drawn"),
  ...WL("throw", "threw", "thrown"),
  ...WL("fly", "flew", "flown"),
  ...WL("wear", "wore", "worn"),
  ...WL("break", "broke", "broken"),
  ...WL("speak", "spoke", "spoken"),
  ...WL("choose", "chose", "chosen"),
  ...WL("rise", "rose", "risen"),
  ...WL("write", "wrote", "written"),
  ...WL("drive", "drove", "driven"),
  ...WL("ride", "rode", "ridden"),
  ...WL("eat", "ate", "eaten"),
  ...WL("give", "gave", "given"),
  ...WL("forget", "forgot", "forgotten"),
  ...WL("begin", "began", "begun"),
  ...WL("drink", "drank", "drunk"),
  ...WL("sing", "sang", "sung"),
  ...WL("swim", "swam", "swum"),
  ...WL("ring", "rang", "rung"),
  ...WL("sink", "sank", "sunk"),
  ...WL("hang", "hung"),
  ...WL("lead", "led"),
  ...WL("feed", "fed"),
  ...WL("bleed", "bled"),
  ...WL("speed", "sped"),
  ...WL("sleep", "slept"),
  ...WL("weep", "wept"),
  ...WL("creep", "crept"),
  ...WL("sweep", "swept"),
  ...WL("deal", "dealt"),
  ...WL("light", "lit"),
  ...WL("bite", "bitten"), // "bit" KHÔNG whitelist: danh từ "một chút" phổ biến hơn nhiều
  ...WL("hide", "hid", "hidden"),
  ...WL("slide", "slid"),
  ...WL("shoot", "shot"),
  ...WL("strike", "struck"),
  ...WL("stick", "stuck"),
  ...WL("dig", "dug"),
  ...WL("spin", "spun"),
  ...WL("sting", "stung"),
  ...WL("swing", "swung"),
  ...WL("cling", "clung"),
  ...WL("fling", "flung"),
  ...WL("wring", "wrung"),
  ...WL("string", "strung"),
  ...WL("shrink", "shrank", "shrunk"),
  ...WL("spring", "sprang", "sprung"),
  ...WL("sew", "sewn"),
  ...WL("mow", "mown"),
  ...WL("show", "shown"),
  ...WL("sow", "sown"),
  ...WL("blow", "blown"),
  // bổ sung: dạng bất quy tắc thật, cũng là word id, không có trong danh sách gốc
  ...WL("bend", "bent"),
  ...WL("freeze", "frozen"),
  ...WL("forbid", "forbidden"),
  ...WL("prove", "proven"),
  ...WL("swell", "swollen"),
  ...WL("withdraw", "withdrawn"),
  ...WL("bind", "bound"),
  ...WL("wind", "wound"),
  ...WL("bear", "bore"),
  ...WL("dive", "dove"),
  ...WL("shake", "shaken"),
  ...WL("swear", "sworn"),
  ...WL("tear", "torn"),
  ...WL("steal", "stolen"),
  ...WL("wake", "woken"),
  ...WL("mistake", "mistaken"),
]);

// ---------------------------------------------------------------------------
const CONTRACTIONS = new Set([
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "ain't",
  "haven't", "hasn't", "hadn't", "won't", "wouldn't", "can't", "cannot",
  "couldn't", "shouldn't", "mustn't", "shan't", "needn't",
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
  "he's", "he'll", "he'd", "she's", "she'll", "she'd", "it's", "it'll", "it'd",
  "we're", "we've", "we'll", "we'd", "they're", "they've", "they'll", "they'd",
  "that's", "there's", "here's", "what's", "who's", "let's", "gonna", "wanna", "gotta",
]);

/**
 * @param lemmaMap  {form: lemma}
 * @param wordLevels {id: level}
 * @param words     mảng Word đã dọn (nguồn để đối chiếu `forms`/`variants`)
 */
export function cleanLemmaMap(lemmaMap, wordLevels, words) {
  // Dạng nào còn suy ra được từ bộ từ hiện tại, và từ lemma NÀO?
  // Ưu tiên lemma tần suất cao hơn — đúng luật của scripts/build-assemble.mjs.
  const derivable = new Map();
  for (const w of words) {
    for (const f of [...(w.forms ?? []), ...(w.variants ?? [])]) {
      const k = String(f).toLowerCase();
      if (k === w.id) continue;
      const cur = derivable.get(k);
      if (!cur || w.frequency < cur.frequency) derivable.set(k, { id: w.id, frequency: w.frequency });
    }
  }

  const out = {};
  const dropped = { collision: [], notVerb: [], stale: [] };
  const repointed = [];
  for (const [form, original] of Object.entries(lemmaMap)) {
    // (C) đồng bộ với `forms` hiện tại: mất nguồn → xoá; đổi nguồn → trỏ lại
    // ("het" từng là dạng bịa của hit; sau khi dọn nó chỉ còn là dạng cổ của heat)
    let lemma = original;
    const d = derivable.get(form);
    if (!d) {
      if (!CONTRACTIONS.has(form)) {
        dropped.stale.push(`${form} → ${original}`);
        continue;
      }
    } else if (d.id !== lemma && !CONTRACTIONS.has(form)) {
      lemma = d.id;
      repointed.push(`${form}: ${original} → ${lemma}`);
    }
    // (A) form là word id độc lập → để lookupWord rơi về chính nó
    if (Object.prototype.hasOwnProperty.call(wordLevels, form) && form !== lemma) {
      if (!WHITELIST.has(`${form}\t${lemma}`)) {
        dropped.collision.push(`${form} → ${lemma}`);
        continue;
      }
    }
    // (B) dạng động từ / so sánh bịa ra từ hư từ, danh từ
    if (NOT_A_VERB.has(lemma) && form !== lemma) {
      if (/(ed|ing|en|t)$/.test(form) || /^(more|most) /.test(form)) {
        dropped.notVerb.push(`${form} → ${lemma}`);
        continue;
      }
    }
    out[form] = lemma;
  }
  return { map: out, dropped, repointed };
}

// ---------------------------------------------------------------------------
function main() {
  const dry = process.argv.includes("--dry");
  const p = join(DATA, "lemma-map.json");
  const raw = readFileSync(p, "utf8");
  const lemmaMap = JSON.parse(raw);
  const wordLevels = JSON.parse(readFileSync(join(DATA, "word-levels.json"), "utf8"));
  const words = LEVEL_FILES.flatMap((s) =>
    JSON.parse(readFileSync(join(DATA, "words", `${s}.json`), "utf8")),
  );

  const { map, dropped, repointed } = cleanLemmaMap(lemmaMap, wordLevels, words);
  const out = JSON.stringify(map, null, 0); // GIỮ ĐÚNG format hiện có (minified)

  const before = Object.keys(lemmaMap).length;
  const after = Object.keys(map).length;
  const show = (label, arr, n = 60) => {
    console.log(`\n${label}: ${arr.length}`);
    console.log("  " + arr.slice(0, n).join(", ") + (arr.length > n ? ` … +${arr.length - n} nữa` : ""));
  };
  console.log(`lemma-map: ${before} → ${after} entry (xoá ${before - after})`);
  console.log(`kích thước: ${raw.length} → ${out.length} byte`);
  show("(A) form trùng word id khác → tra sai từ", dropped.collision, 500);
  show("(B) dạng bịa từ hư từ / danh từ", dropped.notVerb, 120);
  show("(C) rác còn sót (không suy ra được từ `forms`)", dropped.stale, 120);
  show("(C) trỏ lại lemma đúng", repointed, 60);
  if (!dry) writeFileSync(p, out);
  else console.log("\n(--dry: KHÔNG ghi file)");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
