"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Flame, GraduationCap, Library, Plus, Volume2 } from "lucide-react";
import { countDue, getConfig, newTodayCount, progressSummary } from "@/lib/db";
import { onSyncMerged } from "@/lib/sync";

// Hero trang chủ (bố cục bento giống HSK): hộp "Hôm nay" + 2 nút Ôn tập / Học từ mới,
// cạnh đó là cột 2 thẻ thống kê nhanh (chuỗi ngày, từ đã học) bấm sang trang Tiến độ.
export default function HomeStats() {
  const [due, setDue] = useState<number | null>(null);
  const [words, setWords] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [newRemain, setNewRemain] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [d, sum, cfg, nToday] = await Promise.all([
        countDue(),
        progressSummary(),
        getConfig(),
        newTodayCount(),
      ]);
      setDue(d);
      setWords(sum.words);
      setStreak(sum.streak);
      setNewRemain(Math.max(0, cfg.newPerDay - nToday));
    };
    void load();
    // kéo tiến độ máy khác về → số đến hạn/chuỗi ngày phải nhảy theo ngay
    return onSyncMerged(() => void load());
  }, []);

  const d = due ?? -1;
  const fmt = (v: number | null) => (v === null || v < 0 ? "…" : v.toLocaleString("vi"));

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      {/* Hôm nay: ôn tập + học từ mới */}
      <div className="flex flex-col justify-center gap-5 rounded-3xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 sm:p-8 lg:col-span-2">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm sm:size-16">
            <GraduationCap className="size-7 sm:size-8" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-muted-foreground">Hôm nay</div>
            <div className="text-2xl leading-tight font-bold sm:text-3xl lg:text-4xl">
              {d < 0 ? (
                "…"
              ) : d > 0 ? (
                <>
                  Cần ôn <span className="text-primary">{d}</span> thẻ
                </>
              ) : (words ?? 0) === 0 ? (
                "Bắt đầu học nhé 👋"
              ) : (
                "Đã ôn xong 🎉"
              )}
            </div>
            {newRemain > 0 && <div className="mt-1 text-sm text-muted-foreground">+ {newRemain} từ mới có thể học</div>}
          </div>
        </div>
        {/* Nút chính đổi theo trạng thái: còn thẻ đến hạn → Ôn tập nổi bật; hết → Học từ mới nổi bật. */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/on-tap"
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
              d > 0 ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "border bg-background hover:bg-muted"
            }`}
          >
            <GraduationCap className="size-4" /> Ôn tập{d > 0 ? ` (${d})` : ""}
          </Link>
          <Link
            href="/hoc"
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
              d > 0 ? "border bg-background hover:bg-muted" : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            }`}
          >
            <Plus className="size-4" /> Học từ mới{newRemain > 0 ? ` (${newRemain})` : ""}
          </Link>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="flex gap-3 lg:flex-col lg:gap-4">
        <StatTile
          href="/tien-do"
          icon={<Flame className="size-5" />}
          tint="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          label="Chuỗi ngày"
          value={fmt(streak)}
        />
        <StatTile
          href="/tien-do"
          icon={<Library className="size-5" />}
          tint="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          label="Từ đã học"
          value={fmt(words)}
        />
      </div>
    </div>
  );
}

function StatTile({
  href,
  icon,
  tint,
  label,
  value,
}: {
  href: string;
  icon: ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-1 items-center gap-3 rounded-2xl border p-4 transition-all hover:shadow-md active:scale-[0.99]"
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Link>
  );
}
