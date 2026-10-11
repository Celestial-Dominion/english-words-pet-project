"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { progressSummary, getDueReviews, getStartLevel, onConfigChanged } from "@/lib/db";
import { loadReadingsIndex } from "@/lib/library";
import { onSyncMerged } from "@/lib/sync";
import { healLegacyLevels } from "@/lib/warm";
import { CONTENT_LEVELS, LEVELS, levelAccent, levelMeta } from "@/lib/levels";
import { openSettings } from "@/components/settings-sheet";

export default function LevelGrid() {
  const [byLevel, setByLevel] = useState<Record<number, number>>({});
  const [dueByLevel, setDueByLevel] = useState<Record<number, number>>({});
  const [readsByLevel, setReadsByLevel] = useState<Record<number, number>>({});
  // Cấp bắt đầu (Cài đặt): cấp thấp hơn là ĐÃ BỎ QUA — xếp xuống cuối, dịu màu, chỉ để tra cứu.
  // null = đang đọc (vài ms) → chưa vẽ lưới để không nhảy thứ tự thẻ.
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => {
    const refresh = () => {
      // độ phủ vốn từ: đã học + đã biết sẵn (byLevel chỉ là số liệu huy hiệu, không tính từ chưa kiểm tra)
      progressSummary().then((s) => {
        setByLevel(s.coverageByLevel);
        setStart(s.startLevel);
      });
      getDueReviews().then((rows) => {
        const m: Record<number, number> = {};
        for (const r of rows) m[r.level] = (m[r.level] ?? 0) + 1;
        setDueByLevel(m);
      });
    };
    refresh();
    void healLegacyLevels().then((n) => n > 0 && refresh());
    // Số bài đọc CÙNG cấp CEFR với cấp từ vựng (A1 từ ↔ bài đọc A1…).
    loadReadingsIndex()
      .then((idx) => {
        const m: Record<number, number> = {};
        for (const r of idx) {
          const lv = CONTENT_LEVELS.find((c) => c.key === r.level)?.vocabLevel;
          if (lv !== undefined) m[lv] = (m[lv] ?? 0) + 1;
        }
        setReadsByLevel(m);
      })
      .catch(() => {});
    // Đổi "Bắt đầu từ cấp" trong ngăn Cài đặt / kéo tiến độ máy khác về → xếp lại lưới ngay.
    const offCfg = onConfigChanged((c) => void getStartLevel(c).then(setStart));
    const offSync = onSyncMerged(refresh);
    // Cập nhật số đến hạn định kỳ (như HSK) — BỎ QUA khi tab đang ẩn: mỗi lượt là một lần quét
    // cả bảng reviews, chạy nền cả ngày trên tab mở sẵn thì phí.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => {
      clearInterval(t);
      offCfg();
      offSync();
    };
  }, []);

  if (start === null) return null;
  const route = LEVELS.filter((l) => l.level >= start);
  const skipped = LEVELS.filter((l) => l.level < start);

  return (
    <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {route.map((l) => {
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

    {/* Cấp đã bỏ qua nằm dưới cùng, dịu màu: chỉ để tra cứu, không phải một chặng của lộ trình. */}
    {skipped.length > 0 && (
      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {skipped.map((l) => (
            <Link
              key={l.level}
              href={`/hoc/${l.level}`}
              className="flex items-center gap-3 rounded-2xl border border-dashed p-4 transition-all hover:bg-muted/50 active:scale-[0.99]"
            >
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${levelAccent(l.level).badge}`}>
                {l.cefr}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{l.label.split("·")[1]?.trim()}</div>
                <div className="text-sm text-muted-foreground">
                  {l.words.toLocaleString("vi")} từ · đã bỏ qua, chỉ tra cứu
                </div>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Bạn đang bắt đầu từ {levelMeta(start)?.cefr} nên{" "}
          {skipped.length > 1 ? `${skipped[0].cefr}–${skipped[skipped.length - 1].cefr}` : skipped[0].cefr} không vào lộ
          trình học.{" "}
          <button type="button" onClick={openSettings} className="font-semibold text-primary hover:underline">
            Đổi trong Cài đặt
          </button>
        </p>
      </div>
    )}
    </>
  );
}
