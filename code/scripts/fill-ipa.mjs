// Vá IPA cho từ ghép/đa từ ("part-time", "according to", "give up") bằng cách GHÉP IPA
// của từng thành phần (đã có trong bộ hoặc trong kaikki-filtered). Trọng âm giữ nguyên
// từng phần — đủ tốt để hiển thị; audio vẫn do edge-tts đọc cả cụm.
// Chạy: node scripts/fill-ipa.mjs  (sửa tại chỗ out/words-stage1.json)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "out");
const words = JSON.parse(readFileSync(join(OUT, "words-stage1.json"), "utf8"));

// IPA của mọi từ đơn: ưu tiên bộ từ, bổ sung từ kaikki (US trước).
const ipaOf = new Map(words.filter((w) => w.ipa && !/[ -]/.test(w.id)).map((w) => [w.id, w.ipa]));
for (const line of readFileSync(join(OUT, "kaikki-filtered.jsonl"), "utf8").split("\n")) {
  if (!line) continue;
  const e = JSON.parse(line);
  const id = e.w.toLowerCase();
  if (ipaOf.has(id) || /[ -]/.test(id)) continue;
  const us = e.sounds?.find((s) => (s.tags ?? []).some((t) => /us|general-american|genam/i.test(t)));
  const ipa = (us ?? e.sounds?.[0])?.ipa;
  if (ipa) ipaOf.set(id, ipa);
}

const strip = (s) => s.replace(/^[\/[]|[/\]]$/g, "");

// Hậu tố phái sinh + phần IPA cộng thêm (General American). Chỉ dùng khi gốc CÓ IPA thật:
// "disappointing" = IPA(disappoint) + ɪŋ. Không đoán trọng âm — đủ tốt để hiển thị, audio
// vẫn là edge-tts đọc từ thật.
const SUFFIX_IPA = [
  ["ings", "ɪŋz"], ["ing", "ɪŋ"], ["ness", "nəs"], ["less", "ləs"], ["ment", "mənt"],
  ["fully", "fəli"], ["ful", "fəl"], ["ly", "li"], ["ers", "ɚz"], ["er", "ɚ"],
  ["ors", "ɚz"], ["or", "ɚ"], ["ists", "ɪsts"], ["ist", "ɪst"], ["ism", "ɪzəm"],
  ["ship", "ʃɪp"], ["hood", "hʊd"], ["wise", "waɪz"], ["ables", "əbəlz"], ["able", "əbəl"],
];
// Đuôi phát âm theo ký tự cuối của gốc: -s/-es và -ed đều có 3 biến thể.
const sEnding = (base) => (/[sʃʒtʃdʒzs]$/.test(base) ? "ɪz" : /[ptkfθ]$/.test(base) ? "s" : "z");
const edEnding = (base) => (/[td]$/.test(base) ? "ɪd" : /[ptkfsʃtʃθ]$/.test(base) ? "t" : "d");

/** IPA suy từ GỐC + hậu tố; null nếu không suy được. */
function fromSuffix(id) {
  const tryBase = (base) => ipaOf.get(base) ?? null;
  for (const [suf, add] of SUFFIX_IPA) {
    if (!id.endsWith(suf) || id.length - suf.length < 3) continue;
    const stem = id.slice(0, -suf.length);
    for (const base of [stem, `${stem}e`, stem.endsWith("i") ? `${stem.slice(0, -1)}y` : null]) {
      const ipa = base && tryBase(base);
      if (ipa) return `/${strip(ipa)}${add}/`;
    }
  }
  // số nhiều / ngôi thứ 3 (-s, -es) và quá khứ (-ed): đuôi phụ thuộc âm cuối của GỐC
  for (const [suf, kind] of [["es", "s"], ["s", "s"], ["ed", "ed"]]) {
    if (!id.endsWith(suf) || id.length - suf.length < 3) continue;
    const stem = id.slice(0, -suf.length);
    for (const base of [stem, `${stem}e`, stem.endsWith("i") ? `${stem.slice(0, -1)}y` : null]) {
      const ipa = base && tryBase(base);
      if (!ipa) continue;
      const core = strip(ipa);
      return `/${core}${kind === "s" ? sEnding(core) : edEnding(core)}/`;
    }
  }
  return null;
}

/** IPA của từ ghép viết liền: "sunglasses" = sun + glasses, "granddaughter" = grand + daughter. */
function fromCompound(id) {
  if (id.length < 6) return null;
  // thử phần đầu DÀI trước — ranh giới ghép thật thường nằm ở đó ("grand|daughter")
  for (let i = id.length - 3; i >= 3; i--) {
    const a = ipaOf.get(id.slice(0, i));
    const b = ipaOf.get(id.slice(i));
    if (a && b) return `/${strip(a)}${strip(b)}/`;
  }
  return null;
}

let filled = 0;
let bySuffix = 0;
let byCompound = 0;
// Nhiều vòng: từ vừa vá xong lại làm gốc cho từ khác ("glasses" vá xong mới ghép được
// "sunglasses"). Dừng khi một vòng không vá thêm được gì.
for (let pass = 0; pass < 4; pass++) {
const before = filled;
for (const w of words) {
  if (w.ipa) continue;
  const parts = w.id.split(/[ -]/).filter(Boolean);
  if (parts.length >= 2) {
    const ipas = parts.map((p) => ipaOf.get(p));
    if (ipas.every(Boolean)) {
      w.ipa = `/${ipas.map(strip).join(" ")}/`;
      filled++;
      continue;
    }
  }
  if (parts.length > 1) continue; // cụm mà thiếu IPA thành phần → chịu, không đoán
  const suf = fromSuffix(w.id);
  if (suf) {
    w.ipa = suf;
    filled++;
    bySuffix++;
    continue;
  }
  const comp = fromCompound(w.id);
  if (comp) {
    w.ipa = comp;
    filled++;
    byCompound++;
  }
}
// nạp kết quả vòng này vào bảng tra để vòng sau dùng được
for (const w of words) if (w.ipa && !/[ -]/.test(w.id) && !ipaOf.has(w.id)) ipaOf.set(w.id, w.ipa);
if (filled === before) break;
}

writeFileSync(join(OUT, "words-stage1.json"), JSON.stringify(words, null, 1));
const left = words.filter((w) => !w.ipa).length;
console.error(
  `Ghép IPA: +${filled} từ (đa từ ${filled - bySuffix - byCompound} · gốc+hậu tố ${bySuffix} · từ ghép ${byCompound}) · còn thiếu ${left}/${words.length}`,
);
