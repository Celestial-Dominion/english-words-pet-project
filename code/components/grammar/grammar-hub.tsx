"use client";

// Phần động của trang Ngữ pháp (theo tiến độ trong IndexedDB): học tiếp bài kế, bài đến hạn ôn, số bài đã học mỗi cấp.
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Clock, PlayCircle } from "lucide-react";
import { isDue, isLearned } from "@/lib/grammar";
import { grammarRows } from "@/lib/grammar-progress";
import { CONTENT_LEVELS, contentAccent, contentLevel } from "@/lib/levels";

// [id, cấp, số thứ tự, tên, nhãn tiếng Anh] — gọn để nhúng vào trang (không kèm nội dung bài)
export type HubItem = [string, string, number, string, string];

export function GrammarContinue({ items }: { items: HubItem[] }) {
  const rows = useLiveQuery(() => grammarRows(), []);
  if (!rows || !items.length) return null;
  const now = new Date();
  const nextUp = items.find(([id]) => !isLearned(rows.get(id)));
  const due = items.filter(([id]) => isDue(rows.get(id), now));
  const learned = items.filter(([id]) => isLearned(rows.get(id))).length;
  return (
    <div className="space-y-3">
      {nextUp && (
        <Link
          href={`/ngu-phap/${nextUp[1]}/${nextUp[0]}`}
          className="flex items-center gap-4 rounded-3xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10 active:scale-[0.99]"
        >
          <PlayCircle className="size-10 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold tracking-wide text-primary uppercase">
              {learned ? "Học tiếp" : "Bắt đầu"} · {contentLevel(nextUp[1])?.cefr} bài {nextUp[2]}
            </div>
            <div className="truncate text-lg font-semibold">{nextUp[3]}</div>
            <div className="truncate text-sm text-muted-foreground">{nextUp[4]}</div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-primary" />
        </Link>
      )}
      {due.length > 0 && (
        <div className="rounded-3xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-600">
            <Clock className="size-4" /> Đến hạn ôn ({due.length}) — làm lại phần luyện tập
          </div>
          <div className="flex flex-wrap gap-2">
            {due.slice(0, 12).map(([id, lv, , t]) => (
              <Link key={id} href={`/ngu-phap/${lv}/${id}#luyen-tap`} prefetch={false} className="max-w-full truncate rounded-full border px-3 py-1 text-sm hover:bg-muted">
                {t}
              </Link>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        Đã học {learned}/{items.length} bài
      </p>
    </div>
  );
}

// Lưới cấp: số bài + số phút + số bài đã học (client đếm theo tiến độ).
export function GrammarLevelGrid({ counts, items }: { counts: Record<string, { lessons: number; min: number }>; items: HubItem[] }) {
  const rows = useLiveQuery(() => grammarRows(), []);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTENT_LEVELS.map((l) => {
        const c = counts[l.key];
        const a = contentAccent(l.key);
        const done = rows && c ? items.filter(([id, lv]) => lv === l.key && isLearned(rows.get(id))).length : 0;
        const body = (
          <>
            <div className="flex items-center gap-3">
              <span className={`flex size-11 items-center justify-center rounded-xl text-base font-bold ${a.badge}`}>{l.cefr}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{l.label.split(" · ")[1]}</span>
                <span className="block text-sm text-muted-foreground tabular-nums">{c ? `${c.lessons} bài · ${c.min} phút` : "Đang biên soạn"}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all duration-500 ${a.bar}`} style={{ width: `${c ? (done / c.lessons) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {done}/{c?.lessons ?? 0}
              </span>
            </div>
          </>
        );
        const cls = `group overflow-hidden rounded-2xl border bg-gradient-to-br ${a.grad} p-5 text-left transition-all`;
        return c ? (
          <Link key={l.key} href={`/ngu-phap/${l.key}`} className={`${cls} hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}>
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
