import Link from "next/link";
import { notFound } from "next/navigation";
import { GrammarLessonList } from "@/components/grammar/lesson-list";
import { grammarIndex } from "@/lib/grammar-server";

export function generateStaticParams() {
  return [...new Set(grammarIndex().lessons.map((l) => l.cat))].map((cat) => ({ cat }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  return { title: `${grammarIndex().cats[cat] ?? "Ngữ pháp"} · Ngữ pháp` };
}

export default async function GrammarCategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const { cats, lessons } = grammarIndex();
  const items = lessons.filter((l) => l.cat === cat);
  if (!cats[cat] || !items.length) notFound();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{cats[cat]}</h1>
          <p className="text-sm text-muted-foreground tabular-nums">{items.length} bài, xếp theo cấp A1 → C2</p>
        </div>
        <Link href="/ngu-phap" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Ngữ pháp
        </Link>
      </div>
      <GrammarLessonList items={items} cats={cats} showLevel />
    </div>
  );
}
