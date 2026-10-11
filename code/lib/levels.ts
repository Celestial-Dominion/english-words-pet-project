// Siêu dữ liệu cấp CEFR cho từ vựng tiếng Anh: 6 cấp học A1..C2.
//
// `level` là KHOÁ lưu trong thẻ ôn (ReviewRecord.level), word-levels.json và URL /hoc/{level}
// nên KHÔNG được đánh số lại: B1..C2 = 1..4 có từ ngày đầu (app viết cho người đã có nền A1–A2);
// A1 = -1, A2 = 0 thêm 10/2026 để người mới học được từ đầu. Trước đó cả 2.289 từ A1–A2 là
// "bộ nền" level 0 chỉ để tra cứu — nay tách theo nhãn CEFR-J (A1 → -1, còn lại → 0), đúng luật
// scripts/lib/en-vocab.mjs vẫn dùng để gán band học liệu. Thứ tự độ khó: band = level + 1.
// A1 và A2 dùng CHUNG file foundation.json (levelSlug) — loadWords lọc theo level.

export interface LevelMeta {
  level: number; // -1..4
  label: string; // nhãn UI
  cefr: string; // A1..C2
  words: number; // SỐ TỪ THẬT trong public/data/words (A1/A2: số từ mang level đó trong foundation.json)
}

// `words` phải khớp số dòng thật trong file dữ liệu — thanh tiến độ và mọi chỗ hiện "x/y" đều
// đọc từ đây. Trước đây là "số từ dự kiến" của kế hoạch (B1 2.000 trong khi data có 2.276) nên
// tiến độ đầy 100% lúc còn 276 từ chưa học. scripts/test-logic.mjs khoá lại con số này để
// pipeline thêm/bớt từ mà quên cập nhật là test đỏ ngay.
export const LEVELS: LevelMeta[] = [
  { level: -1, label: "A1 · Khởi đầu", cefr: "A1", words: 1053 },
  { level: 0, label: "A2 · Sơ cấp", cefr: "A2", words: 1236 },
  { level: 1, label: "B1 · Trung cấp", cefr: "B1", words: 2276 },
  { level: 2, label: "B2 · Trung cao", cefr: "B2", words: 2582 },
  { level: 3, label: "C1 · Cao cấp", cefr: "C1", words: 3038 },
  { level: 4, label: "C2 · Thành thạo", cefr: "C2", words: 2412 },
];

// ---- Cấp BẮT ĐẦU (Cài đặt → "Bắt đầu từ cấp"): các cấp thấp hơn được BỎ QUA ----
// Cấp bỏ qua vẫn duyệt/tra cứu được (như "bộ nền" trước đây) nhưng không nằm trong lộ trình:
// không có nút học cả cấp, không tính vào huy hiệu "mọi cấp", từ của nó coi như đã biết khi
// chọn câu ví dụ vừa sức.
/** Người mới: học từ A1. */
export const FIRST_LEVEL = -1;
/** Người đã học từ trước khi có A1/A2 (có thẻ B1–C2) mà chưa tự chọn: bắt đầu B1 — y như cũ. */
export const LEGACY_START_LEVEL = 1;

// Ngày app có A1/A2. Thẻ B1–C2 tạo TRƯỚC ngày này là dấu hiệu người học cũ (app khi đó coi như
// đã có nền A1–A2). Suy theo NGÀY chứ không theo "có thẻ B1+": người mới học hết A1–A2 rồi sang
// B1 vẫn phải giữ nguyên lộ trình từ A1, không được đột ngột thành "bỏ qua A1–A2".
export const A1_LAUNCH_DAY = "2026-10-12";
export function isLegacyRecord(r: { level: number; introducedOn?: string }): boolean {
  return r.level >= 1 && (r.introducedOn ?? "") < A1_LAUNCH_DAY;
}

