import { VideoPlayer } from "@/components/video/video-player";
import { videosIndex } from "@/lib/library-server";

// Sinh tĩnh mọi bài trong chỉ mục; nội dung bài (JSON) + audio tải phía client khi mở.
export function generateStaticParams() {
  return videosIndex().map((v) => ({ level: v.level, id: v.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  const v = videosIndex().find((x) => x.id === id);
  return { title: v ? `${v.title.en} · Video` : "Video" };
}

export default async function VideoLessonPage({ params }: { params: Promise<{ level: string; id: string }> }) {
  const { id } = await params;
  const all = videosIndex();
  const i = all.findIndex((v) => v.id === id);
  const next = i >= 0 && all[i + 1]?.level === all[i].level ? all[i + 1] : undefined;
  return <VideoPlayer id={id} next={next ? { id: next.id, level: next.level, title: next.title } : undefined} />;
}
