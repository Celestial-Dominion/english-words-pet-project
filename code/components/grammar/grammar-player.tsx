"use client";

// Trang một bài Ngữ pháp: video giảng giải tương tác (bảng + cô giáo + hội thoại) đồng bộ MỘT audio; transcript = nội
// dung bài theo phần; luyện tập; liên kết (tiên quyết · dễ nhầm · câu trong Thư viện có mẫu này · từ trong bài).
// Đồng hồ / tua / lặp / tốc độ / phím tắt dùng chung với Video (use-lesson-audio). JSON bài tải theo ?v= (cache
// immutable), audio chỉ tải khi bấm phát (preload="none").
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpenText, ChevronRight, Clapperboard, Library, Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { audioUrlOf, cueAt, grammarDue, holdSet, isDue, isLearned, isManual, lessonHref, lessonJsonUrl, regLabels, type CorpusLink, type GrammarLesson, type LessonRef, type LessonWord } from "@/lib/grammar";
import { grammarRow, setGrammarLearned } from "@/lib/grammar-progress";
import { contentAccent, contentLevel } from "@/lib/levels";
import { lookupWord, loadExamplesForWords, type ExampleSentence } from "@/lib/data";
import { refHref } from "@/lib/library";
import { audioName } from "@/lib/slug";
import { playAudio } from "@/lib/tts";
import type { Word } from "@/lib/types";
import { fmtTime } from "@/lib/video";
import { LayerBar, noLayers, useLayers } from "@/components/video/transcript";
import { useLessonAudio, type Gate } from "@/components/video/use-lesson-audio";
import { GrammarStage, type StageHandle } from "./stage";
import { GrammarTranscript } from "./transcript";
import { Practice } from "./practice";
import { preloadDialogue } from "./dialogue-scene";
import { DoneButton } from "@/components/done-toggle";

const WordDetail = dynamic(() => import("@/components/word-detail"), { ssr: false });
const LAYERS_KEY = "en.grammarLayers";
const RATE_KEY = "en.grammarRate";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const cache = new Map<string, Promise<GrammarLesson>>();
function fetchLesson(id: string, v: string): Promise<GrammarLesson> {
  const url = `${BASE}${lessonJsonUrl(id, v)}`;
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<GrammarLesson>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export interface PlayerLinks {
  next?: LessonRef;
  pre: LessonRef[];
  vs: LessonRef[];
  rel: LessonRef[];
  corpus: CorpusLink[];
}

export function GrammarPlayer({ id, v, links }: { id: string; v: string; links: PlayerLinks }) {
  const [lesson, setLesson] = useState<GrammarLesson | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchLesson(id, v)
      .then((l) => {
        if (!alive) return;
        preloadDialogue(l); // tải trước bối cảnh / nhân vật của phần hội thoại
        setLesson(l);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id, v]);
  if (error)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Không tải được bài ngữ pháp.</p>
        <Link href="/ngu-phap" className="text-sm text-primary hover:underline">
          ← Ngữ pháp
        </Link>
      </div>
    );
  if (!lesson) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  return <Player lesson={lesson} links={links} />;
}

