"use client";

// Trang một truyện nhiều chương: nhớ chương đang đọc (đồng bộ qua progress-local), audio từng chương,
// đọc tới cuối CHƯƠNG CUỐI mới tính đã đọc; nút "Chưa đọc ⇄ Đã đọc" trên thanh công cụ đánh dấu tay bất cứ lúc nào
// (bấm tay thì lần mở này thôi tự đánh dấu). Truyện có Video hội thoại tương ứng → thẻ dẫn sang Video.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clapperboard, Layers3, Library } from "lucide-react";
import { TOPICS, fmtMinutes, loadStory, type StoryDoc } from "@/lib/library";
import { contentAccent, contentLevel } from "@/lib/levels";
import { setRead } from "@/lib/read-progress";
import { getStoryChapter, setStoryChapter } from "@/lib/progress-local";
import { cn } from "@/lib/utils";
import { DoneButton, useIsRead } from "@/components/done-toggle";
import { usePassageAudio } from "./passage-audio";
import { FocusWords, PassageText, PassageToolbar, useWordLookup } from "./passage-view";
import { Quiz } from "./quiz";
import { SourceNote } from "./source-note";
import { GrammarLinks } from "@/components/video/lesson-extras";
import type { LessonRef } from "@/lib/grammar";

export function StoryReader({ id, grammar }: { id: string; grammar?: LessonRef[] }) {
  const [doc, setDoc] = useState<StoryDoc | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadStory(id)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id]);
  if (error) return <p className="text-sm text-destructive">Không tải được truyện. Kiểm tra kết nối rồi tải lại trang.</p>;
  if (!doc) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  return <Reader key={doc.id} doc={doc} grammar={grammar} />;
}

