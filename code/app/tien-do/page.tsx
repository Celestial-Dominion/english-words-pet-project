"use client";

import { useEffect, useState } from "react";
import { Flame, Trophy, CalendarCheck, Activity, type LucideIcon } from "lucide-react";
import { db, progressSummary, todayStr, type ProgressSummary } from "@/lib/db";
import { LEVELS, levelAccent } from "@/lib/levels";
import { cn } from "@/lib/utils";

const MONTHS = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];
const WEEKS = 13;

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function heatColor(n: number): string {
  if (n <= 0) return "bg-muted";
  if (n < 10) return "bg-emerald-500/30";
  if (n < 25) return "bg-emerald-500/55";
  if (n < 50) return "bg-emerald-500/80";
  return "bg-emerald-600";
}

export default function TienDoPage() {
  const [sum, setSum] = useState<ProgressSummary | null>(null);
  const [selDay, setSelDay] = useState<string | null>(null); // chạm ô heatmap → xem chi tiết ngày
  const [forecast, setForecast] = useState<number[] | null>(null); // 7 ngày tới (hôm nay gộp cả quá hạn)

  useEffect(() => {
    progressSummary().then(setSum);
    (async () => {
      const rows = await db.reviews.toArray();
      const today = todayStr();
      const buckets = new Array(7).fill(0);
      const dayStr: string[] = [];
      const base = new Date(today + "T00:00:00");
      for (let i = 0; i < 7; i++) dayStr.push(todayStr(addDays(base, i)));
      for (const r of rows) {
        const due = todayStr(new Date(r.due));
        if (due <= today) buckets[0] += 1; // quá hạn + đến hạn hôm nay
        else {
          const idx = dayStr.indexOf(due);
          if (idx > 0) buckets[idx] += 1;
        }
      }
      setForecast(buckets);
    })();
  }, []);

  if (!sum) return <div className="py-20 text-center text-muted-foreground">Đang tải…</div>;

  const dailyMap = new Map(sum.daily.map((d) => [d.date, d.reviews]));
  const today = todayStr();
  const todayReviews = dailyMap.get(today) ?? 0;
  // kỷ lục lấy từ summary — cùng luật với chuỗi hiện tại (ngày đóng băng tính như có học)
  const record = sum.longestStreak;

  // Lưới heatmap 13 tuần, căn theo thứ (Th2 hàng đầu).
  const todayDate = new Date(today + "T00:00:00");
  const dowMon = (todayDate.getDay() + 6) % 7; // Th2=0 … CN=6
  const gridEnd = addDays(todayDate, 6 - dowMon);
  const gridStart = addDays(gridEnd, -(WEEKS * 7 - 1));
  const cols: { date: Date; str: string; future: boolean }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: Date; str: string; future: boolean }[] = [];
    for (let r = 0; r < 7; r++) {
      const d = addDays(gridStart, w * 7 + r);
      col.push({ date: d, str: todayStr(d), future: d.getTime() > todayDate.getTime() });
    }
    cols.push(col);
  }
  const maxForecast = Math.max(1, ...(forecast ?? [1]));

  return (
    <div className="space-y-5 lg:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tiến độ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chuỗi ngày học, lịch sử ôn tập và dự báo lịch ôn.</p>
      </div>

      {/* 4 chỉ số */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric accent icon={Flame} tint="bg-amber-500/15 text-amber-600 dark:text-amber-400" label="Chuỗi hiện tại" value={`${sum.streak}`} suffix="ngày" />
        <Metric icon={Trophy} tint="bg-violet-500/15 text-violet-600 dark:text-violet-400" label="Kỷ lục" value={`${record}`} suffix="ngày" />
        <Metric icon={CalendarCheck} tint="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" label="Ôn hôm nay" value={`${todayReviews}`} suffix="lượt" />
        <Metric icon={Activity} tint="bg-sky-500/15 text-sky-600 dark:text-sky-400" label="Tổng lượt ôn" value={sum.reviews.toLocaleString("vi")} suffix="lượt" />
      </div>

      {/* Nhắc giữ chuỗi */}
      <div
        className={cn(
          "rounded-2xl border p-4 text-sm font-medium",
          todayReviews > 0
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span>
            {todayReviews > 0
              ? `🔥 Đã học hôm nay — giữ chuỗi ${sum.streak} ngày!`
              : "⏰ Chưa học hôm nay. Ôn vài thẻ để giữ chuỗi nhé!"}
          </span>
          <span
            className="shrink-0 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300"
            title="Đóng băng chuỗi: lỡ 1 ngày sẽ tự dùng 1 🧊 để giữ chuỗi. Tặng 1 🧊 mỗi mốc chuỗi 7 ngày (giữ tối đa 3)."
          >
            🧊 ×{sum.freezes}
          </span>
        </div>
      </div>

      <div className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
        {/* Heatmap 13 tuần */}
        <section className="min-w-0 overflow-hidden rounded-3xl border p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">13 tuần gần đây</h2>
          <div className="flex gap-1.5">
            {cols.map((col, ci) => {
              const firstOfMonth = col.find((c) => c.date.getDate() <= 7);
              return (
                <div key={ci} className="flex flex-1 flex-col gap-1.5">
                  <div className="h-3 text-[10px] leading-3 text-muted-foreground">
                    {firstOfMonth ? MONTHS[firstOfMonth.date.getMonth()] : ""}
                  </div>
                  {col.map((c) => (
                    <button
                      key={c.str}
                      disabled={c.future}
                      onClick={() => setSelDay((d) => (d === c.str ? null : c.str))}
                      aria-label={c.future ? undefined : `${c.str}: ${dailyMap.get(c.str) ?? 0} lượt`}
                      className={cn(
                        "aspect-square w-full rounded-[3px] transition-shadow",
                        c.future ? "bg-transparent" : heatColor(dailyMap.get(c.str) ?? 0),
                        selDay === c.str && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {/* chú giải Ít → Nhiều + chi tiết ngày đã chọn (như HSK) */}
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            Ít
            {["bg-muted", "bg-emerald-500/30", "bg-emerald-500/55", "bg-emerald-500/80", "bg-emerald-600"].map((c) => (
              <span key={c} className={cn("size-3 rounded-[3px]", c)} />
            ))}
            Nhiều
          </div>
          {selDay && (() => {
            const d = sum.daily.find((x) => x.date === selDay);
            return (
              <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs">
                <b>{selDay}</b> · {d?.reviews ?? 0} lượt ôn · {d?.newCount ?? 0} từ mới · {d?.again ?? 0} lần “Lại”
              </p>
            );
          })()}
          <p className="mt-3 text-xs text-muted-foreground">
            Tổng {sum.reviews.toLocaleString("vi")} lượt ôn · {sum.reads} bài đã đọc · {sum.matured} từ nhớ bền
          </p>
        </section>

        {/* Dự báo 7 ngày */}
        <section className="min-w-0 rounded-3xl border p-5">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Lịch ôn 7 ngày tới</h2>
          {forecast ? (
            <div className="space-y-2">
              {forecast.map((n, i) => {
                const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
                const label = i === 0 ? "Nay" : DOW[addDays(new Date(today + "T00:00:00"), i).getDay()];
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-9 shrink-0 text-muted-foreground">{label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-muted">
                      <div
                        className={cn("h-full rounded-md", i === 0 ? "bg-primary" : "bg-primary/70")}
                        style={{ width: `${(n / maxForecast) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums font-medium">{n}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tính…</p>
          )}
        </section>
      </div>

      {/* Từ đã học theo cấp */}
      <section className="rounded-3xl border p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Tiến độ theo cấp · {sum.words.toLocaleString("vi")} thẻ đã học
        </h2>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {LEVELS.map((lv) => {
            const done = sum.byLevel[lv.level] || 0;
            const a = levelAccent(lv.level);
            const pct = Math.min(100, Math.round((done / lv.words) * 100));
            return (
              <div key={lv.level}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className={cn("font-semibold", a.text)}>{lv.label}</span>
                  <span className="text-muted-foreground">
                    {done.toLocaleString("vi")} / {lv.words.toLocaleString("vi")}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", a.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  tint,
  label,
  value,
  suffix,
  accent,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-4", accent && "bg-gradient-to-br from-amber-500/10 to-transparent")}>
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tint)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">
          {value}
          {suffix && <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
