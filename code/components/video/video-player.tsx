"use client";

// Player bài Video (docs/ENGLISH_VIDEO_PLAYBOOK.md): một <audio> là đồng hồ duy nhất; vòng
// requestAnimationFrame đọc currentTime → câu đang nói, từ đang đọc, tư thế cảnh.
// Luyện nói: "Nói theo" dừng sau mỗi câu cho người học nhại lại; "Nhập vai" dừng TRƯỚC lượt của vai
// người học chọn (hiện nghĩa tiếng Việt làm gợi ý), hết giờ mới phát câu mẫu để so.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Mic, Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, Users } from "lucide-react";
import { loadVideo } from "@/lib/library";
import { contentAccent, contentLevel } from "@/lib/levels";
import { isRead, markRead } from "@/lib/db";
import { lookupWord, loadExamplesForWords, type ExampleSentence } from "@/lib/data";
import type { Word } from "@/lib/types";
import type { LessonRef } from "@/lib/grammar";
import { audioUrl, fmtTime, speakersOf, type VideoLesson, type VideoName, type VideoWord } from "@/lib/video";
import { preloadScene } from "./assets";
import { Scene, type SceneHandle } from "./scene";
import { LayerBar, Transcript, useLayers } from "./transcript";
import { FocusSection, WordsSection } from "./lesson-extras";
import { lookOf } from "./rig";
import { useLessonAudio, type Gate, type Held } from "./use-lesson-audio";

const WordDetail = dynamic(() => import("@/components/word-detail"), { ssr: false });

const LAYERS_KEY = "en.videoLayers";
const RATE_KEY = "en.videoRate";

export interface NextLesson {
  id: string;
  level: string;
  title: VideoName;
}

export function VideoPlayer({ id, next, grammar }: { id: string; next?: NextLesson; grammar?: LessonRef[] }) {
  const [lesson, setLesson] = useState<VideoLesson | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadVideo(id)
      .then((l) => {
        if (!alive) return;
        void preloadScene(l).catch(() => {});
        setLesson(l);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id]);
  if (error)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Không tải được bài video.</p>
        <Link href="/video" className="text-sm text-primary hover:underline">
          ← Danh sách video
        </Link>
      </div>
    );
  if (!lesson) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  return <Player lesson={lesson} nextLesson={next} grammar={grammar} />;
}

type Practice = "off" | "shadow" | "role";
// Điểm dừng luyện nói: câu vừa nói xong (nói theo) / lượt sắp tới của vai người học (nhập vai).
type Hold = Held & { kind: "shadow" | "role"; ms: number };

