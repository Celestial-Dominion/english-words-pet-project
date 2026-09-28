import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoList } from "@/components/video/video-list";
import { CONTENT_LEVELS, contentAccent, contentLevel } from "@/lib/levels";
import { videosIndex } from "@/lib/library-server";

export function generateStaticParams() {
  return CONTENT_LEVELS.map((l) => ({ level: l.key }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  return { title: `Video ${contentLevel(level)?.cefr ?? ""} · Từ vựng tiếng Anh` };
}

export default async function VideoLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const meta = contentLevel(level);
  if (!meta) notFound();
  const items = videosIndex().filter((v) => v.level === level);
  const a = contentAccent(level);
  const min = Math.round(items.reduce((s, v) => s + v.duration, 0) / 60);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold ${a.badge}`}>{meta.cefr}</span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Video {meta.label}</h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {items.length} bài · {min} phút
            </p>
          </div>
        </div>
        <Link href="/video" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Cấp khác
        </Link>
      </div>
      <VideoList items={items} />
    </div>
  );
}
