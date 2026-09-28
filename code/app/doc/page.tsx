import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpenText, ChevronRight, Clapperboard, Library } from "lucide-react";
import { readingsIndex, storiesIndex, videosIndex } from "@/lib/library-server";

export const metadata = { title: "Thư viện · Từ vựng tiếng Anh" };

export default function DocHub() {
  const r = readingsIndex();
  const s = storiesIndex();
  const v = videosIndex();
  const min = Math.round(v.reduce((n, x) => n + x.duration, 0) / 60);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Thư viện</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sáu cấp A1 → C2. Bài đọc để hiểu và gặp từ, truyện để đọc rộng qua nhân vật, video hội thoại để luyện nghe và nói.
          Bấm vào từ bất kỳ để tra nghĩa và thêm vào lịch học.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HubCard
          href="/bai-doc"
          icon={<BookOpenText className="size-7" />}
          tint="bg-sky-500/15 text-sky-600 dark:text-sky-400"
          grad="from-sky-500/15"
          title="Bài đọc"
          desc={`${r.length} bài theo chủ đề — từ đời sống thường ngày tới khoa học, kinh tế, triết học.`}
        />
        <HubCard
          href="/truyen"
          icon={<Library className="size-7" />}
          tint="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          grad="from-violet-500/15"
          title="Truyện"
          desc={`${s.length} truyện nhiều chương, có thoại và bản dịch; mỗi truyện có một video hội thoại.`}
        />
        <HubCard
          href="/video"
          icon={<Clapperboard className="size-7" />}
          tint="bg-rose-500/15 text-rose-600 dark:text-rose-400"
          grad="from-rose-500/15"
          title="Video"
          desc={`${v.length} hội thoại hoạt hình · ${min} phút — nghe hiểu, nói theo, nhập vai.`}
        />
      </div>
    </div>
  );
}

function HubCard({ href, icon, tint, grad, title, desc }: { href: string; icon: ReactNode; tint: string; grad: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-3xl border bg-gradient-to-br ${grad} to-transparent p-6 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex size-14 items-center justify-center rounded-2xl ${tint}`}>{icon}</span>
        <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div>
        <div className="text-xl font-bold">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}
