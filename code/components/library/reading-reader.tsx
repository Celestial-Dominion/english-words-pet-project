"use client";

// Trang một bài đọc: tiêu đề + thông tin → thanh công cụ (nghe cả bài, Dịch, đã đọc) → văn bản bấm-tra
// → từ trọng tâm → series (bậc trước/sau) → bài tiếp. Mở bài KHÔNG tự đánh dấu đã đọc; đọc tới cuối
// bài (mốc cuối vào tầm nhìn) mới đánh dấu — như app HSK.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenText, Check, ChevronRight, Layers3 } from "lucide-react";
import { GENRES, TOPICS, loadReading, loadReadingsIndex, fmtMinutes, type ReadingDoc, type ReadingMeta } from "@/lib/library";
import { contentAccent, contentLevel } from "@/lib/levels";
import { isRead, markRead } from "@/lib/db";
import { usePassageAudio } from "./passage-audio";
import { FocusWords, PassageText, PassageToolbar, useWordLookup } from "./passage-view";

export function ReadingReader({ id }: { id: string }) {
  const [doc, setDoc] = useState<ReadingDoc | null>(null);
  const [next, setNext] = useState<ReadingMeta | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadReading(id)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setError(true));
    loadReadingsIndex()
      .then((idx) => {
        const i = idx.findIndex((r) => r.id === id);
        if (alive && i >= 0 && idx[i + 1]?.level === idx[i].level) setNext(idx[i + 1]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  if (error) return <p className="text-sm text-destructive">Không tải được bài đọc. Kiểm tra kết nối rồi tải lại trang.</p>;
  if (!doc) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  return <Reader doc={doc} next={next} />;
}

function Reader({ doc, next }: { doc: ReadingDoc; next: ReadingMeta | null }) {
  const [showVi, setShowVi] = useState(false);
  const [readOf, setReadOf] = useState<{ id: string; read: boolean }>({ id: doc.id, read: false });
  const read = readOf.id === doc.id && readOf.read;
  const endRef = useRef<HTMLDivElement>(null);
  const player = usePassageAudio(doc.audio, "rs-");
  const lookup = useWordLookup();
  const level = contentLevel(doc.level);
  const accent = contentAccent(doc.level);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [doc.id]);
  useEffect(() => {
    void isRead(doc.id).then((v) => setReadOf({ id: doc.id, read: v }));
  }, [doc.id]);
  useEffect(() => {
    const el = endRef.current;
    if (!el || read) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        void markRead(doc.id).then(() => setReadOf({ id: doc.id, read: true }));
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc.id, read]);

  const toggleRead = async () => {
    await markRead(doc.id, !read);
    setReadOf({ id: doc.id, read: !read });
  };

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <header className="mb-4">
        <Link href={`/bai-doc/${doc.level}`} className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
          ← Bài đọc {level?.cefr}
        </Link>
        <div className="flex items-start gap-3">
          <span className="mt-1 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <BookOpenText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{doc.title.en}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{doc.title.vi}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${accent.badge}`}>{level?.cefr}</span>
              <span>{TOPICS[doc.topic] ?? doc.topic}</span>
              <span aria-hidden>·</span>
              <span>{GENRES[doc.genre] ?? doc.genre}</span>
              <span aria-hidden>·</span>
              <span>
                {doc.words} từ · {fmtMinutes(doc.min)}
              </span>
            </div>
          </div>
        </div>
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
        <button
          type="button"
          onClick={() => void toggleRead()}
          aria-pressed={read}
          aria-label={read ? "Đã đọc — bấm để bỏ đánh dấu" : "Đánh dấu đã đọc"}
          title={read ? "Đã đọc (bấm để bỏ)" : "Đánh dấu đã đọc"}
          className={`ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all ${
            read ? "bg-emerald-500 text-white shadow-sm" : "border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          <Check className="size-4.5" strokeWidth={read ? 3 : 2} />
        </button>
      </PassageToolbar>

      <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
        <p className="mb-5 border-b pb-4 text-xs leading-relaxed text-muted-foreground">Chạm vào bất kỳ từ nào để xem nghĩa, phát âm và ví dụ.</p>
        <PassageText
          sentences={doc.sentences}
          paras={doc.paras}
          showVi={showVi}
          active={player.active}
          onTapWord={(w) => void lookup.open(w)}
          onPlayFrom={(i) => player.playFrom(i, true)}
          domPrefix="rs-"
          canPlay={player.available}
        />
        <div ref={endRef} data-testid="reading-end" aria-hidden className="h-px" />
        <footer className="mt-8 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          Bài đọc do dự án biên soạn theo cấp độ; bản dịch tiếng Việt để đối chiếu — hãy đọc tiếng Anh trước.
        </footer>
      </article>

      <FocusWords words={doc.focus} level={doc.level} onOpen={(w) => void lookup.open(w)} />

      {doc.series && (
        <section className="mt-8 rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Layers3 className="size-4 text-primary" /> Chuỗi bài theo cấp · bậc {doc.series.order}/{doc.series.count}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Cùng một chủ đề, mỗi cấp đào sâu hơn.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {doc.series.prev && (
              <Link href={`/bai-doc/${doc.series.prev.level}/${doc.series.prev.id}`} className="rounded-xl border bg-card px-3 py-2 text-sm hover:border-primary/40">
                ← {doc.series.prev.level.toUpperCase()} · {doc.series.prev.title_en}
              </Link>
            )}
            {doc.series.next && (
              <Link href={`/bai-doc/${doc.series.next.level}/${doc.series.next.id}`} className="rounded-xl border bg-card px-3 py-2 text-right text-sm hover:border-primary/40 sm:col-start-2">
                {doc.series.next.level.toUpperCase()} · {doc.series.next.title_en} →
              </Link>
            )}
          </div>
        </section>
      )}

      {next && (
        <Link
          href={`/bai-doc/${next.level}/${next.id}`}
          className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold tracking-[0.12em] uppercase">Bài tiếp</span>
            <span className="block truncate">{next.title_en}</span>
          </span>
          <ChevronRight className="size-5 shrink-0" />
        </Link>
      )}
      {lookup.node}
    </div>
  );
}
