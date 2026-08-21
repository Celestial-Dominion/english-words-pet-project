// ASCII-hoá tên/chuỗi để đặt tên file & tìm kiếm (tiếng Anh gần như toàn ASCII, giữ để an toàn).
// Bài học từ app HSK: KHÔNG dùng thẳng chữ có dấu làm tên file — dùng slug + hash ngay từ đầu.

// Ligature (œ, æ — gặp trong từ mượn) không được NFD tách ra → xử lý tay trước khi bỏ dấu.
const LIGATURES: Record<string, string> = {
  œ: "oe",
  Œ: "OE",
  æ: "ae",
  Æ: "AE",
};

/** Bỏ dấu: "école" → "ecole", "cœur" → "coeur", "à" → "a". Giữ nguyên hoa/thường & khoảng trắng. */
export function deburr(input: string): string {
  const replaced = input.replace(/[œŒæÆ]/g, (ch) => LIGATURES[ch] ?? ch);
  // NFD tách ký tự gốc + dấu tổ hợp (U+0300–U+036F) rồi loại dấu.
  return replaced.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Chuỗi tìm kiếm không dấu, chữ thường: "l'École" → "lecole". Dùng cho trường Word.search. */
export function toSearch(input: string): string {
  return deburr(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Slug đọc được cho URL/tên file: "une école" → "une-ecole". Không đảm bảo duy nhất. */
export function slug(input: string): string {
  return deburr(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Hash ngắn 4 ký tự base36 từ chuỗi gốc (djb2) — chống trùng tên file một cách tất định. */
export function hash4(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // ép về 32-bit không dấu rồi base36, pad 4 ký tự.
  return (h >>> 0).toString(36).slice(0, 4).padStart(4, "0");
}

/**
 * Tên file audio tất định & duy nhất cho một chuỗi hiển thị.
 * "une école" → "une-ecole-3f2a". Hash lấy từ chuỗi gốc nên hai từ khác dấu không đụng nhau.
 */
export function audioName(display: string): string {
  const base = slug(display) || "x";
  return `${base}-${hash4(display)}`;
}

/**
 * Hash dài (~13 ký tự base36) từ 2 hàm băm 32-bit độc lập (djb2 + sdbm) → ~64-bit.
 * Dùng đặt tên file audio CÂU (không có slug đọc được), chống trùng cho hàng chục nghìn câu.
 */
export function hashLong(input: string): string {
  let h1 = 5381; // djb2
  let h2 = 0; // sdbm
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (c + (h2 << 6) + (h2 << 16) - h2) | 0;
  }
  const a = (h1 >>> 0).toString(36);
  const b = (h2 >>> 0).toString(36);
  return `${a}${b.padStart(7, "0")}`;
}
