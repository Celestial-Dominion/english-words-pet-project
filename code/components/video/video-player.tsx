"use client";

// Player bài Video (docs/ENGLISH_VIDEO_PLAYBOOK.md): một <audio> là đồng hồ duy nhất; vòng
// requestAnimationFrame đọc currentTime → câu đang nói, từ đang đọc, tư thế cảnh.
// Luyện nói: "Nói theo" dừng sau mỗi câu cho người học nhại lại; "Nhập vai" dừng TRƯỚC lượt của vai
// người học chọn (hiện nghĩa tiếng Việt làm gợi ý), hết giờ mới phát câu mẫu để so.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, EyeOff, Mic, Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, Users } from "lucide-react";
import { loadVideo } from "@/lib/library";
import { contentAccent, contentLevel } from "@/lib/levels";
import { stopAudio } from "@/lib/tts";
import { isRead, markRead } from "@/lib/db";
import { lookupWord, loadExamplesForWords, type ExampleSentence } from "@/lib/data";
import type { Word } from "@/lib/types";
import { audioUrl, fmtTime, lineIndexAt, speakersOf, wordAt, type VideoLesson, type VideoName, type VideoWord } from "@/lib/video";
import { preloadScene } from "./assets";
import { Scene, type SceneHandle } from "./scene";
import { noLayers, Transcript, type Layers } from "./transcript";
import { FocusSection, WordsSection } from "./lesson-extras";
import { lookOf } from "./rig";

const WordDetail = dynamic(() => import("@/components/word-detail"), { ssr: false });

const SPEEDS = [1, 0.75, 1.25];
const LAYERS_KEY = "en.videoLayers";
const RATE_KEY = "en.videoRate";
const DEFAULT_LAYERS: Layers = { en: true, ipa: false, vi: true };

function readJson<T>(key: string, ok: (v: unknown) => boolean): T | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return ok(v) ? (v as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* không lưu được thì thôi — phiên này vẫn đổi được */
  }
}

export interface NextLesson {
  id: string;
  level: string;
  title: VideoName;
}

export function VideoPlayer({ id, next }: { id: string; next?: NextLesson }) {
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
  return <Player lesson={lesson} nextLesson={next} />;
}

type Practice = "off" | "shadow" | "role";
interface Hold {
  line: number; // câu vừa nói xong (nói theo) / sắp tới lượt (nhập vai)
  kind: "shadow" | "role";
  ms: number;
  at: number; // performance.now() lúc bắt đầu chờ
}

