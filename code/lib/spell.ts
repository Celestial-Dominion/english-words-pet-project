// Chấm bài GÕ CHÍNH TẢ — hàm thuần, không đụng React/DB nên unit-test thẳng được.
// Quyết định sư phạm: chịu SAI 1 KÝ TỰ (gõ trên điện thoại rất dễ trượt phím) — vẫn tính đúng
// nhưng báo "suýt đúng" kèm chính tả chuẩn để người học nhìn lại.

/** Chuẩn hoá trước khi so: thường hoá, gộp khoảng trắng, nháy cong → nháy thẳng, bỏ dấu câu cuối. */
export function normalizeSpelling(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Khoảng cách Levenshtein, dừng sớm khi đã vượt `max` (không cần tính chính xác phần lớn hơn). */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1; // cả hàng đã vượt ngưỡng → không thể quay lại dưới ngưỡng
    prev = cur;
  }
  return prev[b.length];
}

export type SpellVerdict = "exact" | "close" | "wrong";

/** "exact" = đúng y hệt · "close" = lệch đúng 1 ký tự (vẫn tính đúng) · "wrong" = sai. */
export function gradeSpelling(input: string, answer: string): SpellVerdict {
  const a = normalizeSpelling(input);
  const b = normalizeSpelling(answer);
  if (!a) return "wrong";
  if (a === b) return "exact";
  return editDistance(a, b, 1) <= 1 ? "close" : "wrong";
}

/** Có tính là trả lời đúng cho FSRS không (suýt đúng vẫn tính đúng). */
export const isSpellCorrect = (v: SpellVerdict): boolean => v !== "wrong";

// ---- Độ "nhìn giống nhau" giữa hai TỪ tiếng Anh (cho distractor trắc nghiệm) ----
// Ý tưởng từ app HSK (distractor chung bộ/nét ép phân biệt MẶT CHỮ): với tiếng Anh,
// cặp gây nhầm là từ gần giống chính tả — affect/effect, adapt/adopt, quite/quiet.
// Phương án nhiễu giống mặt chữ buộc phải ĐỌC KỸ từ thay vì nhận mẫu chữ cái đầu.
// Điểm: 0 = không giống (bỏ qua) · càng cao càng dễ nhầm. Chỉ nhận lệch ≤2 ký tự
// (từ ngắn ≤4 chữ chỉ nhận lệch 1 — "cat/car" đã là khác rõ, đừng nới thêm).
export function lookalikeScore(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 2) return 0;
  const maxDist = Math.min(la, lb) <= 4 ? 1 : 2;
  const d = editDistance(a, b, maxDist);
  if (d > maxDist) return 0;
  let s = 3 - d; // lệch 1 ký tự = 2 điểm, lệch 2 = 1 điểm
  if (la === lb) s += 0.5; // cùng độ dài — nhìn thoáng qua y hệt
  if (a[0] === b[0]) s += 0.5; // cùng chữ cái đầu — mắt lướt hay chỉ bám đầu từ
  return s;
}
