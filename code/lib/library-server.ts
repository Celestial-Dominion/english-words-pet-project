// Đọc chỉ mục thư viện LÚC BUILD (chỉ dùng trong server component: generateStaticParams, số liệu
// trên trang tĩnh) — chữ mô tả không bị cũ mỗi khi thêm nội dung.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReadingMeta, StoryMeta } from "./library";
import type { VideoMeta } from "./video";

function read<T>(name: string): T[] {
  const p = join(process.cwd(), "public", "data", "library", name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T[]) : [];
}

export const readingsIndex = () => read<ReadingMeta>("readings-index.json");
export const storiesIndex = () => read<StoryMeta>("stories-index.json");
export const videosIndex = () => read<VideoMeta>("videos-index.json");
