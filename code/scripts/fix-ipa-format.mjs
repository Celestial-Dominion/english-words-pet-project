// Chuẩn hoá cách bọc IPA: kaikki trả lẫn hai kiểu — /ˈwɔːtɚ/ (âm vị, chuẩn của app) và
// [tʰu̟(ː)] (phiên âm ngữ âm hẹp). App hiển thị thẳng chuỗi này nên hai kiểu nằm cạnh nhau
// trong cùng danh sách trông như lỗi; ngoặc vuông còn hay kèm ký hiệu ngữ âm hẹp (tʰ, ɫ, ɐ)
// mà người học không cần.
//
//   node scripts/fix-ipa-format.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA = join(import.meta.dirname, "..", "public", "data", "words");
const LEVELS = ["foundation", "b1", "b2", "c1", "c2"];
const DRY = process.argv.includes("--dry");

let fixed = 0;
const samples = [];
for (const lv of LEVELS) {
  const file = join(DATA, `${lv}.json`);
  const words = JSON.parse(readFileSync(file, "utf8"));
  let touched = 0;
  for (const w of words) {
    if (typeof w.ipa !== "string" || !w.ipa.startsWith("[")) continue;
    const inner = w.ipa.replace(/^\[/, "").replace(/\]$/, "").trim();
    if (!inner) continue;
    if (samples.length < 6) samples.push(`${w.id}: ${w.ipa} → /${inner}/`);
    w.ipa = `/${inner}/`;
    touched++;
  }
  if (touched && !DRY) writeFileSync(file, JSON.stringify(words, null, 1));
  fixed += touched;
  if (touched) console.log(`  ${lv}: ${touched}`);
}
console.log(`IPA chuẩn hoá [ ] → / /: ${fixed} từ${DRY ? " (chỉ thử, chưa ghi)" : ""}`);
if (samples.length) console.log(`  ví dụ: ${samples.join(" · ")}`);