/** Giá trị cấp bắt đầu hợp lệ (-1..4), lạ/thiếu → undefined (để suy theo dữ liệu). */
export function validStartLevel(v: unknown): number | undefined {
  return typeof v === "number" && LEVELS.some((l) => l.level === v) ? v : undefined;
}

/** Cấp bắt đầu đang áp dụng: lựa chọn trong Cài đặt, chưa chọn thì người học cũ → B1, còn lại → A1. */
export function resolveStartLevel(chosen: unknown, hasLegacy: boolean): number {
  return validStartLevel(chosen) ?? (hasLegacy ? LEGACY_START_LEVEL : FIRST_LEVEL);
}

/** Các cấp trong lộ trình (từ cấp bắt đầu trở lên), theo thứ tự dễ → khó. */
export function routeLevels(start: number): LevelMeta[] {
  return LEVELS.filter((l) => l.level >= start);
}

export function levelMeta(level: number): LevelMeta | undefined {
  return LEVELS.find((l) => l.level === level);
}

// Tên file dữ liệu theo cấp: 1 → "b1", … 4 → "c2"; A1/A2 (-1, 0) → "foundation" (file chung).
export function levelSlug(level: number): string {
  if (level <= 0) return "foundation";
  return levelMeta(level)?.cefr.toLowerCase() ?? "b1";
}

// Màu nhấn theo cấp (class Tailwind literal để không bị purge).
export interface LevelAccent {
  text: string;
  bar: string;
  grad: string;
  badge: string;
}

const ACCENTS: Record<number, LevelAccent> = {
  [-1]: { text: "text-violet-600 dark:text-violet-400", bar: "bg-violet-500", grad: "from-violet-500/15 to-transparent", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  0: { text: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500", grad: "from-teal-500/15 to-transparent", badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  1: { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", grad: "from-emerald-500/15 to-transparent", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  2: { text: "text-sky-600 dark:text-sky-400", bar: "bg-sky-500", grad: "from-sky-500/15 to-transparent", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  3: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", grad: "from-amber-500/15 to-transparent", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  4: { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", grad: "from-rose-500/15 to-transparent", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

export function levelAccent(level: number): LevelAccent {
  return ACCENTS[level] ?? ACCENTS[1];
}

// ---- Cấp HỌC LIỆU (Reading · Story · Video) ----
// Học liệu dùng đủ 6 cấp CEFR, khớp 1–1 với cấp từ vựng: A1..C2 = level -1..4 của app.
// Khoá `key` nằm trong URL (/bai-doc/b1/…) và id bài (rd-b1-…) nên KHÔNG được đổi.
export interface ContentLevel {
  key: string; // a1..c2
  cefr: string; // A1..C2
  label: string; // nhãn UI
  band: number; // 0..5 (thứ tự độ khó)
  vocabLevel: number; // level từ vựng của app (-1..4)
}

export const CONTENT_LEVELS: ContentLevel[] = [
  { key: "a1", cefr: "A1", label: "A1 · Khởi đầu", band: 0, vocabLevel: -1 },
  { key: "a2", cefr: "A2", label: "A2 · Sơ cấp", band: 1, vocabLevel: 0 },
  { key: "b1", cefr: "B1", label: "B1 · Trung cấp", band: 2, vocabLevel: 1 },
  { key: "b2", cefr: "B2", label: "B2 · Trung cao", band: 3, vocabLevel: 2 },
  { key: "c1", cefr: "C1", label: "C1 · Cao cấp", band: 4, vocabLevel: 3 },
  { key: "c2", cefr: "C2", label: "C2 · Thành thạo", band: 5, vocabLevel: 4 },
];

export function contentLevel(key: string): ContentLevel | undefined {
  return CONTENT_LEVELS.find((l) => l.key === key);
}

/** Màu nhấn theo cấp học liệu = màu cấp từ vựng tương ứng. */
export function contentAccent(key: string): LevelAccent {
  const l = contentLevel(key);
  return levelAccent(l ? l.vocabLevel : 1);
}
