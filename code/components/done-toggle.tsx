"use client";

// Đánh dấu ĐÃ / CHƯA dùng chung cho Bài đọc · Truyện · Video · Ngữ pháp: ô tích trên từng dòng danh sách (tích / bỏ tích
// tại chỗ, không phải mở bài), nút trạng thái trong trang bài, thanh lọc "Tất cả · Chưa … · Đã …". Trạng thái Thư viện
// đọc bảng reads bằng useLiveQuery → tích ở đâu (kể cả đồng bộ kéo từ máy khác về) thì danh sách, lưới cấp, trang bài
// cùng đổi theo, không phải tải lại.
import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, CheckCircle2, Circle } from "lucide-react";
import { isRead, readIds } from "@/lib/db";
import { cn } from "@/lib/utils";

export const DONE_TEXT = {
  read: { done: "Đã đọc", todo: "Chưa đọc" },
  watch: { done: "Đã xem", todo: "Chưa xem" },
  learn: { done: "Đã học", todo: "Chưa học" },
} as const;
export type DoneKind = keyof typeof DONE_TEXT;

/** Tập id bài đọc / truyện / video đã đọc–xem (undefined = đang đọc IndexedDB). */
export function useReadSet(): Set<string> | undefined {
  return useLiveQuery(() => readIds(), []);
}

/** Một bài đã đọc–xem chưa (undefined = đang đọc IndexedDB — đừng coi là "chưa"). */
export function useIsRead(id: string): boolean | undefined {
  return useLiveQuery(() => isRead(id), [id]);
}

/** Nút trạng thái trong trang bài: "○ Chưa đọc" ⇄ "✓ Đã đọc" (tên nút = chữ đang hiện, aria-pressed = đã xong). */
export function DoneButton({
  kind,
  done,
  onToggle,
  hint,
  className,
}: {
  kind: DoneKind;
  done: boolean;
  onToggle: () => void;
  hint?: string; // chú thích thêm cho lúc CHƯA xong (vd "không cần làm luyện tập")
  className?: string;
}) {
  const t = DONE_TEXT[kind];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      title={done ? `Bấm để bỏ đánh dấu (về “${t.todo.toLowerCase()}”)` : `Bấm để đánh dấu ${t.done.toLowerCase()}${hint ? ` (${hint})` : ""}`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors",
        done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
      {done ? t.done : t.todo}
    </button>
  );
}

/** Ô tích tròn của một dòng danh sách: tích = đã đọc / xem / học, bỏ tích = chưa. */
export function DoneCheck({ kind, done, onToggle, name, className }: { kind: DoneKind; done: boolean; onToggle: () => void; name: string; className?: string }) {
  const t = DONE_TEXT[kind];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${t.done}: ${name}`}
      title={done ? `${t.done} — bấm để bỏ tích` : `Tích “${t.done.toLowerCase()}”`}
      onClick={onToggle}
      className={cn("group/tick inline-flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
          done
            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
            : "border-muted-foreground/35 bg-background text-transparent group-hover/tick:border-emerald-500/70 group-hover/tick:text-emerald-500/70",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </button>
  );
}

/** Dòng danh sách có ô tích: Link là cả thẻ, ô tích đè mép phải (nút không được lồng trong <a>). Thẻ một khối →
 *  ô tích giữa mép phải, thẻ chừa lề phải. `top` = thẻ cao nhiều dòng → ô tích ngang dòng tiêu đề, KHÔNG chừa lề cả
 *  thẻ (tóm tắt bên dưới dùng hết bề ngang) — nơi gọi tự chừa lề cho các dòng tiêu đề nằm cạnh ô tích. */
export function TickCard({
  href,
  prefetch,
  cardClass,
  kind,
  done,
  onToggle,
  name,
  top = false,
  children,
}: {
  href: string;
  prefetch?: boolean;
  cardClass: string;
  kind: DoneKind;
  done: boolean;
  onToggle: () => void;
  name: string;
  top?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group relative transition-transform duration-200 hover:-translate-y-0.5">
      <Link href={href} prefetch={prefetch} className={cn(cardClass, !top && "pr-14")}>
        {children}
      </Link>
      <DoneCheck kind={kind} done={done} onToggle={onToggle} name={name} className={cn("absolute right-2", top ? "top-2.5" : "top-1/2 -translate-y-1/2")} />
    </div>
  );
}

export type DoneFilter = "all" | "todo" | "done";

export function byDone<T>(items: readonly T[], filter: DoneFilter, isDone: (x: T) => boolean): T[] {
  return filter === "all" ? [...items] : items.filter((x) => isDone(x) === (filter === "done"));
}

/** Thanh lọc theo trạng thái (radiogroup: ←/→ chuyển lựa chọn) — kèm số bài mỗi nhóm. */
export function DoneFilterBar({
  kind,
  value,
  onChange,
  total,
  done,
  className,
}: {
  kind: DoneKind;
  value: DoneFilter;
  onChange: (v: DoneFilter) => void;
  total: number;
  done: number;
  className?: string;
}) {
  const t = DONE_TEXT[kind];
  const opts: [DoneFilter, string, number][] = [
    ["all", "Tất cả", total],
    ["todo", t.todo, total - done],
    ["done", t.done, done],
  ];
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const k = (opts.findIndex(([v]) => v === value) + step + opts.length) % opts.length;
    onChange(opts[k][0]);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[k]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Lọc theo trạng thái"
      onKeyDown={onKey}
      // điện thoại: 3 ô chia đều cả bề ngang (320px vẫn vừa); màn rộng: gọn theo chữ
      className={cn("grid w-full grid-cols-3 gap-0.5 rounded-full bg-muted p-0.5 sm:inline-grid sm:w-auto", className)}
    >
      {opts.map(([v, label, n]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          tabIndex={value === v ? 0 : -1}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:gap-1.5 sm:px-3.5 sm:text-sm",
            value === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
          <span className="text-[0.7rem] tabular-nums opacity-70 sm:text-xs">{n}</span>
        </button>
      ))}
    </div>
  );
}

/** Lọc xong không còn bài nào. */
export function EmptyFilter({ kind, filter, noun = "bài" }: { kind: DoneKind; filter: DoneFilter; noun?: string }) {
  const t = DONE_TEXT[kind];
  return (
    <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {filter === "done"
        ? `Chưa có ${noun} nào ${t.done.toLowerCase()} — tích ô tròn ở mỗi ${noun} để đánh dấu.`
        : `Xong hết rồi — không còn ${noun} nào ${t.todo.toLowerCase()}.`}
    </p>
  );
}
