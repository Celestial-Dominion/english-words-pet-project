"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { sentenceAudioUrl } from "@/lib/tts";
import { cn } from "@/lib/utils";

type Sentence = { en: string; vi: string; sp?: number };

function splitTokens(en: string): string[] {
  return en.split(/(\s+)/);
}
const isWord = (t: string) => /[a-z'’]/i.test(t);

// Nghe cả bài: phát tuần tự từng câu, tô sáng câu đang đọc + tự cuộn vào giữa; đổi tốc độ.
const SPEEDS = [1, 0.75, 1.25];
export function useListenAll(sentences: Sentence[]) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rateRef = useRef(1);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setActiveIdx(-1);
  };
  useEffect(() => () => stop(), []);
  // Đổi bài/chương (mảng câu đổi) → dừng.
  useEffect(() => () => stop(), [sentences]);

  const playFrom = (i: number) => {
    if (i >= sentences.length) return stop();
    setActiveIdx(i);
    const a = new Audio(sentenceAudioUrl(sentences[i].en, sentences[i].sp ?? 0));
    a.playbackRate = rateRef.current;
    audioRef.current = a;
    a.onended = () => playFrom(i + 1);
    // Thiếu/hỏng 1 file audio thì BỎ QUA câu đó rồi đọc tiếp, không dừng cả bài (trước đây
    // một câu lỗi giữa chừng là im luôn, người dùng tưởng app hỏng).
    const skip = () => {
      if (audioRef.current !== a) return; // đã bị dừng/đổi câu → không làm gì
      playFrom(i + 1);
    };
    a.onerror = skip;
    a.play().catch(skip);
    document.getElementById(`psent-${i}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const toggle = () => (activeIdx >= 0 ? stop() : playFrom(0));
  const cycleRate = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length] ?? 1;
    rateRef.current = next;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return { activeIdx, playing: activeIdx >= 0, toggle, rate, cycleRate, stop };
}

export function ReaderToolbar({
  playing,
  onToggle,
  rate,
  onCycleRate,
  showVi,
  onToggleVi,
}: {
  playing: boolean;
  onToggle: () => void;
  rate: number;
  onCycleRate: () => void;
  showVi: boolean;
  onToggleVi: () => void;
}) {
  return (
    <div
      className="sticky z-30 mb-4 flex items-center gap-2 rounded-2xl border bg-background/85 px-2 py-1.5 backdrop-blur"
      style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Dừng nghe" : "Nghe cả bài"}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          playing ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary hover:bg-primary/15",
        )}
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <span className="text-sm font-medium text-muted-foreground">{playing ? "Đang đọc…" : "Nghe cả bài"}</span>
      <button
        type="button"
        onClick={onCycleRate}
        title="Tốc độ nghe"
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors",
          rate !== 1 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
        )}
      >
        {rate}×
      </button>
      <div className="ml-auto inline-flex items-center rounded-full bg-muted p-0.5">
        <button
          type="button"
          onClick={onToggleVi}
          aria-pressed={showVi}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            showVi ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Dịch
        </button>
      </div>
    </div>
  );
}

export function Passage({
  sentences,
  showVi,
  activeIdx,
  onTapWord,
  speakers,
}: {
  sentences: Sentence[];
  showVi: boolean;
  activeIdx: number;
  onTapWord: (token: string) => void;
  speakers?: string[]; // có = HỘI THOẠI: render theo lượt nói thay vì văn xuôi
}) {
  const renderWords = (en: string) =>
    splitTokens(en).map((tok, j) =>
      isWord(tok) ? (
        <button
          key={j}
          type="button"
          onClick={() => onTapWord(tok)}
          className="rounded align-bottom transition-colors hover:bg-primary/15 hover:text-primary"
        >
          {tok}
        </button>
      ) : (
        <span key={j}>{tok}</span>
      ),
    );

  // HỘI THOẠI: mỗi câu là một lượt nói — tên vai + bong bóng lệch trái/phải để mắt bám được
  // ai đang nói. Vai 1 đọc bằng giọng nam (xem lib/tts.ts).
  if (speakers?.length) {
    return (
      <div className="space-y-3">
        {sentences.map((s, i) => {
          const sp = s.sp ?? 0;
          return (
            <div key={i} id={`psent-${i}`} className={cn("flex", sp ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl border px-4 py-3 transition-colors",
                  sp ? "bg-sky-500/10 border-sky-500/25" : "bg-card",
                  i === activeIdx && "ring-2 ring-primary/40",
                )}
              >
                <div className={cn("mb-1 text-xs font-semibold", sp ? "text-sky-700 dark:text-sky-300" : "text-muted-foreground")}>
                  {speakers[sp] ?? (sp ? "B" : "A")}
                </div>
                <p className="text-xl leading-relaxed">{renderWords(s.en)}</p>
                {showVi && <p className="mt-1.5 border-l-[3px] border-primary/30 pl-3 text-sm text-muted-foreground">{s.vi}</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Tắt Dịch → đọc liền mạch (immersive).
  if (!showVi) {
    return (
      <div className="text-2xl leading-[2.4rem] tracking-wide">
        {sentences.map((s, i) => (
          <span
            key={i}
            id={`psent-${i}`}
            className={cn("rounded-md transition-colors", i === activeIdx && "bg-primary/10 dark:bg-primary/20")}
          >
            {renderWords(s.en)}{" "}
          </span>
        ))}
      </div>
    );
  }

  // Bật Dịch → mỗi câu một khối: dòng Anh + dòng dịch phụ (viền trái).
  return (
    <div className="space-y-5">
      {sentences.map((s, i) => (
        <div
          key={i}
          id={`psent-${i}`}
          className={cn("rounded-xl px-2 py-1 transition-colors", i === activeIdx && "bg-primary/10 dark:bg-primary/20")}
        >
          <p className="text-2xl leading-relaxed">{renderWords(s.en)}</p>
          <p className="mt-1.5 border-l-[3px] border-primary/30 pl-3 text-base text-muted-foreground">{s.vi}</p>
        </div>
      ))}
    </div>
  );
}
