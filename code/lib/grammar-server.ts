// Đọc chỉ mục Ngữ pháp LÚC BUILD (chỉ dùng trong server component: generateStaticParams, trang tĩnh, liên kết từ
// Bài đọc / Truyện / Video sang Ngữ pháp) — client không tải chỉ mục này.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GrammarIndex, GrammarMeta, LessonRef } from "./grammar";

// Build tĩnh đọc một lần; dev server đọc lại mỗi lần (chỉ mục đổi sau mỗi lần build ngữ pháp — cache cũ sẽ trỏ ?v= cũ).
let cache: GrammarIndex | null = null;
export function grammarIndex(): GrammarIndex {
  if (cache) return cache;
  const p = join(process.cwd(), "public", "data", "grammar", "index.json");
  const g = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as GrammarIndex) : { cats: {}, lessons: [], content: {} };
  if (process.env.NODE_ENV === "production") cache = g;
  return g;
}

export const toRef = (m: Pick<GrammarMeta, "id" | "lv" | "t" | "en">): LessonRef => ({ id: m.id, lv: m.lv, t: m.t, en: m.en });

/** Bài ngữ pháp nổi bật trong một bài đọc / truyện / video (≤3). */
export function grammarFor(contentId: string): LessonRef[] {
  const g = grammarIndex();
  const ids = g.content[contentId] ?? [];
  return ids.map((id) => g.lessons.find((l) => l.id === id)).filter((m): m is GrammarMeta => !!m).map(toRef);
}