function Player({ lesson, nextLesson }: { lesson: VideoLesson; nextLesson?: NextLesson }) {
  const lines = lesson.lines;
  const duration = lesson.audio.duration;
  const audio = useRef<HTMLAudioElement>(null);
  const scene = useRef<SceneHandle>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const idxRef = useRef(-1);
  const hiRef = useRef(-1);
  const loopRef = useRef<number | null>(null);
  const stopAt = useRef<number | null>(null);
  const beforeBlind = useRef<Layers | null>(null);
  const dragging = useRef(false);
  const practiceRef = useRef<Practice>("off");
  const roleRef = useRef<string | null>(null);
  const doneRef = useRef<Set<number>>(new Set()); // câu đã được dừng chờ trong lượt phát này
  const holdTimer = useRef<number | null>(null);
  const [idx, setIdx] = useState(-1);
  const [hi, setHi] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [everPlayed, setEverPlayed] = useState(false);
  const [ended, setEnded] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [layers, setLayersState] = useState<Layers>(DEFAULT_LAYERS);
  const [practice, setPractice] = useState<Practice>("off");
  const [role, setRole] = useState<string | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [hint, setHint] = useState(false);
  const [watched, setWatched] = useState(false);
  const [popup, setPopup] = useState<{ word: Word; examples: ExampleSentence[] } | null>(null);
  const level = contentLevel(lesson.level);
  const accent = contentAccent(lesson.level);
  const castIds = useMemo(() => Object.keys(lesson.cast), [lesson]);

  // Tuỳ chọn đã lưu (sau mount — tránh lệch SSR).
  useEffect(() => {
    const l = readJson<Layers>(LAYERS_KEY, (v) => !!v && typeof (v as Layers).en === "boolean");
    const r = readJson<number>(RATE_KEY, (v) => SPEEDS.includes(v as number));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc localStorage một lần sau mount
    if (l) setLayersState(l);
    if (r) setRate(r);
    void isRead(lesson.id).then(setWatched);
  }, [lesson.id]);

  const getTime = useCallback(() => audio.current?.currentTime ?? 0, []);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHold(null);
    setHint(false);
  }, []);

  const startHold = useCallback((h: Omit<Hold, "at">) => {
    const el = audio.current;
    if (!el) return;
    el.pause();
    doneRef.current.add(h.line * 2 + (h.kind === "role" ? 1 : 0));
    setHold({ ...h, at: performance.now() });
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      setHold(null);
      setHint(false);
      void el.play().catch(() => {});
    }, h.ms);
  }, []);

  // Đồng bộ MỌI thứ theo currentTime (mỗi khung khi phát, và sau tua/dừng).
  const sync = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    const t = el.currentTime;
    if (stopAt.current !== null && !el.paused && t >= stopAt.current) {
      stopAt.current = null;
      el.pause();
    }
    const L = loopRef.current;
    if (L !== null && !el.paused && (t >= lines[L].end + 0.35 || lineIndexAt(lines, t) > L)) {
      el.currentTime = Math.max(0, lines[L].start - 0.08);
      return;
    }
    const i = lineIndexAt(lines, t);
    // Luyện nói: dừng chờ người học.
    if (!el.paused && stopAt.current === null && L === null) {
      const mode = practiceRef.current;
      if (mode === "shadow" && i >= 0 && t >= lines[i].end + 0.04 && !doneRef.current.has(i * 2)) {
        const d = lines[i].end - lines[i].start;
        startHold({ line: i, kind: "shadow", ms: Math.round((d * 1.15 + 0.8) * 1000) });
        return;
      }
      if (mode === "role" && roleRef.current) {
        const k = i + 1;
        const nxt = lines[k];
        if (nxt && speakersOf(nxt).includes(roleRef.current) && t >= nxt.start - 0.12 && !doneRef.current.has(k * 2 + 1)) {
          const d = nxt.end - nxt.start;
          startHold({ line: k, kind: "role", ms: Math.round((d * 1.6 + 1.6) * 1000) });
          return;
        }
      }
    }
    if (i !== idxRef.current) {
      idxRef.current = i;
      setIdx(i);
    }
    const c = i >= 0 ? wordAt(lines[i], t) : -1;
    if (c !== hiRef.current) {
      hiRef.current = c;
      setHi(c);
    }
    scene.current?.update(t);
    if (range.current && !dragging.current) range.current.value = String(t);
    if (clock.current) clock.current.textContent = fmtTime(t);
  }, [lines, startHold]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      sync();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sync]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => () => clearHold(), [clearHold]);

  const play = useCallback(() => {
    void audio.current?.play().catch(() => {});
  }, []);

  const seekLine = useCallback(
    (i: number, once = false) => {
      const el = audio.current;
      if (!el) return;
      clearHold();
      const k = Math.max(0, Math.min(lines.length - 1, i));
      stopAt.current = once ? lines[k].end + 0.25 : null;
      // tua tới câu k: các điểm dừng từ câu k trở đi được "làm lại"
      for (const x of [...doneRef.current]) if (x >= k * 2 - 1) doneRef.current.delete(x);
      if (practiceRef.current === "role" && roleRef.current && speakersOf(lines[k]).includes(roleRef.current)) doneRef.current.add(k * 2 + 1);
      el.currentTime = Math.max(0, lines[k].start - 0.08);
      if (loopRef.current !== null) loopRef.current = k;
      setEnded(false);
      play();
      sync();
    },
    [lines, play, sync, clearHold],
  );
  const playOnce = useCallback((i: number) => seekLine(i, true), [seekLine]);

  const toggle = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    stopAt.current = null;
    if (hold) {
      // đang chờ người học nói → bỏ chờ, phát tiếp ngay
      clearHold();
      play();
      return;
    }
    if (el.paused) {
      if (el.ended) {
        el.currentTime = 0;
        doneRef.current.clear();
      }
      play();
    } else el.pause();
  }, [play, hold, clearHold]);

  const prev = useCallback(() => {
    const el = audio.current;
    const i = idxRef.current;
    if (!el || i < 0) return seekLine(0);
    seekLine(el.currentTime - lines[i].start > 1.2 ? i : i - 1);
  }, [lines, seekLine]);
  const next = useCallback(() => seekLine(idxRef.current + 1), [seekLine]);

  // Phím tắt: Space = phát/dừng, ←/→ = câu trước/sau, R = nghe lại câu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (el?.closest?.("[role=dialog]")) return;
      if (e.key === " " && el?.closest?.("button, a, [role=button]")) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "r") seekLine(Math.max(0, idxRef.current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, prev, next, seekLine]);

  useEffect(() => {
    const el = audio.current;
    return () => el?.pause();
  }, []);

  const cycleRate = () => {
    const n = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length] ?? 1;
    writeJson(RATE_KEY, n);
    setRate(n);
  };
  const toggleLoop = () => {
    const on = !loop;
    setLoop(on);
    loopRef.current = on ? Math.max(0, idxRef.current) : null;
  };
  const setLayers = (l: Layers) => {
    writeJson(LAYERS_KEY, l);
    setLayersState(l);
  };
  const flip = (k: keyof Layers) => setLayers({ ...layers, [k]: !layers[k] });
  const blind = noLayers(layers);
  const toggleBlind = () => {
    if (blind) setLayers(beforeBlind.current ?? DEFAULT_LAYERS);
    else {
      beforeBlind.current = layers;
      setLayers({ en: false, ipa: false, vi: false });
    }
  };
  const choosePractice = (p: Practice, r: string | null = null) => {
    clearHold();
    doneRef.current.clear();
    practiceRef.current = p;
    roleRef.current = r;
    setPractice(p);
    setRole(r);
    if (p !== "off" && loop) {
      setLoop(false);
      loopRef.current = null;
    }
  };

  const openWord = useCallback(async (w: VideoWord) => {
    audio.current?.pause();
    const word = w.id ? await lookupWord(w.id) : null;
    if (!word) return;
    const ex = await loadExamplesForWords(word.level, [word.id]);
    setPopup({ word, examples: ex[word.id] ?? [] });
  }, []);
  const pauseAudio = useCallback(() => audio.current?.pause(), []);

  const topInset = useCallback(() => {
    const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 64;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    return header + (wide ? 0 : (sticky.current?.offsetHeight ?? 0));
  }, []);

  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`;
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

      <audio
        ref={audio}
        src={audioUrl(lesson)}
        preload="metadata"
        onPlay={() => {
          stopAudio();
          setPlaying(true);
          setEverPlayed(true);
          setEnded(false);
        }}
        onPause={() => {
          setPlaying(false);
          sync();
        }}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          doneRef.current.clear();
          sync();
          if (!watched) void markRead(lesson.id).then(() => setWatched(true));
        }}
        onSeeked={sync}
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = rate;
        }}
      />

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
              onPointerDown={() => (dragging.current = true)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
              onInput={(e) => {
                const el = audio.current;
                if (!el) return;
                clearHold();
                el.currentTime = Number(e.currentTarget.value);
                if (loopRef.current !== null) loopRef.current = Math.max(0, lineIndexAt(lines, el.currentTime));
                setEnded(false);
                sync();
              }}
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

            <div className="mt-1.5 flex items-center gap-1.5">
              <div role="group" aria-label="Lớp transcript" className="inline-flex shrink-0 items-center rounded-full bg-muted p-0.5">
                <button type="button" aria-pressed={layers.en} onClick={() => flip("en")} className={chip(layers.en)}>
                  English
                </button>
                <button type="button" aria-pressed={layers.ipa} onClick={() => flip("ipa")} className={chip(layers.ipa)}>
                  IPA
                </button>
                <button type="button" aria-pressed={layers.vi} onClick={() => flip("vi")} className={chip(layers.vi)}>
                  Việt
                </button>
              </div>
              <button
                type="button"
                onClick={toggleBlind}
                aria-pressed={blind}
                title="Ẩn toàn bộ chữ để luyện nghe"
                aria-label="Luyện nghe"
                className={`ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap transition-colors ${blind ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                <EyeOff className="size-4" /> <span className="hidden min-[360px]:inline">Luyện nghe</span>
              </button>
            </div>
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
          <FocusSection lesson={lesson} onPlayLine={playOnce} />
          <WordsSection lesson={lesson} onOpen={openWord} onPlayLine={playOnce} onBeforeSpeak={pauseAudio} />
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
