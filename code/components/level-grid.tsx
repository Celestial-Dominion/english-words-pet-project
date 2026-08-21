"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { progressSummary, getDueReviews } from "@/lib/db";
import { loadReadingsIndex } from "@/lib/data";
import { LEVELS, FOUNDATION, levelAccent } from "@/lib/levels";

export default function LevelGrid() {
  const [byLevel, setByLevel] = useState<Record<number, number>>({});
  const [dueByLevel, setDueByLevel] = useState<Record<number, number>>({});
  const [readsByLevel, setReadsByLevel] = useState<Record<number, number>>({});
  useEffect(() => {
    const refresh = () => {
      progressSummary().then((s) => setByLevel(s.byLevel));
      getDueReviews().then((rows) => {
        const m: Record<number, number> = {};
        for (const r of rows) m[r.level] = (m[r.level] ?? 0) + 1;
        setDueByLevel(m);
      });
    };
    refresh();
    loadReadingsIndex().then((idx) => {
      const m: Record<number, number> = {};
      for (const r of idx) m[r.level] = (m[r.level] ?? 0) + 1;
      setReadsByLevel(m);
    });
    // Cập nhật số đến hạn định kỳ (như HSK) — BỎ QUA khi tab đang ẩn: mỗi lượt là một lần quét
    // cả bảng reviews, chạy nền cả ngày trên tab mở sẵn thì phí.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LEVELS.map((l) => {
        const a = levelAccent(l.level);
        const learned = byLevel[l.level] ?? 0;
        const due = dueByLevel[l.level] ?? 0;
        const nReads = readsByLevel[l.level] ?? 0;
        const pct = l.words ? Math.min(100, (learned / l.words) * 100) : 0;
        return (
          <Link
            key={l.level}
            href={`/hoc/${l.level}`}
            className={`group overflow-hidden rounded-2xl border bg-gradient-to-br ${a.grad} p-5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex size-11 items-center justify-center rounded-xl text-lg font-bold ${a.badge}`}>
                {l.cefr}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{l.label.split("·")[1]?.trim()}</div>
                <div className="text-sm text-muted-foreground">
                  {l.words.toLocaleString("vi")} từ{nReads > 0 ? ` · ${nReads} bài đọc` : ""}
                </div>
              </div>
              {due > 0 && (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {due} đến hạn
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all ${a.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {learned}/{l.words.toLocaleString("vi")}
              </span>
            </div>
          </Link>
        );
      })}
    </div>

    {/* Bộ nền A1–A2 nằm dưới cùng, dịu màu: chỉ để tra cứu, không phải một chặng của lộ trình. */}
    <Link
      href={`/hoc/${FOUNDATION.level}`}
      className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed p-4 transition-all hover:bg-muted/50 active:scale-[0.99]"
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${levelAccent(0).badge}`}>
        {FOUNDATION.cefr}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Nền tảng</div>
        <div className="text-sm text-muted-foreground">
          {FOUNDATION.words.toLocaleString("vi")} từ A1–A2 · chỉ tra cứu, không vào lộ trình học
        </div>
      </div>
    </Link>
    </>
  );
}
