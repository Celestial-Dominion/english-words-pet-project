import { StoryReader } from "@/components/library/story-reader";
import { storiesIndex } from "@/lib/library-server";
import { grammarFor } from "@/lib/grammar-server";

export function generateStaticParams() {
  return storiesIndex().map((s) => ({ level: s.level, id: s.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  const s = storiesIndex().find((x) => x.id === id);
  return { title: s ? `${s.title_en} · Truyện` : "Truyện" };
}

export default async function StoryPage({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  return <StoryReader id={id} grammar={grammarFor(id)} />;
}
