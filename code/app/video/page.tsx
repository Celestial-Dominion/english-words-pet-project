import Link from "next/link";
import { VideoLevelGrid } from "@/components/video/video-level-grid";
import { videosIndex } from "@/lib/library-server";

export const metadata = { title: "Video · Từ vựng tiếng Anh" };

export default function VideoPage() {
  const items = videosIndex();
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Video</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} hội thoại hoạt hình để luyện nghe hiểu và nói. Transcript chạy theo tiếng; bấm câu để nghe lại, ẩn chữ để luyện
            nghe, bật Nói theo hoặc Nhập vai để luyện nói.
          </p>
        </div>
        <Link href="/doc" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Thư viện
        </Link>
      </div>
      <VideoLevelGrid items={items} />
    </div>
  );
}
