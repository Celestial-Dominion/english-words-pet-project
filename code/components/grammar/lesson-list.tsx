"use client";

// Danh sách bài Ngữ pháp (một cấp hoặc một nhóm) theo thứ tự học, kèm tiến độ: ô tích đã học / chưa học (tích tay = đã
// học nhưng không xếp lịch ôn — lib/grammar.ts markLearned), đến hạn ôn, điểm cao nhất; thanh lọc theo trạng thái.
// Dữ liệu danh sách có sẵn lúc build (HTML tĩnh); tiến độ đọc từ IndexedDB phía client. Không prefetch từng bài
// (một cấp có vài chục link — tránh vài chục request thừa khi chỉ lướt danh sách).
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Clock } from "lucide-react";
import { isDue, isLearned, regLabels, type GrammarMeta } from "@/lib/grammar";
import { grammarRows, setGrammarLearned } from "@/lib/grammar-progress";
import { contentAccent, contentLevel } from "@/lib/levels";
import { fmtTime } from "@/lib/video";
import { DoneFilterBar, EmptyFilter, TickCard, byDone, type DoneFilter } from "@/components/done-toggle";

export function GrammarLessonList({ items, cats, showLevel = false }: { items: GrammarMeta[]; cats: Record<string, string>; showLevel?: boolean }) {
  const rows = useLiveQuery(() => grammarRows(), []);
  const [status, setStatus] = useState<DoneFilter>("all");
  const now = new Date();
  if (!items.length) return <p className="text-sm text-muted-foreground">Chưa có bài nào.</p>;
  const isDone = (l: GrammarMeta) => isLearned(rows?.get(l.id));
  const done = items.filter(isDone).length;
  const shown = byDone(items, status, isDone);
  return (
    <div className="space-y-4">
      <DoneFilterBar kind="learn" value={status} onChange={setStatus} total={items.length} done={done} />
      {shown.length ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {shown.map((l) => {
            const r = rows?.get(l.id);
            const d = isLearned(r);
            const due = isDue(r, now);
            const a = contentAccent(l.lv);
            return (
              <TickCard
                key={l.id}
                href={`/ngu-phap/${l.lv}/${l.id}`}
                prefetch={false}
                kind="learn"
                done={d}
                // ghi hỏng (riêng tư / hết quota) đã nổi banner StorageAlert ở lib/db.ts
                onToggle={() => void setGrammarLearned(l.id, !d).catch(() => {})}
                name={l.t}
                cardClass={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br ${a.grad} p-3.5 transition-all group-hover:border-primary/50 group-hover:shadow-md active:scale-[0.99]`}
              >
                <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl ${a.badge}`}>
                  <span className="text-base leading-tight font-bold tabular-nums">{l.n}</span>
                  {showLevel && <span className="text-[0.6rem] font-semibold">{contentLevel(l.lv)?.cefr}</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{l.t}</div>
                  <div className="truncate text-sm text-muted-foreground">{l.en}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
                    <span>{fmtTime(l.dur)}</span>
                    <span>· {cats[l.cat] ?? l.cat}</span>
                    {l.kind === "contrast" && <span className="rounded-full border px-1.5">Đối chiếu</span>}
                    {regLabels(l.reg).map((x) => (
                      <span key={x} className="rounded-full border px-1.5">
                        {x}
                      </span>
                    ))}
                    {due && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                        <Clock className="size-3" /> ôn lại
                      </span>
                    )}
                    {r?.best ? <span>· {r.best}%</span> : null}
                  </div>
                </div>
              </TickCard>
            );
          })}
        </div>
      ) : (
        <EmptyFilter kind="learn" filter={status} />
      )}
    </div>
  );
}
