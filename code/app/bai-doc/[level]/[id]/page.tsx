import { ReadingReader } from "@/components/library/reading-reader";
import { readingsIndex } from "@/lib/library-server";

// Sinh tĩnh mọi bài trong chỉ mục; nội dung bài (JSON) + audio tải phía client khi mở.
export function generateStaticParams() {
  return readingsIndex().map((r) => ({ level: r.level, id: r.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  const r = readingsIndex().find((x) => x.id === id);
  return { title: r ? `${r.title_en} · Bài đọc` : "Bài đọc" };
}

export default async function ReadingPage({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  return <ReadingReader id={id} />;
}
