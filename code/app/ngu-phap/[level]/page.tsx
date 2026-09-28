import Link from "next/link";
import { notFound } from "next/navigation";
import { GrammarLessonList } from "@/components/grammar/lesson-list";
import { grammarIndex } from "@/lib/grammar-server";
import { CONTENT_LEVELS, contentAccent, contentLevel } from "@/lib/levels";

// Sinh tĩnh đủ 6 cấp (cấp chưa có bài hiện "đang biên soạn"); cấm param ngoài danh sách (export tĩnh).
export function generateStaticParams() {
  return CONTENT_LEVELS.map((l) => ({ level: l.key }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  return { title: `Ngữ pháp ${contentLevel(level)?.cefr ?? ""} · Từ vựng tiếng Anh` };
}

export default async function GrammarLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const meta = contentLevel(level);
  if (!meta) notFound();
  const { cats, lessons } = grammarIndex();
  const items = lessons.filter((l) => l.lv === level);
  const a = contentAccent(level);
  const min = Math.round(items.reduce((s, l) => s + l.dur, 0) / 60);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold ${a.badge}`}>{meta.cefr}</span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Ngữ pháp {meta.label}</h1>
            <p className="text-sm text-muted-foreground tabular-nums">{items.length ? `${items.length} bài · ${min} phút · học theo thứ tự từ trên xuống` : "Đang biên soạn"}</p>
          </div>
        </div>
        <Link href="/ngu-phap" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Ngữ pháp
        </Link>
      </div>
      <GrammarLessonList items={items} cats={cats} />
    </div>
  );
}
