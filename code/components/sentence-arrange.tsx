"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { sentenceAudioUrl, playAudio as play, stopAudio as stop } from "@/lib/tts";
import { cn } from "@/lib/utils";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function SentenceArrange({
  en,
  vi,
  tokens,
  onNext,
}: {
  en: string;
  vi: string;
  tokens: string[];
  onNext: (correct: boolean) => void;
}) {
  // bank giữ {token, id} để token trùng nhau vẫn phân biệt; xáo tránh ra đúng thứ tự luôn
  const initial = useMemo(() => {
    const base = tokens.map((t, i) => ({ t, id: i }));
    let s = shuffle(base);
    for (let k = 0; k < 5 && tokens.length > 1 && s.map((x) => x.id).join() === base.map((x) => x.id).join(); k++)
      s = shuffle(base);
    return s;
  }, [tokens]);
  const [order] = useState(initial);
  const [answer, setAnswer] = useState<{ t: string; id: number }[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const placedIds = useMemo(() => new Set(answer.map((x) => x.id)), [answer]);
  const reservedRows = Math.max(1, Math.ceil(tokens.length / 4));

  const place = (item: { t: string; id: number }) => {
    if (checked !== null) return;
    setAnswer((a) => [...a, item]);
  };
  const unplace = (item: { t: string; id: number }) => {
    if (checked !== null) return;
    setAnswer((a) => a.filter((x) => x.id !== item.id));
  };

  const check = useCallback(() => {
    const correct = answer.map((x) => x.t).join(" ") === tokens.join(" ");
    setChecked(correct);
    play(sentenceAudioUrl(en)); // tự đọc lại câu ngay khi kiểm tra (đúng/sai đều đọc)
  }, [answer, tokens, en]);

  // Dừng audio khi rời câu (sang câu kế / thoát).
  useEffect(() => () => stop(), []);

  // Bàn phím: Enter/Space = Kiểm tra (khi xếp đủ) / Tiếp (khi đã chấm).
  // e.repeat: giữ phím hơi lâu sinh chuỗi keydown lặp — cú "Kiểm tra" lặp thành "Tiếp"
  // ngay lập tức, nhảy qua màn kết quả trước khi kịp nhìn.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "Enter" && e.key !== " ") || e.repeat) return;
      e.preventDefault();
      if (checked !== null) onNext(checked);
      else if (tokens.length > 0 && answer.length === tokens.length) check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checked, answer, tokens, check, onNext]);

  const placedCls =
    checked === null
      ? "border-primary/40 bg-primary/10 text-foreground active:scale-95"
      : checked
        ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        : "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300";

  return (
    <div className="flex min-h-0 flex-1 flex-col duration-300 animate-in fade-in slide-in-from-bottom-1 sm:flex-none">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2 sm:flex-none sm:overflow-visible">
        <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Sắp xếp thành câu đúng</span>
              <button onClick={() => play(sentenceAudioUrl(en))} aria-label="Nghe câu" className="text-primary">
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 text-lg font-medium">{vi}</div>
          </div>

          {/* câu đang dựng — chiều cao dự trữ cố định, không xô đẩy bố cục */}
          <div
            className="flex flex-wrap content-center items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/30 p-3"
            style={{ minHeight: `${reservedRows * 2.75 + 0.5}rem` }}
          >
            {answer.length === 0 && (
              <span className="text-sm text-muted-foreground">Chạm các từ bên dưới để xếp…</span>
            )}
            {answer.map((item) => (
              <button
                key={item.id}
                disabled={checked !== null}
                onClick={() => unplace(item)}
                className={cn("rounded-xl border px-3.5 py-2.5 text-xl font-medium transition-all", placedCls)}
              >
                {item.t}
              </button>
            ))}
          </div>

          {/* lộ đáp án */}
          {checked !== null && (
            <div className="space-y-2 border-t pt-4 text-center duration-300 animate-in fade-in slide-in-from-bottom-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                  checked ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                )}
              >
                {checked ? "✓ Chính xác!" : "✗ Chưa đúng"}
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="text-2xl font-medium leading-relaxed">{en}</div>
                <button onClick={() => play(sentenceAudioUrl(en))} aria-label="Nghe câu" className="text-primary">
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ngân hàng từ — thứ tự cố định; từ đã xếp để lại ô trống cùng cỡ (không co) */}
        {checked === null && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {order.map((item) =>
              placedIds.has(item.id) ? (
                <span
                  key={item.id}
                  aria-hidden
                  className="select-none rounded-xl border border-dashed border-muted-foreground/20 bg-muted/30 px-3.5 py-2.5 text-lg font-medium text-transparent"
                >
                  {item.t}
                </span>
              ) : (
                <button
                  key={item.id}
                  onClick={() => place(item)}
                  className="rounded-xl border bg-card px-3.5 py-2.5 text-lg font-medium shadow-sm transition-all hover:border-primary/50 hover:bg-muted active:scale-95"
                >
                  {item.t}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 pt-4">
        {checked === null ? (
          <button
            onClick={check}
            disabled={answer.length !== tokens.length}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            Kiểm tra
          </button>
        ) : (
          <button
            onClick={() => onNext(checked)}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
          >
            Tiếp tục <span className="hidden opacity-60 sm:inline">(Enter)</span>
          </button>
        )}
      </div>
    </div>
  );
}
