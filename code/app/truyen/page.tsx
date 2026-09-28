import Link from "next/link";
import { LibraryLevelGrid } from "@/components/library/library-lists";
import { storiesIndex } from "@/lib/library-server";

export const metadata = { title: "Truyện · Từ vựng tiếng Anh" };

export default function TruyenIndex() {
  const items = storiesIndex();
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Truyện</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} truyện nhiều chương — đọc rộng, gặp lại từ qua nhân vật và sự kiện. Đọc tới chương cuối là tính đã đọc; mỗi
            truyện có một video hội thoại để luyện nghe và nói.
          </p>
        </div>
        <Link href="/doc" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Thư viện
        </Link>
      </div>
      <LibraryLevelGrid items={items} base="/truyen" noun="truyện" />
    </div>
  );
}
