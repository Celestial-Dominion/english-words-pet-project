"use client";

// Văn bản bài đọc / chương truyện: đoạn → câu → từ bấm-tra. Tắt Dịch = đọc liền mạch; bật Dịch =
// mỗi câu một khối (Anh + Việt, nút ▶ nghe từ câu đó). Thanh công cụ dính: nghe cả bài, tốc độ,
// câu trước/sau, Dịch. Từ trọng tâm (đúng cấp bài) ở cuối — nối bài đọc với Từ vựng/SRS.
import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { lookupWord, loadExamplesForWords, type ExampleSentence } from "@/lib/data";
import type { FocusWord, LibSentence } from "@/lib/library";
import type { Word } from "@/lib/types";
import { audioName } from "@/lib/slug";
import { playAudio } from "@/lib/tts";
import { cn } from "@/lib/utils";

const WordDetail = dynamic(() => import("@/components/word-detail"), { ssr: false });
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const TOKEN = /([A-Za-zÀ-ÿ]+(?:['’][A-Za-z]+)*(?:-[A-Za-zÀ-ÿ]+)*)/;

function Words({ text, onTap }: { text: string; onTap: (w: string) => void }) {
  return (
    <>
      {text.split(TOKEN).map((part, j) =>
        j % 2 ? (
          <button
            key={j}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTap(part);
            }}
            className="-mx-0.5 rounded-sm px-0.5 text-left align-baseline decoration-primary/40 underline-offset-4 transition-colors hover:bg-primary/10 hover:text-primary hover:underline focus-visible:bg-primary/10 focus-visible:text-primary focus-visible:outline-none"
          >
            {part}
          </button>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </>
  );
}

/** Thẻ tra từ dùng chung (tra qua lemma-map nên bấm dạng chia vẫn ra từ gốc). */
export function useWordLookup() {
  const [popup, setPopup] = useState<{ word: Word; examples: ExampleSentence[] } | null>(null);
  const open = async (token: string) => {
    const word = await lookupWord(token);
    if (!word) return;
    const ex = await loadExamplesForWords(word.level, [word.id]);
    setPopup({ word, examples: ex[word.id] ?? [] });
  };
  const node = popup ? <WordDetail word={popup.word} examples={popup.examples} onClose={() => setPopup(null)} /> : null;
  return { open, node };
}

export function PassageText({
  sentences,
  paras,
  showVi,
  active,
  onTapWord,
  onPlayFrom,
  domPrefix,
  canPlay,
}: {
  sentences: LibSentence[];
  paras: number[];
  showVi: boolean;
  active: number;
  onTapWord: (w: string) => void;
  onPlayFrom: (i: number) => void;
  domPrefix: string;
  canPlay: boolean;
}) {
  const groups = paras.map((p, k) => ({ from: p, to: paras[k + 1] ?? sentences.length }));
  if (!showVi)
    return (
      <div className="space-y-5 text-[1.08rem] leading-[1.95] sm:text-[1.14rem] sm:leading-[2]">
        {groups.map(({ from, to }) => (
          <p key={from}>
            {sentences.slice(from, to).map((s, k) => {
              const i = from + k;
              return (
                <span key={i} id={`${domPrefix}${i}`} className={cn("rounded-md transition-colors", i === active && "bg-primary/10 dark:bg-primary/20")}>
                  <Words text={s.en} onTap={onTapWord} />{" "}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    );
  return (
    <div className="space-y-6">
      {groups.map(({ from, to }) => (
        <div key={from} className="space-y-2">
          {sentences.slice(from, to).map((s, k) => {
            const i = from + k;
            return (
              <div key={i} id={`${domPrefix}${i}`} className={cn("group flex gap-2 rounded-xl px-2 py-1.5 transition-colors", i === active && "bg-primary/10 dark:bg-primary/20")}>
                {canPlay && (
                  <button
                    type="button"
                    onClick={() => onPlayFrom(i)}
                    aria-label={`Nghe câu ${i + 1}`}
                    className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Play className="size-3.5" />
                  </button>
                )}
                <div className="min-w-0">
                  <p className="text-[1.06rem] leading-[1.8] sm:text-[1.12rem]">
                    <Words text={s.en} onTap={onTapWord} />
                  </p>
                  <p className="mt-1 border-l-2 border-primary/30 pl-3 text-[0.92rem] leading-relaxed text-muted-foreground">{s.vi}</p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function PassageToolbar({
  canPlay,
  playing,
  onToggle,
  onStep,
  rate,
  onCycleRate,
  showVi,
  onToggleVi,
  children,
}: {
  canPlay: boolean;
  playing: boolean;
  onToggle: () => void;
  onStep: (d: number) => void;
  rate: number;
  onCycleRate: () => void;
  showVi: boolean;
  onToggleVi: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="sticky z-30 mb-4 flex items-center gap-1 overflow-x-auto rounded-2xl border bg-background/90 p-2 shadow-sm backdrop-blur-md"
      style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
    >
      {canPlay ? (
        <>
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
          <button type="button" onClick={() => onStep(-1)} aria-label="Câu trước" className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted min-[400px]:inline-flex">
            <SkipBack className="size-4" />
          </button>
          <button type="button" onClick={() => onStep(1)} aria-label="Câu sau" className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted min-[400px]:inline-flex">
            <SkipForward className="size-4" />
          </button>
          <button
            type="button"
            onClick={onCycleRate}
            title="Tốc độ nghe"
            aria-label={`Tốc độ nghe: ${rate}×`}
            className={cn(
              "inline-flex w-12 shrink-0 items-center justify-center rounded-full py-1.5 text-sm font-medium tabular-nums transition-colors",
              rate !== 1 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {rate}×
          </button>
        </>
      ) : (
        <span className="px-2 text-xs text-muted-foreground">Chưa có audio</span>
      )}
      <div className="ml-auto inline-flex shrink-0 items-center rounded-full bg-muted p-0.5">
        <button
          type="button"
          onClick={onToggleVi}
          aria-pressed={showVi}
          className={cn("rounded-full px-3 py-1 text-sm font-medium transition-colors", showVi ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
        >
          Dịch
        </button>
      </div>
      {children}
    </div>
  );
}

export function FocusWords({ words, level, onOpen }: { words: FocusWord[]; level: string; onOpen: (id: string) => void }) {
  if (!words.length) return null;
  return (
    <section className="mt-8 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Từ trọng tâm</h2>
        <p className="text-sm text-muted-foreground">Từ cấp {level.toUpperCase()} có trong bài — bấm để xem nghĩa, ví dụ và thêm vào lịch học.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {words.map((w) => (
          <div key={w.id} className="flex items-start gap-2 rounded-2xl border bg-card px-3 py-2.5">
            <button type="button" onClick={() => onOpen(w.id)} className="min-w-0 flex-1 text-left">
              <span className="font-semibold">{w.id}</span>
              {w.ipa && <span className="ml-2 text-sm text-primary dark:text-sky-400">/{w.ipa}/</span>}
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">{w.vi}</span>
            </button>
            <button
              type="button"
              aria-label={`Phát âm ${w.id}`}
              onClick={() => playAudio(`${BASE}/audio/words/${audioName(w.id)}.mp3`)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Volume2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
