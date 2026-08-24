"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import type { SpellVerdict } from "@/lib/spell";
import type { Word } from "@/lib/types";
import type { ExampleSentence } from "@/lib/data";
import { posLabel } from "@/lib/pos";
import { cn } from "@/lib/utils";

/**
 * Thẻ GÕ CHÍNH TẢ: nghe từ + đọc nghĩa Việt → gõ lại từ tiếng Anh.
 * Khác trắc nghiệm ở chỗ không có phương án để loại trừ — đây mới là chỗ lộ ra mình
 * nhớ mặt chữ hay chỉ nhận ra mặt chữ.
 */
export default function SpellCard({
  word,
  vi,
  verdict,
  typed,
  examples,
  onSubmit,
  onReplay,
}: {
  word: Word;
  vi: string;
  verdict: SpellVerdict | null; // null = chưa trả lời
  typed: string;
  examples?: ExampleSentence[];
  onSubmit: (value: string) => void;
  onReplay: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const answered = verdict !== null;
  const tone =
    verdict === "exact"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : verdict === "close"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-rose-500/15 text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-4">
      {/* đề bài: nghĩa Việt + nút nghe (audio đã tự phát khi hiện thẻ) */}
      <div className="flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-6 text-center shadow-sm sm:min-h-[11rem] sm:p-8">
        <button
          onClick={onReplay}
          aria-label="Nghe lại"
          className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary active:scale-95"
        >
          <Volume2 className="size-7" />
        </button>
        <div className="text-2xl font-bold tracking-tight sm:text-3xl">{vi}</div>
        {!answered && <div className="text-xs font-medium tracking-wide text-primary/70">Gõ lại từ tiếng Anh</div>}
        {answered && (
          <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", tone)}>
            {verdict === "exact" ? "✓ Đúng" : verdict === "close" ? "≈ Suýt đúng — lệch 1 ký tự" : "✗ Sai"}
          </div>
        )}
      </div>

      {answered ? (
        <div className="space-y-2 rounded-3xl border bg-card p-4 text-center shadow-sm">
          {verdict !== "exact" && typed.trim() && (
            <div className="text-sm text-muted-foreground">
              Bạn gõ: <span className="font-medium line-through">{typed.trim()}</span>
            </div>
          )}
          <div className="text-2xl font-bold">{word.id}</div>
          <div className="font-mono text-sm text-muted-foreground">{word.ipa}</div>
          {word.pos.length > 0 && (
            <div className="text-xs italic text-muted-foreground">{word.pos.map(posLabel).join(" · ")}</div>
          )}
          <div className="text-sm leading-relaxed">{word.meaning_vi}</div>
          {examples?.slice(0, 1).map((s) => (
            <div key={s.en} className="border-t pt-2 text-left text-sm">
              <div className="font-medium">{s.en}</div>
              <div className="text-muted-foreground">{s.vi}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                e.preventDefault();
                onSubmit(value);
              }
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="gõ từ tiếng Anh…"
            aria-label="Gõ từ tiếng Anh"
            className="w-full rounded-2xl border-2 bg-background px-4 py-3.5 text-center text-xl font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <button
            onClick={() => value.trim() && onSubmit(value)}
            disabled={!value.trim()}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-40"
          >
            Kiểm tra <span className="hidden opacity-60 sm:inline">(Enter)</span>
          </button>
        </div>
      )}
    </div>
  );
}
