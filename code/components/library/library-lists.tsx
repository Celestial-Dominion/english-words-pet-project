"use client";

// Lưới cấp + danh sách theo cấp cho Bài đọc và Truyện. Chỉ mục truyền từ server component (đọc lúc
// build) — trang không phải fetch; trạng thái đã đọc đọc từ IndexedDB sau mount.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clapperboard } from "lucide-react";
import { CONTENT_LEVELS, contentAccent, contentLevel } from "@/lib/levels";
import { readIds } from "@/lib/db";
import { GENRES, TOPICS, fmtMinutes, type ReadingMeta, type StoryMeta } from "@/lib/library";
import { cn } from "@/lib/utils";

function useRead(): Set<string> {
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    void readIds().then(setRead);
  }, []);
  return read;
}

const nf = new Intl.NumberFormat("vi-VN");

export function LibraryLevelGrid({ items, base, noun }: { items: { id: string; level: string }[]; base: string; noun: string }) {
  const read = useRead();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTENT_LEVELS.map((l) => {
        const list = items.filter((x) => x.level === l.key);
        const a = contentAccent(l.key);
        const done = list.filter((x) => read.has(x.id)).length;
        const pct = list.length ? (done / list.length) * 100 : 0;
        const body = (
          <>
            <div className="flex items-center gap-3">
              <span className={`flex size-11 items-center justify-center rounded-xl text-base font-bold ${a.badge}`}>{l.cefr}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{l.label.split(" · ")[1]}</span>
                <span className="block text-sm text-muted-foreground">
                  {list.length ? `${nf.format(list.length)} ${noun}` : "Đang biên soạn"}
                </span>
              </span>
              {list.length > 0 && done === list.length ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.badge}`}>✓ Xong</span>
              ) : (
                <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all duration-500 ${a.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {done}/{list.length}
              </span>
            </div>
          </>
        );
        const cls = `group overflow-hidden rounded-2xl border bg-gradient-to-br ${a.grad} p-5 text-left transition-all`;
        return list.length ? (
          <Link key={l.key} href={`${base}/${l.key}`} className={`${cls} hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}>
            {body}
          </Link>
        ) : (
          <div key={l.key} className={`${cls} opacity-45`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

const PAGE = 60;

export function ReadingList({ level, items }: { level: string; items: ReadingMeta[] }) {
  const read = useRead();
  const [topic, setTopic] = useState<string>("");
  const [count, setCount] = useState(PAGE);
  const topics = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of items) m.set(r.topic, (m.get(r.topic) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const shown = topic ? items.filter((r) => r.topic === topic) : items;
  const done = shown.filter((r) => read.has(r.id)).length;
  const nextUnread = shown.find((r) => !read.has(r.id));
  const lv = contentLevel(level);
  const a = contentAccent(level);
  return (
    <div className="space-y-5">
      <LevelHeader cefr={lv?.cefr ?? level} label={lv?.label ?? level} done={done} total={shown.length} back="/bai-doc" noun="bài" accent={a} />
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip on={!topic} onClick={() => (setTopic(""), setCount(PAGE))}>
          Tất cả · {items.length}
        </Chip>
        {topics.map(([t, n]) => (
          <Chip key={t} on={topic === t} onClick={() => (setTopic(t), setCount(PAGE))}>
            {TOPICS[t] ?? t} · {n}
          </Chip>
        ))}
      </div>
      {nextUnread && <NextCard href={`/bai-doc/${level}/${nextUnread.id}`} started={done > 0} title={nextUnread.title_en} sub={nextUnread.title_vi} />}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.slice(0, count).map((r) => {
          const isRead = read.has(r.id);
          return (
            <Link
              key={r.id}
              href={`/bai-doc/${level}/${r.id}`}
              className="group flex min-h-[4.5rem] items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md active:scale-[0.99]"
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", isRead ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>
                {isRead ? <Check className="size-4" strokeWidth={3} /> : r.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.title_en}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.title_vi}</span>
                <span className="block truncate text-[0.7rem] text-muted-foreground/80">
                  {TOPICS[r.topic] ?? r.topic} · {GENRES[r.genre] ?? r.genre} · {fmtMinutes(r.min)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      {count < shown.length && (
        <button
          type="button"
          onClick={() => setCount(count + PAGE)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          Hiện thêm {Math.min(PAGE, shown.length - count)} bài
        </button>
      )}
    </div>
  );
}

export function StoryList({ level, items }: { level: string; items: StoryMeta[] }) {
  const read = useRead();
  const lv = contentLevel(level);
  const a = contentAccent(level);
  const done = items.filter((s) => read.has(s.id)).length;
  return (
    <div className="space-y-5">
      <LevelHeader cefr={lv?.cefr ?? level} label={lv?.label ?? level} done={done} total={items.length} back="/truyen" noun="truyện" accent={a} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((s) => {
          const isRead = read.has(s.id);
          return (
            <Link
              key={s.id}
              href={`/truyen/${level}/${s.id}`}
              className="group flex gap-3 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md active:scale-[0.99]"
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold", isRead ? "bg-emerald-500 text-white" : a.badge)}>
                {isRead ? <Check className="size-4" strokeWidth={3} /> : s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title_en}</span>
                <span className="block text-sm text-muted-foreground">{s.title_vi}</span>
                <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground/90">{s.summary}</span>
                <span className="mt-1.5 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                  {s.chapters} chương · {fmtMinutes(s.min)}
                  {s.video && (
                    <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                      <Clapperboard className="size-3" /> có video
                    </span>
                  )}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LevelHeader({
  cefr,
  label,
  done,
  total,
  back,
  noun,
  accent,
}: {
  cefr: string;
  label: string;
  done: number;
  total: number;
  back: string;
  noun: string;
  accent: { badge: string; bar: string };
}) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${accent.badge}`}>{cefr}</span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{label}</h1>
            <p className="text-sm text-muted-foreground">
              Đã đọc{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {done}/{total}
              </span>{" "}
              {noun}
            </p>
          </div>
        </div>
        <Link href={back} className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Cấp khác
        </Link>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-500 ${accent.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        on ? "border-primary/50 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function NextCard({ href, started, title, sub }: { href: string; started: boolean; title: string; sub: string }) {
  return (
    <Link href={href} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-primary/35 bg-primary/5 px-4 py-3 text-left transition-all hover:bg-primary/10 active:scale-[0.99]">
      <span className="min-w-0">
        <span className="block text-xs font-bold tracking-[0.12em] text-primary uppercase">{started ? "Đọc tiếp" : "Bắt đầu đọc"}</span>
        <span className="mt-0.5 block truncate font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-primary" />
    </Link>
  );
}
