"use client";

import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { contentAccent } from "@/lib/levels";
import { setRead } from "@/lib/read-progress";
import { fmtTime, type VideoMeta } from "@/lib/video";
import { DoneFilterBar, EmptyFilter, TickCard, byDone, useReadSet, type DoneFilter } from "@/components/done-toggle";

// Danh sách Video của MỘT cấp (chỉ mục có sẵn lúc build, sắp theo thứ tự truyện nguồn). Mỗi dòng có ô tích
// đã xem / chưa xem + thanh lọc theo trạng thái.
export function VideoList({ items }: { items: VideoMeta[] }) {
  const seen = useReadSet();
  const [status, setStatus] = useState<DoneFilter>("all");
  if (!items.length) return <p className="text-sm text-muted-foreground">Chưa có bài nào.</p>;
  const isDone = (v: VideoMeta) => !!seen?.has(v.id);
  const done = items.filter(isDone).length;
  const shown = byDone(items, status, isDone);
  return (
    <div className="space-y-4">
      <DoneFilterBar kind="watch" value={status} onChange={setStatus} total={items.length} done={done} />
      {shown.length ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {shown.map((v) => {
            const a = contentAccent(v.level);
            const d = isDone(v);
            return (
              <TickCard
                key={v.id}
                href={`/video/${v.level}/${v.id}`}
                kind="watch"
                done={d}
                // ghi hỏng (riêng tư / hết quota) đã nổi banner StorageAlert ở lib/db.ts
                onToggle={() => void setRead(v.id, !d).catch(() => {})}
                name={v.title.en}
                cardClass={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br ${a.grad} p-3.5 transition-all group-hover:border-primary/50 group-hover:shadow-md active:scale-[0.99]`}
              >
                <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl ${a.badge}`}>
                  <Clapperboard className="size-4 opacity-70" />
                  <span className="text-sm leading-tight font-bold tabular-nums">{v.n < 999 ? v.n : ""}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{v.title.en}</div>
                  <div className="truncate text-sm text-muted-foreground">{v.title.vi}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                    {fmtTime(v.duration)} · {v.lines} lượt{v.focus ? ` · ${v.focus}` : ""}
                  </div>
                </div>
              </TickCard>
            );
          })}
        </div>
      ) : (
        <EmptyFilter kind="watch" filter={status} />
      )}
    </div>
  );
}