function Reader({ doc, grammar }: { doc: StoryDoc; grammar?: LessonRef[] }) {
  const [ch, setCh] = useState(0);
  const [showVi, setShowVi] = useState(false);
  const read = useIsRead(doc.id); // undefined = đang đọc IndexedDB
  const manual = useRef(false); // đã bấm tay ở lần mở này → không tự đánh dấu nữa
  const endRef = useRef<HTMLDivElement>(null);
  const chapter = doc.chapters[ch];
  const player = usePassageAudio(chapter.audio, `ss-${ch}-`);
  const lookup = useWordLookup();
  const level = contentLevel(doc.level);
  const accent = contentAccent(doc.level);
  const last = ch === doc.chapters.length - 1;

  useEffect(() => {
    const saved = Math.min(doc.chapters.length - 1, Math.max(0, getStoryChapter(doc.id)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- khôi phục chương đã đọc (localStorage) sau mount
    setCh(saved);
  }, [doc]);
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [ch]);
  useEffect(() => {
    const el = endRef.current;
    if (!el || read !== false || !last || manual.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || manual.current) return;
        io.disconnect();
        void setRead(doc.id, true).catch(() => {});
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc.id, read, last, ch]);

  const toggleRead = () => {
    manual.current = true;
    void setRead(doc.id, !read).catch(() => {}); // ghi hỏng → banner StorageAlert (lib/db.ts)
  };

  const go = (k: number) => {
    const n = Math.max(0, Math.min(doc.chapters.length - 1, k));
    setCh(n);
    setStoryChapter(doc.id, n);
  };

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <header className="mb-4">
        <Link href={`/truyen/${doc.level}`} className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
          ← Truyện {level?.cefr}
        </Link>
        <div className="flex items-start gap-3">
          <span className="mt-1 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 sm:flex dark:text-violet-400">
            <Library className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{doc.title.en}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{doc.title.vi}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${accent.badge}`}>{level?.cefr}</span>
              <span>{TOPICS[doc.topic] ?? doc.topic}</span>
              <span aria-hidden>·</span>
              <span>
                {doc.chapters.length} chương · {doc.words} từ · {fmtMinutes(doc.min)}
              </span>
              {doc.series && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-medium text-foreground">
                    Phần {doc.series.order}/{doc.series.count}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <nav aria-label="Chương" className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {doc.chapters.map((c, k) => (
            <button
              key={k}
              type="button"
              onClick={() => go(k)}
              aria-current={k === ch ? "true" : undefined}
              title={c.title.en}
              className={cn(
                "inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2.5 text-sm font-semibold tabular-nums transition-colors",
                k === ch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {k + 1}
            </button>
          ))}
        </nav>
      </header>

      <PassageToolbar
        canPlay={player.available}
        playing={player.playing}
        onToggle={player.toggle}
        onStep={player.step}
        rate={player.rate}
        onCycleRate={player.cycleRate}
        showVi={showVi}
        onToggleVi={() => setShowVi((v) => !v)}
      >
        <DoneButton kind="read" done={read === true} onToggle={toggleRead} className="ml-1 h-9" />
      </PassageToolbar>

      <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-5 border-b pb-4">
          <div className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">Chương {ch + 1}</div>
          <h2 className="mt-1 text-xl font-bold">{chapter.title.en}</h2>
          <p className="text-sm text-muted-foreground">{chapter.title.vi}</p>
        </div>
        <PassageText
          sentences={chapter.sentences}
          paras={chapter.paras}
          showVi={showVi}
          active={player.active}
          onTapWord={(w) => void lookup.open(w)}
          onPlayFrom={(i) => player.playFrom(i, true)}
          domPrefix={`ss-${ch}-`}
          canPlay={player.available}
        />
        <div ref={endRef} data-testid="story-end" aria-hidden className="h-px" />
        {doc.source && <SourceNote source={doc.source} className="mt-8 border-t pt-4 text-xs leading-relaxed text-muted-foreground" />}
      </article>

      {chapter.quiz?.length ? (
        <Quiz key={`${doc.id}-${ch}`} questions={chapter.quiz} showVi={showVi} onTapWord={(w) => void lookup.open(w)} title={`Câu hỏi · Chương ${ch + 1}`} />
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(ch - 1)}
          disabled={ch === 0}
          className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="size-4" /> Chương trước
        </button>
        {!last ? (
          <button
            type="button"
            onClick={() => go(ch + 1)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm active:scale-95"
          >
            Chương {ch + 2} <ChevronRight className="size-4" />
          </button>
        ) : doc.series?.next ? (
          <Link
            href={`/truyen/${doc.series.next.level}/${doc.series.next.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm active:scale-95"
          >
            Phần {doc.series.order + 1} <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">Hết truyện</span>
        )}
      </div>

      {doc.series && (
        <section className="mt-8 rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Layers3 className="size-4 text-primary" /> Truyện dài · phần {doc.series.order}/{doc.series.count}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {doc.series.prev && (
              <Link href={`/truyen/${doc.series.prev.level}/${doc.series.prev.id}`} className="rounded-xl border bg-card px-3 py-2 text-sm hover:border-primary/40">
                ← Phần {doc.series.order - 1} · {doc.series.prev.title_en}
              </Link>
            )}
            {doc.series.next && (
              <Link href={`/truyen/${doc.series.next.level}/${doc.series.next.id}`} className="rounded-xl border bg-card px-3 py-2 text-right text-sm hover:border-primary/40 sm:col-start-2">
                Phần {doc.series.order + 1} · {doc.series.next.title_en} →
              </Link>
            )}
          </div>
        </section>
      )}

      {doc.video && (
        <Link
          href={`/video/${doc.level}/${doc.video.id}`}
          className="mt-8 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 transition-colors hover:bg-rose-500/10"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <Clapperboard className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold tracking-[0.12em] text-rose-600 uppercase dark:text-rose-400">Video hội thoại</span>
            <span className="block truncate font-semibold">{doc.video.title.en}</span>
            <span className="block truncate text-xs text-muted-foreground">Nghe & nói lại một tình huống trong truyện</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {last && <FocusWords words={doc.focus} level={doc.level} onOpen={(w) => void lookup.open(w)} />}
      {last && grammar?.length ? (
        <section className="mt-8">
          <GrammarLinks items={grammar} />
        </section>
      ) : null}
      {lookup.node}
    </div>
  );
}
