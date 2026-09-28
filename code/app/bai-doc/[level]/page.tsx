import { notFound } from "next/navigation";
import { ReadingList } from "@/components/library/library-lists";
import { CONTENT_LEVELS, contentLevel } from "@/lib/levels";
import { readingsIndex } from "@/lib/library-server";

// Sinh tĩnh đủ 6 cấp (cấp chưa có bài hiện danh sách rỗng); cấm param ngoài danh sách (export tĩnh).
export function generateStaticParams() {
  return CONTENT_LEVELS.map((l) => ({ level: l.key }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  return { title: `Bài đọc ${contentLevel(level)?.cefr ?? ""} · Từ vựng tiếng Anh` };
}

export default async function ReadingLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!contentLevel(level)) notFound();
  return <ReadingList level={level} items={readingsIndex().filter((r) => r.level === level)} />;
}
