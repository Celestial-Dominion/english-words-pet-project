import Link from "next/link";
import { LibraryLevelGrid } from "@/components/library/library-lists";
import { readingsIndex } from "@/lib/library-server";

export const metadata = { title: "Bài đọc · Từ vựng tiếng Anh" };

export default function BaiDocIndex() {
  const items = readingsIndex();
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Bài đọc</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} bài theo sáu cấp A1 → C2, càng lên cao càng học thuật. Chọn cấp, lọc theo chủ đề; trong bài chạm một từ để tra
            nghĩa, nghe cả bài theo từng câu.
          </p>
        </div>
        <Link href="/doc" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Thư viện
        </Link>
      </div>
      <LibraryLevelGrid items={items} base="/bai-doc" noun="bài đọc" />
    </div>
  );
}
