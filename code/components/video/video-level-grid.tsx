"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { CONTENT_LEVELS, contentAccent } from "@/lib/levels";
import { readIds } from "@/lib/db";
import type { VideoMeta } from "@/lib/video";

// Lưới cấp của Video (giống Truyện / Bài đọc): mỗi cấp = số bài + tổng thời lượng + đã xem.
export function VideoLevelGrid({ items }: { items: VideoMeta[] }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    void readIds().then(setSeen);
  }, []);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTENT_LEVELS.map((l) => {
        const vs = items.filter((v) => v.level === l.key);
        if (!vs.length) return null;
        const a = contentAccent(l.key);
        const min = Math.round(vs.reduce((n, v) => n + v.duration, 0) / 60);
        const done = vs.filter((v) => seen.has(v.id)).length;
        return (
          <Link
            key={l.key}
            href={`/video/${l.key}`}
            className={`group flex items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br ${a.grad} p-5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}
          >
            <span className={`flex size-11 items-center justify-center rounded-xl text-base font-bold ${a.badge}`}>{l.cefr}</span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold">{l.label.split(" · ")[1]}</div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {vs.length} bài · {min} phút{done ? ` · đã xem ${done}` : ""}
              </div>
            </div>
            <Clapperboard className="size-5 shrink-0 opacity-50" />
          </Link>
        );
      })}
    </div>
  );
}