function RefLink({ r }: { r: LessonRef }) {
  return (
    <Link href={lessonHref(r)} prefetch={false} className="flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors hover:bg-muted/60">
      <span className="min-w-0">
        <span className="block truncate font-medium">{r.t}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {contentLevel(r.lv)?.cefr} · {r.en}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Player({ lesson, links }: { lesson: GrammarLesson; links: PlayerLinks }) {
  const beats = lesson.beats;
  const duration = lesson.audio.duration;
  const stage = useRef<StageHandle>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const holds = useMemo(() => holdSet(beats), [beats]);
  const [cue, setCue] = useState(-1);
  const cueRef = useRef(-1);
  const idxNow = useRef(-1);
  const [popup, setPopup] = useState<{ word: Word; examples: ExampleSentence[] } | null>(null);
  // tóm tắt dài (B2–C2 hay tới 5–15 dòng trên điện thoại) → gập còn 3 dòng, bấm để xem hết
  const [sumOpen, setSumOpen] = useState(false);
  const longSum = lesson.sum.length > 220;
  const onFrame = useCallback(
    (t: number) => {
      stage.current?.update(t);
      const c = cueAt(beats[idxNow.current], t);
      if (c !== cueRef.current) {
        cueRef.current = c;
        setCue(c);
      }
    },
    [beats],
  );
  // "Thử nhớ lại": phát xong câu hỏi thì dừng, chờ người học bấm xem đáp án.
  const gate = useCallback(
    (i: number, t: number): Gate | null => (i >= 0 && holds.has(i) && t >= beats[i].end + 0.12 ? { key: `hold:${i}`, line: i, kind: "hold", ms: null } : null),
    [holds, beats],
  );
  const { idx, hi, playing, everPlayed, ended, loop, held, rate, getTime, toggle, prev, next, seekLine, playOnce, toggleLoop, cycleRate, resume, pause, audioProps, rangeProps } = useLessonAudio({
    lines: beats,
    onFrame,
    gate,
    rateKey: RATE_KEY,
    audioRef: audio,
    rangeRef: range,
    clockRef: clock,
  });
  useEffect(() => {
    idxNow.current = idx;
  }, [idx]);
  const { layers, flip, blind, toggleBlind } = useLayers(LAYERS_KEY);
  const row = useLiveQuery(() => grammarRow(lesson.id), [lesson.id]);
  const learned = isLearned(row);
  const now = useMemo(() => new Date(), []);
  const due = isDue(row, now);
  const dueAt = grammarDue(row);
  const accent = contentAccent(lesson.lv);
  const level = contentLevel(lesson.lv);
  const regs = regLabels(lesson.reg);

  const topInset = useCallback(() => {
    const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 64;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    return header + (wide ? 0 : (sticky.current?.offsetHeight ?? 0));
  }, []);

  const openWord = useCallback(
    async (w: LessonWord) => {
      pause();
      const word = await lookupWord(w.id);
      if (!word) return;
      const ex = await loadExamplesForWords(word.level, [word.id]);
      setPopup({ word, examples: ex[word.id] ?? [] });
    },
    [pause],
  );

  const iconBtn = "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:scale-95";

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded-md px-1.5 py-0.5 font-semibold ${accent.badge}`}>{level?.cefr}</span>
            <span>Bài {lesson.n}</span>
            <span className="tabular-nums">· {fmtTime(duration)}</span>
            {regs.map((r) => (
              <span key={r} className="rounded-full border px-2 py-0.5 font-medium">
                {r}
              </span>
            ))}
            {lesson.kind === "contrast" && <span className="rounded-full border px-2 py-0.5 font-medium">Đối chiếu</span>}
          </div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{lesson.t}</h1>
          <p className="mt-0.5 text-lg font-medium text-muted-foreground">{lesson.en}</p>
          <p className={`mt-1 text-sm text-muted-foreground ${longSum && !sumOpen ? "line-clamp-3" : ""}`}>{lesson.sum}</p>
          {longSum && (
            <button type="button" onClick={() => setSumOpen((o) => !o)} className="mt-0.5 text-xs font-medium text-primary hover:underline">
              {sumOpen ? "Thu gọn" : "Xem thêm"}
            </button>
          )}
        </div>
        <Link href={`/ngu-phap/${lesson.lv}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← {level?.cefr}
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DoneButton
          kind="learn"
          done={learned}
          // ghi hỏng (riêng tư / hết quota) đã nổi banner StorageAlert ở lib/db.ts
          onToggle={() => void setGrammarLearned(lesson.id, !learned).catch(() => {})}
          hint="không cần luyện tập, không xếp lịch ôn"
        />
        {learned && isManual(row) && <span className="text-xs text-muted-foreground">Tích tay · không xếp lịch ôn</span>}
        {learned && dueAt && (
          <span className={`text-xs ${due ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
            {due ? "Đến hạn ôn — làm lại phần luyện tập" : `Ôn lại: ${dueAt.toLocaleDateString("vi-VN")}`}
          </span>
        )}
        {row?.best ? <span className="text-xs text-muted-foreground">Điểm cao nhất {row.best}%</span> : null}
      </div>

      <audio ref={audio} {...audioProps} src={audioUrlOf(lesson)} preload="none" />

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-x-6">
        <div className="lg:contents">
          <div
            ref={sticky}
            className="sticky z-20 -mx-4 bg-background/95 px-4 pt-1 pb-2 backdrop-blur lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:self-start lg:px-0 lg:pt-0"
            style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
          >
            <div
              className="relative mx-auto aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border bg-[#E6DDCB] shadow-sm select-none"
              style={{ maxWidth: "calc(48vh * 16 / 9)" }}
              onClick={toggle}
            >
              <GrammarStage ref={stage} lesson={lesson} idx={idx} hi={hi} cue={cue} layers={layers} held={held?.kind === "hold"} onReveal={resume} getTime={getTime} />
              {ended ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/95 px-5 py-3 text-base font-semibold shadow-lg">
                    <RotateCcw className="size-5" /> Xem lại
                  </span>
                </div>
              ) : !everPlayed ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <span className="flex size-16 items-center justify-center rounded-full bg-background/90 text-primary shadow-lg">
                    <Play className="ml-1 size-8" fill="currentColor" />
                  </span>
                </div>
              ) : (
                !playing &&
                !held && (
                  <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow">
                    <Play className="size-3.5" fill="currentColor" /> Tạm dừng
                  </span>
                )
              )}
            </div>

            <input ref={range} {...rangeProps} type="range" min={0} max={duration} step={0.05} defaultValue={0} aria-label="Vị trí phát" className="mt-2 block h-1.5 w-full cursor-pointer accent-primary" />

            <div className="mt-1.5 flex items-center gap-1">
              <button type="button" onClick={prev} aria-label="Đoạn trước" title="Đoạn trước (←)" className={iconBtn}>
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
              <button type="button" onClick={next} aria-label="Đoạn sau" title="Đoạn sau (→)" className={iconBtn}>
                <SkipForward className="size-5" />
              </button>
              <span className="ml-1 hidden text-xs whitespace-nowrap text-muted-foreground tabular-nums min-[360px]:inline">
                <span ref={clock}>0:00</span>
                <span className="hidden min-[400px]:inline"> / {fmtTime(duration)}</span>
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleLoop}
                  aria-pressed={loop}
                  title="Lặp lại đoạn đang nghe"
                  aria-label="Lặp đoạn"
                  className={`inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${loop ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Repeat className="size-4" />
                  <span className="hidden sm:inline">Lặp đoạn</span>
                </button>
                <button
                  type="button"
                  onClick={cycleRate}
                  title="Tốc độ"
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
            {noLayers(layers) && (
              <p className="mb-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Đang ẩn câu tiếng Anh để luyện nghe — lời giảng vẫn hiện; bật lại lớp chữ ở trên khi cần.</p>
            )}
            <GrammarTranscript lesson={lesson} idx={idx} hi={hi} layers={layers} onSeek={seekLine} topInset={topInset} />
          </div>
        </div>

        <div className="mt-8 space-y-8 lg:col-start-2 lg:row-start-2">
          <Practice lesson={lesson} onListen={playOnce} />

          {lesson.words?.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Từ trong bài</h2>
              <div className="flex flex-wrap gap-2">
                {lesson.words.map((w) => (
                  <span key={w.id} className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3">
                    <button type="button" onClick={() => void openWord(w)} className="text-left">
                      <span className="font-semibold">{w.id}</span>
                      <span className="ml-1.5 text-sm text-muted-foreground">{w.vi}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pause();
                        playAudio(`${BASE}/audio/words/${audioName(w.id)}.mp3`);
                      }}
                      aria-label={`Phát âm ${w.id}`}
                      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Bấm một từ để xem nghĩa, ví dụ và thêm vào lịch ôn.</p>
            </section>
          ) : null}

          {(links.pre.length > 0 || links.vs.length > 0 || links.rel.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Liên quan</h2>
              {links.pre.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Nên học trước</div>
                  {links.pre.map((r) => (
                    <RefLink key={r.id} r={r} />
                  ))}
                </div>
              )}
              {links.vs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Dễ nhầm với</div>
                  {links.vs.map((r) => (
                    <RefLink key={r.id} r={r} />
                  ))}
                </div>
              )}
              {links.rel.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Liên quan</div>
                  {links.rel.map((r) => (
                    <RefLink key={r.id} r={r} />
                  ))}
                </div>
              )}
            </section>
          )}

          {links.corpus.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Gặp mẫu này trong Thư viện</h2>
              {links.corpus.map((c, k) => (
                <Link key={k} href={refHref({ kind: c.type, id: c.id, level: c.level })} prefetch={false} className="flex items-start gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors hover:bg-muted/60">
                  {c.type === "reading" ? <BookOpenText className="mt-1 size-5 shrink-0 text-sky-500" /> : c.type === "story" ? <Library className="mt-1 size-5 shrink-0 text-violet-500" /> : <Clapperboard className="mt-1 size-5 shrink-0 text-rose-500" />}
                  <span className="min-w-0">
                    <span className="block text-[1.05rem] leading-snug">{c.en}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {c.type === "reading" ? "Bài đọc" : c.type === "story" ? "Truyện" : "Video"} {contentLevel(c.level)?.cefr} · {c.title}
                    </span>
                  </span>
                </Link>
              ))}
            </section>
          )}

          {links.next && (
            <Link
              href={lessonHref(links.next)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.99]"
            >
              <span className="min-w-0 truncate">Bài tiếp → {links.next.t}</span>
              <span className="max-w-[40%] shrink-0 truncate text-sm font-normal opacity-80">{links.next.en}</span>
            </Link>
          )}
        </div>
      </div>

      {popup && <WordDetail word={popup.word} examples={popup.examples} onClose={() => setPopup(null)} />}
    </div>
  );
}
