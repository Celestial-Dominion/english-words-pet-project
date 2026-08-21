"use client";

import { useEffect, useState } from "react";
import { Sparkles, Library, Flame, CalendarDays, Repeat, Brain, type LucideIcon } from "lucide-react";
import { progressSummary, type ProgressSummary } from "@/lib/db";
import { RANKS, rankForWords, badgeGroups, badgeTotals, type Stats, type Badge, type Rank } from "@/lib/gamify";
import { cn } from "@/lib/utils";

type Detail = { kind: "rank"; rank: Rank; index: number } | { kind: "badge"; badge: Badge };

export default function BinhNghiepPage() {
  const [sum, setSum] = useState<ProgressSummary | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null); // dialog chi tiết cấp bậc/huy hiệu
  useEffect(() => {
    progressSummary().then(setSum);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!sum) {
    return <div className="text-center text-muted-foreground">Đang tải…</div>;
  }

  const rp = rankForWords(sum.words);
  const stats: Stats = {
    words: sum.words, xp: sum.xp, streak: sum.streak, reads: sum.reads, reviews: sum.reviews,
    correct: sum.correct, activeDays: sum.activeDays, matured: sum.matured, maxDayReviews: sum.maxDayReviews,
    weekend: sum.weekend, byLevel: sum.byLevel,
    redeemedLeeches: sum.redeemedLeeches, maxCombo: sum.maxCombo, longestStreak: sum.longestStreak,
    comebackDays: sum.comebackDays, perfectDay: sum.perfectDay,
  };
  const groups = badgeGroups(stats);
  const totals = badgeTotals(stats);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hải trình</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cấp bậc, thống kê học tập và huy hiệu — thăng tiến theo số từ đã học.</p>
      </div>

      {/* thẻ cấp bậc hiện tại */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-transparent p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Cấp bậc hiện tại</div>
        <div className="mt-1 text-xl font-bold">{rp.rank.en}</div>
        <div className="text-sm text-muted-foreground">{rp.rank.vi}</div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{sum.words.toLocaleString("vi")} từ đã học</span>
          <span>{sum.xp.toLocaleString("vi")} XP</span>
        </div>
        {rp.next ? (
          <>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(rp.progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Còn {rp.toNext.toLocaleString("vi")} từ → <b>{rp.next.en}</b> ({rp.next.vi})
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">Cấp cao nhất — Chúa tể Thất Hải 👑</div>
        )}
      </div>

      {/* lưới thống kê */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Sparkles} tint="bg-amber-500/15 text-amber-600 dark:text-amber-400" label="Tổng điểm (XP)" value={sum.xp.toLocaleString("vi")} />
        <StatCard icon={Library} tint="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" label="Từ đã học" value={sum.words.toLocaleString("vi")} />
        <StatCard icon={Flame} tint="bg-orange-500/15 text-orange-600 dark:text-orange-400" label="Chuỗi ngày" value={`${sum.streak}`} />
        <StatCard icon={CalendarDays} tint="bg-sky-500/15 text-sky-600 dark:text-sky-400" label="Số ngày học" value={`${sum.activeDays}`} />
        <StatCard icon={Repeat} tint="bg-violet-500/15 text-violet-600 dark:text-violet-400" label="Tổng lượt ôn" value={sum.reviews.toLocaleString("vi")} />
        <StatCard icon={Brain} tint="bg-rose-500/15 text-rose-600 dark:text-rose-400" label="Từ nhớ bền" value={sum.matured.toLocaleString("vi")} />
      </div>

      {/* thang cấp bậc */}
      <h2 className="mb-2 mt-6 text-lg font-semibold">
        Thang cấp bậc <span className="text-xs font-normal text-muted-foreground">· chạm để xem mô tả</span>
      </h2>
      <ol className="space-y-1.5">
        {RANKS.map((r, i) => {
          const reached = sum.words >= r.minWords;
          const current = i === rp.index;
          return (
            <li key={r.en}>
              <button
                onClick={() => setDetail({ kind: "rank", rank: r, index: i })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/60",
                  current ? "border-primary bg-primary/10" : reached ? "border" : "border opacity-50",
                )}
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", reached ? "bg-primary/20 text-primary" : "bg-muted")}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.en}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.vi}</span>
                </span>
                {current && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Hiện tại</span>}
                <span className="shrink-0 text-xs text-muted-foreground">{r.minWords.toLocaleString("vi")}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* huy hiệu — theo nhóm nhiều bậc */}
      <h2 className="mb-1 mt-6 text-lg font-semibold">
        Huy hiệu <span className="text-sm font-normal text-muted-foreground">({totals.earned}/{totals.total}) · chạm để xem mô tả</span>
      </h2>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.group} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{g.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-xs text-muted-foreground">{g.earned}/{g.total}</span>
                </div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </div>
            </div>
            <p className="mt-2 text-xs italic text-muted-foreground">{g.lore}</p>

            {g.next && (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.round((g.next.value / g.next.threshold) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {g.next.value.toLocaleString("vi")} / {g.next.threshold.toLocaleString("vi")} {g.next.unit} → huy hiệu kế
                </div>
              </div>
            )}

            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {g.badges.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setDetail({ kind: "badge", badge: b })}
                  className={cn(
                    "flex flex-col items-center rounded-xl border p-2 text-center transition-transform active:scale-95",
                    b.earned ? "border-amber-500/30 bg-amber-500/10" : "border opacity-40",
                  )}
                >
                  <span className={cn("text-xl", !b.earned && "grayscale")}>{b.icon}</span>
                  <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{b.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {detail && <DetailDialog detail={detail} words={sum.words} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Dialog chi tiết cấp bậc/huy hiệu — bottom sheet mobile, modal giữa desktop (như HSK). */
function DetailDialog({ detail, words, onClose }: { detail: Detail; words: number; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full rounded-t-3xl border bg-background p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:max-w-sm sm:rounded-3xl sm:pb-6 sm:zoom-in-95"
      >
        {detail.kind === "rank" ? (
          <RankDetail rank={detail.rank} index={detail.index} words={words} />
        ) : (
          <BadgeDetail b={detail.badge} />
        )}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}

function RankDetail({ rank, index, words }: { rank: Rank; index: number; words: number }) {
  const reached = words >= rank.minWords;
  const pct = rank.minWords > 0 ? Math.min(100, Math.round((words / rank.minWords) * 100)) : 100;
  return (
    <div className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-xl font-bold text-primary">{index + 1}</div>
      <div className="mt-3 text-xl font-bold">{rank.en}</div>
      <div className="text-sm text-muted-foreground">{rank.vi}</div>
      <div className="mt-3 text-sm">
        Ngưỡng: <b>{rank.minWords.toLocaleString("vi")}</b> từ đã học
      </div>
      {!reached && (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {words.toLocaleString("vi")} / {rank.minWords.toLocaleString("vi")} từ — còn {(rank.minWords - words).toLocaleString("vi")} từ nữa
          </div>
        </>
      )}
      {reached && <div className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ Đã đạt</div>}
    </div>
  );
}

function BadgeDetail({ b }: { b: Badge }) {
  const pct = b.threshold > 0 ? Math.min(100, Math.round((b.value / b.threshold) * 100)) : 100;
  return (
    <div className="text-center">
      <div className={cn("mx-auto grid size-14 place-items-center rounded-full text-3xl", b.earned ? "bg-amber-500/15" : "bg-muted grayscale")}>
        {b.icon}
      </div>
      <div className="mt-3 text-xl font-bold">{b.name}</div>
      <div className="text-sm text-muted-foreground">{b.groupName}</div>
      <div className="mt-3 text-sm">{b.hint}</div>
      {!b.earned ? (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {b.value.toLocaleString("vi")} / {b.threshold.toLocaleString("vi")}
          </div>
        </>
      ) : (
        <div className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ Đã mở khóa</div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, tint, label, value }: { icon: LucideIcon; tint: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-4">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tint)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}
