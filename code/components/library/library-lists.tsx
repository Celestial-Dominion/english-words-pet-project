"use client";

// Lưới cấp + danh sách theo cấp cho Bài đọc và Truyện. Chỉ mục truyền từ server component (đọc lúc
// build) — trang không phải fetch; trạng thái đã đọc đọc từ IndexedDB (live) sau mount. Mỗi dòng có ô tích
// đã đọc / chưa đọc + thanh lọc theo trạng thái (components/done-toggle.tsx).
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clapperboard } from "lucide-react";
import { CONTENT_LEVELS, contentAccent, contentLevel } from "@/lib/levels";
import { setRead } from "@/lib/read-progress";
import { GENRES, TOPICS, fmtMinutes, type ReadingMeta, type StoryMeta } from "@/lib/library";
import { cn } from "@/lib/utils";
import { DoneFilterBar, EmptyFilter, TickCard, byDone, useReadSet, type DoneFilter } from "@/components/done-toggle";

// Ghi hỏng (riêng tư / hết quota) đã nổi banner StorageAlert ở lib/db.ts — ở đây chỉ chặn unhandled rejection.
const toggleRead = (id: string, done: boolean) => void setRead(id, !done).catch(() => {});

const nf = new Intl.NumberFormat("vi-VN");

export function LibraryLevelGrid({ items, base, noun }: { items: { id: string; level: string }[]; base: string; noun: string }) {
  const read = useReadSet();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTENT_LEVELS.map((l) => {
        const list = items.filter((x) => x.level === l.key);
        const a = contentAccent(l.key);
        const done = list.filter((x) => read?.has(x.id)).length;
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
  const read = useReadSet();
  const [topic, setTopic] = useState<string>("");
  const [status, setStatus] = useState<DoneFilter>("all");
  const [count, setCount] = useState(PAGE);
  const topics = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of items) m.set(r.topic, (m.get(r.topic) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const isDone = (r: ReadingMeta) => !!read?.has(r.id);
  const inTopic = topic ? items.filter((r) => r.topic === topic) : items;
  const done = inTopic.filter(isDone).length;
  const shown = byDone(inTopic, status, isDone);
  const nextUnread = inTopic.find((r) => !isDone(r));
  const lv = contentLevel(level);
  const a = contentAccent(level);
  return (
    <div className="space-y-5">
      <LevelHeader cefr={lv?.cefr ?? level} label={lv?.label ?? level} done={done} total={inTopic.length} back="/bai-doc" noun="bài" accent={a} />
      <DoneFilterBar kind="read" value={status} onChange={(v) => (setStatus(v), setCount(PAGE))} total={inTopic.length} done={done} />
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
      {nextUnread && status !== "done" && <NextCard href={`/bai-doc/${level}/${nextUnread.id}`} started={done > 0} title={nextUnread.title_en} sub={nextUnread.title_vi} />}
      {shown.length ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, count).map((r) => {
            const d = isDone(r);
            return (
              <TickCard
                key={r.id}
                href={`/bai-doc/${level}/${r.id}`}
                kind="read"
                done={d}
                onToggle={() => toggleRead(r.id, d)}
                name={r.title_en}
                cardClass="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all group-hover:border-primary/45 group-hover:shadow-md active:scale-[0.99]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground tabular-nums">{r.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title_en}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.title_vi}</span>
                  <span className="block truncate text-[0.7rem] text-muted-foreground/80">
                    {TOPICS[r.topic] ?? r.topic} · {GENRES[r.genre] ?? r.genre} · {fmtMinutes(r.min)}
                  </span>
                </span>
              </TickCard>
            );
          })}
        </div>
      ) : (
        <EmptyFilter kind="read" filter={status} />
      )}
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
  const read = useReadSet();
  const [status, setStatus] = useState<DoneFilter>("all");
  const lv = contentLevel(level);
  const a = contentAccent(level);
  const isDone = (s: StoryMeta) => !!read?.has(s.id);
  const done = items.filter(isDone).length;
  const shown = byDone(items, status, isDone);
  return (
    <div className="space-y-5">
      <LevelHeader cefr={lv?.cefr ?? level} label={lv?.label ?? level} done={done} total={items.length} back="/truyen" noun="truyện" accent={a} />
      <DoneFilterBar kind="read" value={status} onChange={setStatus} total={items.length} done={done} />
      {shown.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((s) => {
            const d = isDone(s);
            return (
              <TickCard
                key={s.id}
                href={`/truyen/${level}/${s.id}`}
                kind="read"
                done={d}
                onToggle={() => toggleRead(s.id, d)}
                name={s.title_en}
                top
                cardClass="flex gap-3 rounded-2xl border bg-card p-4 transition-all group-hover:border-primary/45 group-hover:shadow-md active:scale-[0.99]"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${a.badge}`}>{s.n}</span>
                <span className="min-w-0 flex-1">
                  {/* hai dòng tên nằm cạnh ô tích (đè góc phải thẻ) → chừa lề; tóm tắt bên dưới dùng hết bề ngang */}
                  <span className="block pr-9 font-semibold">{s.title_en}</span>
                  <span className="block pr-9 text-sm text-muted-foreground">{s.title_vi}</span>
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
              </TickCard>
            );
          })}
        </div>
      ) : (
        <EmptyFilter kind="read" filter={status} noun="truyện" />
      )}
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
