// Siêu dữ liệu cấp CEFR cho tiếng Anh: 1..4 = B1..C2 (người học đã có nền A1–A2).
// Level 0 = bộ từ nền A1–A2, chỉ để tra cứu — KHÔNG phải một cấp học.

export interface LevelMeta {
  level: number; // 1..4
  label: string; // nhãn UI
  cefr: string; // B1..C2
  words: number; // SỐ TỪ THẬT trong public/data/words/{slug}.json
}

// `words` phải khớp số dòng thật trong file dữ liệu — thanh tiến độ và mọi chỗ hiện "x/y" đều
// đọc từ đây. Trước đây là "số từ dự kiến" của kế hoạch (B1 2.000 trong khi data có 2.276) nên
// tiến độ đầy 100% lúc còn 276 từ chưa học. scripts/test-logic.mjs khoá lại con số này để
// pipeline thêm/bớt từ mà quên cập nhật là test đỏ ngay.
export const LEVELS: LevelMeta[] = [
  { level: 1, label: "B1 · Trung cấp", cefr: "B1", words: 2276 },
  { level: 2, label: "B2 · Trung cao", cefr: "B2", words: 2582 },
  { level: 3, label: "C1 · Cao cấp", cefr: "C1", words: 3038 },
  { level: 4, label: "C2 · Thành thạo", cefr: "C2", words: 2412 },
];

// Bộ nền A1–A2: KHÔNG nằm trong LEVELS (không vào lộ trình học, tiến độ, mục tiêu gamify)
// nhưng vẫn cần nhãn + màu để DUYỆT và TRA CỨU — xem mục 1.4 của plan.
export const FOUNDATION: LevelMeta = { level: 0, label: "Nền tảng · A1–A2", cefr: "A1–A2", words: 2289 };

export function levelMeta(level: number): LevelMeta | undefined {
  if (level === FOUNDATION.level) return FOUNDATION;
  return LEVELS.find((l) => l.level === level);
}

// Tên file dữ liệu theo cấp: 1 → "b1", … 4 → "c2"; 0 → "foundation" (bộ nền).
export function levelSlug(level: number): string {
  if (level === 0) return "foundation";
  return levelMeta(level)?.cefr.toLowerCase() ?? "b1";
}

// Cấp từ id file (b1..c2) → số 1..4.
export function levelFromCefr(cefr: string): number {
  const i = LEVELS.findIndex((l) => l.cefr.toLowerCase() === cefr.toLowerCase());
  return i >= 0 ? i + 1 : 1;
}

// Màu nhấn theo cấp (class Tailwind literal để không bị purge).
export interface LevelAccent {
  text: string;
  bar: string;
  grad: string;
  badge: string;
}

const ACCENTS: Record<number, LevelAccent> = {
  0: { text: "text-slate-600 dark:text-slate-400", bar: "bg-slate-400", grad: "from-slate-500/10 to-transparent", badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  1: { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", grad: "from-emerald-500/15 to-transparent", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  2: { text: "text-sky-600 dark:text-sky-400", bar: "bg-sky-500", grad: "from-sky-500/15 to-transparent", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  3: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", grad: "from-amber-500/15 to-transparent", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  4: { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", grad: "from-rose-500/15 to-transparent", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

export function levelAccent(level: number): LevelAccent {
  return ACCENTS[level] ?? ACCENTS[1];
}
