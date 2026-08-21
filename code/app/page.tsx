import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpenText, ChevronRight } from "lucide-react";
import HomeStats from "@/components/home-stats";
import LevelGrid from "@/components/level-grid";
import DailyQuests from "@/components/daily-quests";

export default function Home() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <HomeStats />

      <DailyQuests />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chọn cấp độ học</h2>
        <LevelGrid />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Khám phá</h2>
        <div className="grid gap-4">
          <ExploreCard
            href="/bai-doc"
            icon={<BookOpenText className="size-6" />}
            tint="bg-sky-500/15 text-sky-600 dark:text-sky-400"
            grad="from-sky-500/15"
            title="Bài đọc"
            desc="Bài đọc phân cấp B1–C2, bấm từ bất kỳ để tra nghĩa."
          />
        </div>
      </section>
    </div>
  );
}

function ExploreCard({
  href,
  icon,
  tint,
  grad,
  title,
  desc,
}: {
  href: string;
  icon: ReactNode;
  tint: string;
  grad: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-3xl border bg-gradient-to-br ${grad} to-transparent p-5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}
    >
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tint}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