function Player({ lesson, nextLesson, grammar }: { lesson: VideoLesson; nextLesson?: NextLesson; grammar?: LessonRef[] }) {
  const lines = lesson.lines;
  const duration = lesson.audio.duration;
  const audio = useRef<HTMLAudioElement>(null);
  const scene = useRef<SceneHandle>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const practiceRef = useRef<Practice>("off");
  const roleRef = useRef<string | null>(null);
  const [practice, setPractice] = useState<Practice>("off");
  const [role, setRole] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [watched, setWatched] = useState(false);
  const [popup, setPopup] = useState<{ word: Word; examples: ExampleSentence[] } | null>(null);
  const level = contentLevel(lesson.level);
  const accent = contentAccent(lesson.level);
  const castIds = useMemo(() => Object.keys(lesson.cast), [lesson]);
  const { layers, flip, blind, toggleBlind } = useLayers(LAYERS_KEY);

  useEffect(() => {
    void isRead(lesson.id).then(setWatched);
  }, [lesson.id]);

  const onFrame = useCallback((t: number) => scene.current?.update(t), []);
  // Luyện nói: "Nói theo" dừng sau mỗi câu; "Nhập vai" dừng TRƯỚC lượt của vai người học chọn.
  const gate = useCallback(
    (i: number, t: number): Gate | null => {
      const mode = practiceRef.current;
      if (mode === "shadow" && i >= 0 && t >= lines[i].end + 0.04) {
        const d = lines[i].end - lines[i].start;
        return { key: `s:${i}`, line: i, kind: "shadow", ms: Math.round((d * 1.15 + 0.8) * 1000) };
      }
      if (mode === "role" && roleRef.current) {
        const k = i + 1;
        const nxt = lines[k];
        if (nxt && speakersOf(nxt).includes(roleRef.current) && t >= nxt.start - 0.12) {
          const d = nxt.end - nxt.start;
          return { key: `r:${k}`, line: k, kind: "role", ms: Math.round((d * 1.6 + 1.6) * 1000) };
        }
      }
      return null;
    },
    [lines],
  );
  // Bấm thẳng vào lượt của vai mình → phát luôn câu mẫu (không dừng chờ).
  const seekGates = useCallback(
    (k: number) => (practiceRef.current === "role" && roleRef.current && lines[k] && speakersOf(lines[k]).includes(roleRef.current) ? [`r:${k}`] : []),
    [lines],
  );
  const onEnded = useCallback(() => {
    if (!watched) void markRead(lesson.id).then(() => setWatched(true));
  }, [watched, lesson.id]);
  const { idx, hi, playing, everPlayed, ended, loop, held, rate, getTime, toggle, prev, next, seekLine, playOnce, toggleLoop, setLooping, resetGates, pause, cycleRate, audioProps, rangeProps } =
    useLessonAudio({ lines, onFrame, gate, seekGates, onEnded, rateKey: RATE_KEY, audioRef: audio, rangeRef: range, clockRef: clock });
  const hold = held && (held.kind === "shadow" || held.kind === "role") ? (held as Hold) : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gợi ý tiếng Anh chỉ sống trong một lần chờ
    if (!hold) setHint(false);
  }, [hold]);

  const choosePractice = (p: Practice, r: string | null = null) => {
    resetGates();
    practiceRef.current = p;
    roleRef.current = r;
    setPractice(p);
    setRole(r);
    if (p !== "off" && loop) setLooping(false);
  };

  const openWord = useCallback(
    async (w: VideoWord) => {
      pause();
      const word = w.id ? await lookupWord(w.id) : null;
      if (!word) return;
      const ex = await loadExamplesForWords(word.level, [word.id]);
      setPopup({ word, examples: ex[word.id] ?? [] });
    },
    [pause],
  );

  const topInset = useCallback(() => {
    const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 64;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    return header + (wide ? 0 : (sticky.current?.offsetHeight ?? 0));
  }, []);

  const iconBtn = "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95";
  const holdLine = hold ? lines[hold.line] : null;

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded-md px-1.5 py-0.5 font-semibold ${accent.badge}`}>{level?.cefr}</span>
            <span className="tabular-nums">
              {fmtTime(duration)} · {lines.length} lượt · {castIds.length} nhân vật
            </span>
            {watched && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> đã xem
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{lesson.title.en}</h1>
          <p className="text-base text-muted-foreground">{lesson.title.vi}</p>
          <p className="mt-1 text-sm text-muted-foreground">{lesson.summary}</p>
        </div>
        <Link href={`/video/${lesson.level}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Video
        </Link>
      </div>

      <audio ref={audio} src={audioUrl(lesson)} preload="metadata" {...audioProps} />

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-x-6">
        <div className="lg:contents">
          <div
            ref={sticky}
            className="sticky z-20 -mx-4 bg-background/95 px-4 pt-1 pb-2 backdrop-blur lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:self-start lg:px-0 lg:pt-0"
            style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
          >
            <div
              className="relative mx-auto aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border bg-[#F2E2CC] shadow-sm select-none"
              style={{ maxWidth: "calc(48vh * 16 / 9)" }}
              onClick={toggle}
            >
              <Scene ref={scene} lesson={lesson} idx={idx} getTime={getTime} />
              {hold && holdLine ? (
                <HoldOverlay hold={hold} lesson={lesson} hint={hint} onHint={() => setHint(true)} />
              ) : ended ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/95 px-5 py-3 text-base font-semibold shadow-lg">
                    <RotateCcw className="size-5" /> Nghe lại
                  </span>
                </div>
              ) : !everPlayed ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <span className="flex size-16 items-center justify-center rounded-full bg-background/90 text-primary shadow-lg">
                    <Play className="ml-1 size-8" fill="currentColor" />
                  </span>
                </div>
              ) : (
                !playing && (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow">
                    <Play className="size-3.5" fill="currentColor" /> Tạm dừng
                  </span>
                )
              )}
            </div>

            <input
              ref={range}
              type="range"
              min={0}
              max={duration}
              step={0.05}
              defaultValue={0}
              aria-label="Vị trí phát"
              {...rangeProps}
              className="mt-2 block h-1.5 w-full cursor-pointer accent-primary"
            />

            <div className="mt-1.5 flex items-center gap-1">
              <button type="button" onClick={prev} aria-label="Câu trước" title="Câu trước (←)" className={iconBtn}>
                <SkipBack className="size-5" />
              </button>
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Tạm dừng" : "Phát"}
                title="Phát / dừng (Space)"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
              >
                {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
              </button>
              <button type="button" onClick={next} aria-label="Câu sau" title="Câu sau (→)" className={iconBtn}>
                <SkipForward className="size-5" />
              </button>
              {/* < 360px (điện thoại 320px) hàng nút không đủ chỗ → ẩn đồng hồ, thanh tua vẫn cho biết vị trí */}
              <span className="ml-1 hidden text-xs whitespace-nowrap text-muted-foreground tabular-nums min-[360px]:inline">
                <span ref={clock}>0:00</span>
                <span className="hidden min-[400px]:inline"> / {fmtTime(duration)}</span>
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleLoop}
                  aria-pressed={loop}
                  title="Lặp lại câu đang nghe"
                  aria-label="Lặp câu"
                  className={`inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${loop ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Repeat className="size-4" />
                  <span className="hidden sm:inline">Lặp câu</span>
                </button>
                <button
                  type="button"
                  onClick={cycleRate}
                  title="Tốc độ nghe"
                  aria-label={`Tốc độ nghe: ${rate}×`}
                  className={`inline-flex h-9 w-14 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors ${rate !== 1 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {rate}×
                </button>
              </div>
            </div>

            <LayerBar layers={layers} flip={flip} blind={blind} toggleBlind={toggleBlind} />
          </div>

          <div className="mt-3 lg:col-start-2 lg:row-start-1 lg:mt-0">
            <PracticeBar lesson={lesson} practice={practice} role={role} onChange={choosePractice} />
            {blind && (
              <p className="mb-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Đang ẩn chữ để luyện nghe — bấm một câu để nghe lại, bật lại lớp chữ ở trên khi cần.
              </p>
            )}
            <Transcript
              lesson={lesson}
              idx={idx}
              hi={hi}
              layers={layers}
              onSeek={seekLine}
              topInset={topInset}
              role={practice === "role" ? role : null}
              hiddenFrom={practice === "role" ? (hold?.kind === "role" ? hold.line : Math.max(0, idx + 1)) : undefined}
            />
          </div>
        </div>

        <div className="mt-8 space-y-8 lg:col-start-2 lg:row-start-2">
          <FocusSection lesson={lesson} onPlayLine={playOnce} grammar={grammar} />
          <WordsSection lesson={lesson} onOpen={openWord} onPlayLine={playOnce} onBeforeSpeak={pause} />
          {lesson.source && (
            <Link href={`/truyen/${lesson.source.level}/${lesson.source.id}`} className="block rounded-2xl border px-4 py-3 text-sm transition-colors hover:bg-muted/60">
              Tình huống lấy từ truyện <span className="font-semibold">“{lesson.source.title?.en ?? lesson.source.id}”</span> — đọc bản truyện →
            </Link>
          )}
          {nextLesson && (
            <Link
              href={`/video/${nextLesson.level}/${nextLesson.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1 truncate">Bài tiếp → {nextLesson.title.en}</span>
              <span className="min-w-0 max-w-[40%] truncate text-sm font-normal opacity-80">{nextLesson.title.vi}</span>
            </Link>
          )}
        </div>
      </div>

      {popup && <WordDetail word={popup.word} examples={popup.examples} onClose={() => setPopup(null)} />}
    </div>
  );
}

// Thanh chọn chế độ luyện nói (dưới cảnh, trên transcript).
function PracticeBar({
  lesson,
  practice,
  role,
  onChange,
}: {
  lesson: VideoLesson;
  practice: Practice;
  role: string | null;
  onChange: (p: Practice, role?: string | null) => void;
}) {
  const ids = Object.keys(lesson.cast);
  const btn = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
      on ? "border-primary/50 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
    }`;
  return (
    <div className="mb-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Luyện nói:</span>
        <button type="button" aria-pressed={practice === "shadow"} onClick={() => onChange(practice === "shadow" ? "off" : "shadow")} className={btn(practice === "shadow")}>
          <Mic className="size-3.5" /> Nói theo
        </button>
        <button type="button" aria-pressed={practice === "role"} onClick={() => onChange(practice === "role" ? "off" : "role", role ?? ids[0])} className={btn(practice === "role")}>
          <Users className="size-3.5" /> Nhập vai
        </button>
      </div>
      {practice === "role" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Bạn đóng vai</span>
          {ids.map((id) => {
            const c = lesson.cast[id];
            const on = role === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange("role", id)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors ${on ? "text-white shadow-sm" : "bg-muted text-foreground"}`}
                style={on ? { background: lookOf(c).accent } : undefined}
              >
                {c.name.en}
              </button>
            );
          })}
        </div>
      )}
      {practice === "shadow" && <p className="text-xs text-muted-foreground">Sau mỗi câu, video dừng một nhịp để bạn nói lại theo đúng ngữ điệu.</p>}
      {practice === "role" && <p className="text-xs text-muted-foreground">Tới lượt vai của bạn, video dừng: nói câu đó bằng tiếng Anh (gợi ý nghĩa tiếng Việt), rồi nghe câu mẫu.</p>}
    </div>
  );
}

// Lớp phủ trên cảnh khi chờ người học nói: gợi ý + thanh thời gian.
function HoldOverlay({ hold, lesson, hint, onHint }: { hold: Hold; lesson: VideoLesson; hint: boolean; onHint: () => void }) {
  const l = lesson.lines[hold.line];
  const who = speakersOf(l)
    .map((s) => lesson.cast[s]?.name.en)
    .join(" & ");
  return (
    <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-background/95 px-3 py-2 text-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <Mic className="size-4 shrink-0 text-primary" />
        <span className="font-semibold">{hold.kind === "role" ? `Lượt của bạn — ${who}` : "Nói lại câu vừa nghe"}</span>
      </div>
      {hold.kind === "role" && (
        <div className="mt-1 text-[0.95rem]">
          {hint ? (
            <span className="font-medium">{l.en}</span>
          ) : (
            <>
              <span className="text-muted-foreground">{l.vi}</span>{" "}
              <button type="button" onClick={onHint} className="ml-1 text-xs font-medium text-primary hover:underline">
                Gợi ý tiếng Anh
              </button>
            </>
          )}
        </div>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div key={hold.at} className="h-full rounded-full bg-primary" style={{ animation: `hold-bar ${hold.ms}ms linear forwards` }} />
      </div>
      <style>{`@keyframes hold-bar { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
