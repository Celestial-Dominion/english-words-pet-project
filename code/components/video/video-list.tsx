"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clapperboard } from "lucide-react";
import { contentAccent } from "@/lib/levels";
import { readIds } from "@/lib/db";
import { fmtTime, type VideoMeta } from "@/lib/video";

// Danh sách Video của MỘT cấp (chỉ mục có sẵn lúc build, sắp theo thứ tự truyện nguồn).
export function VideoList({ items }: { items: VideoMeta[] }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    void readIds().then(setSeen);
  }, []);
  if (!items.length) return <p className="text-sm text-muted-foreground">Chưa có bài nào.</p>;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map((v) => {
        const a = contentAccent(v.level);
        const done = seen.has(v.id);
        return (
          <Link
            key={v.id}
            href={`/video/${v.level}/${v.id}`}
            className={`group flex items-center gap-3 rounded-2xl border bg-gradient-to-br ${a.grad} p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.99]`}
          >
            <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl ${done ? "bg-emerald-500 text-white" : a.badge}`}>
              {done ? <Check className="size-5" strokeWidth={3} /> : <Clapperboard className="size-4 opacity-70" />}
              <span className="text-sm leading-tight font-bold tabular-nums">{v.n < 999 ? v.n : ""}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold">{v.title.en}</div>
              <div className="truncate text-sm text-muted-foreground">{v.title.vi}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                {fmtTime(v.duration)} · {v.lines} lượt{v.focus ? ` · ${v.focus}` : ""}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
