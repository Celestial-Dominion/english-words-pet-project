// Nhãn CEFR-J (scripts/cefrj-a1b2.csv, A1–B2) — dùng chung cho build-assemble (tách A1/A2 của bộ
// từ) và en-vocab (kiểm cấp học liệu). Headword nhiều cách viết ("a.m./A.M./am/AM") tính cho
// từng cách; một từ có nhiều dòng (nhiều từ loại) lấy nhãn THẤP nhất.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let CACHE = null;

/** Map headword (chữ thường) → "A1" | "A2" | "B1" | "B2". */
export function loadCefrj() {
  if (CACHE) return CACHE;
  const cefrj = new Map();
  for (const line of readFileSync(join(import.meta.dirname, "..", "cefrj-a1b2.csv"), "utf8").split("\n").slice(1)) {
    const [hw, , c] = line.split(",");
    if (!hw || !c) continue;
    for (const h of hw.split("/")) {
      const k = h.trim().toLowerCase();
      if (k && (!cefrj.has(k) || c < cefrj.get(k))) cefrj.set(k, c);
    }
  }
  CACHE = cefrj;
  return cefrj;
}

/**
 * Level của một từ thuộc bộ A1–A2 (trước 10/2026 là "bộ nền" level 0 chỉ tra cứu): nhãn CEFR-J
 * A1 → -1 (cấp A1), còn lại → 0 (cấp A2). PHẢI khớp lib/levels.ts (A1 = -1, A2 = 0).
 */
export function foundationLevel(id) {
  return loadCefrj().get(id) === "A1" ? -1 : 0;
}

// Từ loại CEFR-J → mã từ loại của app (lib/pos.ts).
const POS_MAP = {
  noun: "n", adjective: "adj", verb: "v", adverb: "adv", pronoun: "pron", preposition: "prep", determiner: "det",
  conjunction: "conj", number: "num", "modal auxiliary": "vaux", "be-verb": "v", "do-verb": "v", "have-verb": "v",
  interjection: "intj", "infinitive-to": "prep",
};
let POS_CACHE = null;

/**
 * Từ loại của một headword theo CEFR-J, cấp dễ trước (A1 → B2), tối đa `max` — nguồn từ loại cho bộ A1–A2:
 * kaikki gắn cả từ loại hiếm ("and" danh từ/động từ) mà thẻ học hiện hết. [] nếu CEFR-J không có từ.
 */
export function cefrjPos(id, max = 3) {
  if (!POS_CACHE) {
    POS_CACHE = new Map();
    const rows = readFileSync(join(import.meta.dirname, "..", "cefrj-a1b2.csv"), "utf8").split("\n").slice(1);
    rows.forEach((line, i) => {
      const [hw, pos, c] = line.split(",");
      if (!hw || !c || !POS_MAP[pos]) return;
      for (const h of hw.split("/")) {
        const k = h.trim().toLowerCase();
        if (!k) continue;
        if (!POS_CACHE.has(k)) POS_CACHE.set(k, []);
        POS_CACHE.get(k).push({ pos: POS_MAP[pos], c, i });
      }
    });
  }
  const list = (POS_CACHE.get(id) ?? []).slice().sort((a, b) => a.c.localeCompare(b.c) || a.i - b.i);
  return [...new Set(list.map((x) => x.pos))].slice(0, max);
}
