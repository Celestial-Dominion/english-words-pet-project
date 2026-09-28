"use client";

// Phần học kèm dưới transcript: Từ trong bài (bấm → thẻ từ / nghe trong hội thoại) và
// Cách nói (trọng tâm giao tiếp: mẫu câu + câu minh hoạ lấy từ chính hội thoại, bấm để nghe).
import { memo } from "react";
import { Play, Volume2 } from "lucide-react";
import { keyRanges, type VideoLesson, type VideoWord } from "@/lib/video";
import { audioName } from "@/lib/slug";
import { playAudio } from "@/lib/tts";
import { CONTENT_LEVELS } from "@/lib/levels";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Câu đầu tiên chứa từ (so theo chữ thường, cả dạng biến hình đơn giản).
export function firstLineWith(lesson: VideoLesson, en: string): number {
  const k = en.toLowerCase();
  const stem = k.replace(/(e|y)$/, "");
  return lesson.lines.findIndex((l) => {
    const low = l.en.toLowerCase();
    return low.includes(k) || (stem.length >= 4 && low.includes(stem));
  });
}

export const WordsSection = memo(function WordsSection({
  lesson,
  onOpen,
  onPlayLine,
  onBeforeSpeak,
}: {
  lesson: VideoLesson;
  onOpen: (w: VideoWord) => void;
  onPlayLine: (i: number) => void;
  onBeforeSpeak: () => void;
}) {
  if (!lesson.words.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Từ trong bài</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {lesson.words.map((w) => {
          const li = firstLineWith(lesson, w.en);
          const lv = w.level !== undefined ? CONTENT_LEVELS[w.level]?.cefr : undefined;
          return (
            <div key={w.en} className="flex items-start gap-3 rounded-2xl border bg-card p-3.5">
              <button type="button" onClick={() => (w.id ? onOpen(w) : li >= 0 && onPlayLine(li))} className="min-w-0 flex-1 text-left">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg leading-tight font-bold">{w.en}</span>
                  {lv && <span className="text-[0.65rem] font-semibold text-muted-foreground">{lv}</span>}
                </div>
                {w.ipa && <div className="mt-0.5 text-sm text-primary dark:text-sky-400">/{w.ipa}/</div>}
                <div className="mt-0.5 text-sm">{w.vi}</div>
                {w.note && <div className="mt-1 text-xs text-muted-foreground">{w.note}</div>}
              </button>
              <div className="flex shrink-0 flex-col items-center gap-1">
                {w.id && (
                  <button
                    type="button"
                    onClick={() => {
                      onBeforeSpeak();
                      playAudio(`${BASE}/audio/words/${audioName(w.id!)}.mp3`);
                    }}
                    aria-label={`Phát âm ${w.en}`}
                    className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    <Volume2 className="size-4" />
                  </button>
                )}
                {li >= 0 && (
                  <button
                    type="button"
                    onClick={() => onPlayLine(li)}
                    title="Nghe trong hội thoại"
                    aria-label={`Nghe câu có ${w.en}`}
                    className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Play className="size-3.5" /> câu {li + 1}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

// Tô cụm khoá trong câu.
function Marked({ text, keys }: { text: string; keys: string[] }) {
  const ranges = keyRanges(text, keys);
  if (!ranges.length) return <>{text}</>;
  const out = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) out.push(<span key={`t${i}`}>{text.slice(at, a)}</span>);
    out.push(
      <mark key={`m${i}`} className="rounded bg-amber-300/70 px-0.5 text-foreground dark:bg-amber-400/40">
        {text.slice(a, b)}
      </mark>,
    );
    at = b;
  });
  if (at < text.length) out.push(<span key="end">{text.slice(at)}</span>);
  return <>{out}</>;
}

export const FocusSection = memo(function FocusSection({ lesson, onPlayLine }: { lesson: VideoLesson; onPlayLine: (i: number) => void }) {
  const f = lesson.focus;
  if (!f) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Cách nói</h2>
      <div className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
        <div className="text-base font-semibold">{f.title}</div>
        <div className="inline-block rounded-xl bg-muted px-3 py-1.5 text-[0.95rem] font-medium">{f.pattern}</div>
        <p className="text-sm text-muted-foreground">{f.explain}</p>
        <div className="space-y-1.5">
          {f.lines.map((i) => {
            const l = lesson.lines[i];
            if (!l) return null;
            const who = (Array.isArray(l.speaker) ? l.speaker : [l.speaker]).map((s) => lesson.cast[s]?.name.en).join(" & ");
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPlayLine(i)}
                className="flex w-full items-start gap-2.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <Play className="mt-1.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-muted-foreground">{who}</span>
                  <span className="block text-[1.05rem] leading-relaxed">
                    <Marked text={l.en} keys={f.keys} />
                  </span>
                  <span className="block text-sm text-muted-foreground">{l.vi}</span>
                </span>
              </button>
            );
          })}
        </div>
        {f.note && <p className="rounded-2xl bg-muted/50 px-3 py-2 text-sm">{f.note}</p>}
      </div>
    </section>
  );
});
