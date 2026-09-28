import { notFound } from "next/navigation";
import { StoryList } from "@/components/library/library-lists";
import { CONTENT_LEVELS, contentLevel } from "@/lib/levels";
import { storiesIndex } from "@/lib/library-server";

export function generateStaticParams() {
  return CONTENT_LEVELS.map((l) => ({ level: l.key }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  return { title: `Truyện ${contentLevel(level)?.cefr ?? ""} · Từ vựng tiếng Anh` };
}

export default async function StoryLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!contentLevel(level)) notFound();
  return <StoryList level={level} items={storiesIndex().filter((s) => s.level === level)} />;
}
