// Gắn nhãn `register` cho các từ THÔ TỤC / MIỆT THỊ mà nguồn kaikki bỏ sót.
//
// Vì sao cần: word-detail hiện badge register để người học biết dùng từ ở đâu được. Vài từ có
// nghĩa CHÍNH là thô tục lại không có nhãn nào (`jerk off`, `bitch`, `horny`) — người học tưởng
// đó là từ trung tính rồi dùng nhầm chỗ. Danh sách cố ý NGẮN và chỉ gồm từ mà nghĩa phổ biến
// nhất là thô tục: những từ như `screw`, `bang`, `hell`, `damn`, `prick` có nghĩa thường dùng
// hoàn toàn bình thường nên KHÔNG gắn (nghĩa suồng sã đã ghi trong meaning_vi).
//
//   node scripts/fix-register.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA = join(import.meta.dirname, "..", "public", "data", "words");
const LEVELS = ["foundation", "b1", "b2", "c1", "c2"];
const DRY = process.argv.includes("--dry");

/** id → nhãn cần CÓ (thêm vào, không xoá nhãn sẵn có). */
export const REGISTER_PATCH = {
  "jerk off": "vulgar",
  "pissed off": "informal",
  bitch: "vulgar",
  horny: "vulgar",
  fag: "offensive",
};

/** Bổ sung nhãn cho một danh sách Word (dùng cả trong pipeline lẫn khi chạy độc lập). */
export function patchRegister(words) {
  let n = 0;
  for (const w of words) {
    const tag = REGISTER_PATCH[w.id];
    if (!tag) continue;
    const cur = w.register ?? [];
    if (cur.includes(tag)) continue;
    w.register = [...cur, tag];
    n++;
  }
  return n;
}

if (import.meta.filename === process.argv[1]) {
  let total = 0;
  for (const lv of LEVELS) {
    const file = join(DATA, `${lv}.json`);
    const words = JSON.parse(readFileSync(file, "utf8"));
    const n = patchRegister(words);
    if (n && !DRY) writeFileSync(file, JSON.stringify(words, null, 1));
    if (n) console.log(`  ${lv}: ${n}`);
    total += n;
  }
  console.log(`register bổ sung: ${total} từ${DRY ? " (chỉ thử)" : ""}`);
}
