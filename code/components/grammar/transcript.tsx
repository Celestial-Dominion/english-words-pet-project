"use client";

// Transcript bài Ngữ pháp = chính nội dung bài, chia theo phần (Mở đầu · Ý nghĩa · Cấu trúc · Ví dụ…): lời giảng tiếng
// Việt (tiếng Anh chen giữa in đậm) và câu tiếng Anh với các LỚP bật/tắt độc lập English · IPA · Việt như Video. Đoạn
// đang phát được tô; bấm đoạn bất kỳ = tua tới đó. Đáp án "thử nhớ lại" che mờ tới khi nghe tới / bấm hiện.
import { memo, useRef, useState } from "react";
import { BookOpen, Ear, Lightbulb, ListChecks, MessageCircle, Quote, Repeat2, Scale, Shapes, Sparkles, ThumbsUp, TriangleAlert } from "lucide-react";
import { SECTIONS, sectionsOf, type Beat, type Board, type GrammarLesson, type SectionId } from "@/lib/grammar";
import { noLayers, type Layers } from "@/components/video/transcript";
import { useFollowScroll } from "@/components/video/use-follow-scroll";
import { lookOf } from "@/components/video/rig";
import { EnLine } from "./en-line";

const SEC_ICON: Record<SectionId, typeof Lightbulb> = {
  hook: Sparkles,
  meaning: Lightbulb,
  form: Shapes,
  examples: BookOpen,
  real: Quote,
  dialogue: MessageCircle,
  contrast: Scale,
  mistakes: TriangleAlert,
  natural: ThumbsUp,
  pronunciation: Ear,
  recall: Repeat2,
  recap: ListChecks,
};

// Bảng công thức / bảng biểu chép lại dạng chữ ngay dưới đoạn giảng đầu tiên dùng nó: trên điện thoại chữ trên sân
// khấu nhỏ, và trình đọc màn hình không đọc được hình — transcript giữ đủ nội dung bài.
function BoardText({ board }: { board: Board }) {
  if (board.type === "formula")
    return (
      <div className="mt-2 space-y-1">
        {board.rows.map((row, r) => (
          <div key={r} className="flex flex-wrap items-center gap-1 text-[0.9rem]">
            {row.map((c, k) => (
              <span key={k} className="flex items-center gap-1">
                {k > 0 && <span className="text-muted-foreground">+</span>}
                <span className={`rounded-md px-1.5 py-0.5 ${c.en ? "bg-amber-300/35 font-semibold dark:bg-amber-400/20" : "bg-muted text-muted-foreground"}`}>{c.x}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  if (board.type === "table")
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[0.88rem] leading-snug">
          {board.head && (
            <thead>
              <tr className="text-xs text-muted-foreground uppercase">
                {board.head.map((h, j) => (
                  <th key={j} className="px-2 py-1 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {board.rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60 align-top">
                {r.map((c, j) => (
                  <td key={j} className={`px-2 py-1 ${j === 0 ? `font-semibold ${c.length <= 16 ? "whitespace-nowrap" : ""}` : ""}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return null;
}

const BeatRow = memo(function BeatRow({
  b,
  i,
  active,
  hi,
  layers,
  lesson,
  hidden,
  board,
  onSeek,
  onReveal,
}: {
  b: Beat;
  i: number;
  active: boolean;
  hi: number;
  layers: Layers;
  lesson: GrammarLesson;
  hidden: boolean;
  board?: Board;
  onSeek: (i: number) => void;
  onReveal: (i: number) => void;
}) {
  const blind = noLayers(layers);
  const base = `relative cursor-pointer rounded-2xl border-l-4 px-3.5 py-2.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
    active ? "border-primary bg-primary/10 dark:bg-primary/20" : "border-transparent hover:bg-muted/60"
  }`;
  const act = {
    role: "button" as const,
    tabIndex: 0,
    "data-beat": i,
    "aria-current": active ? ("true" as const) : undefined,
    onClick: () => onSeek(i),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSeek(i);
      }
    },
  };
  if (b.k === "n")
    return (
      <div {...act} className={base}>
        <p className="text-[1.02rem] leading-relaxed">
          {b.parts.map((p, k) =>
            p.v !== undefined ? (
              <span key={k}>{p.v}</span>
            ) : (
              <span key={k} className="font-semibold text-foreground">
                {p.e}
              </span>
            ),
          )}
        </p>
        {board && <BoardText board={board} />}
      </div>
    );
  const who = b.who ? lesson.cast?.[b.who] : undefined;
  const accent = who ? lookOf({ look: who.look, style: who.style } as never).accent : undefined;
  return (
    <div {...act} className={base}>
      {who && (
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: accent }}>
          <span className="size-2 rounded-full" style={{ background: accent }} />
          {who.name.en}
          {(layers.vi || blind) && who.name.vi !== who.name.en && <span className="font-normal text-muted-foreground">· {who.name.vi}</span>}
        </div>
      )}
      {b.bad && !blind && (
        <p className="mt-0.5 flex items-start gap-2 text-[1.05rem] text-red-700 dark:text-red-400">
          <span className="mt-0.5 text-sm">❌</span>
          <span className="g-strike">{b.bad.en}</span>
        </p>
      )}
      <div className={hidden ? "pointer-events-none blur-sm select-none" : undefined}>
        {blind ? (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/25"}`} style={{ width: `${Math.min(100, 12 + (b.end - b.start) * 17)}%` }} />
          </div>
        ) : (
          <>
            {(layers.en || layers.ipa) && (
              <div className="flex items-start gap-2">
                {b.bad && <span className="mt-1 text-sm">✅</span>}
                <EnLine
                  en={b.en}
                  ipa={b.ipa}
                  showIpa={layers.ipa}
                  spans={b.hl}
                  hi={active ? hi : -1}
                  className={`min-w-0 text-[1.12rem] sm:text-xl ${layers.ipa ? "mt-0.5 leading-[2.3]" : "mt-1 leading-relaxed"} ${layers.en ? "" : "text-transparent [&_rt]:text-primary"}`}
                />
              </div>
            )}
            {layers.vi && <p className="mt-1 text-[0.95rem] leading-snug text-muted-foreground">{b.vi}</p>}
            {b.note && <p className="mt-1 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{b.note}</p>}
          </>
        )}
      </div>
      {hidden && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReveal(i);
          }}
          className="absolute inset-0 m-auto h-9 w-fit rounded-full bg-background/95 px-4 text-sm font-medium shadow"
        >
          Hiện đáp án
        </button>
      )}
    </div>
  );
});

export function GrammarTranscript({
  lesson,
  idx,
  hi,
  layers,
  onSeek,
  topInset,
}: {
  lesson: GrammarLesson;
  idx: number;
  hi: number;
  layers: Layers;
  onSeek: (i: number) => void;
  topInset: () => number;
}) {
  const box = useRef<HTMLDivElement>(null);
  useFollowScroll(box, idx, topInset, "data-beat");
  const [shown, setShown] = useState<Set<number>>(() => new Set());
  const reveal = (i: number) => setShown((s) => new Set(s).add(i));
  const secs = sectionsOf(lesson.beats);
  // đáp án "thử nhớ lại" = câu tiếng Anh ngay sau câu hỏi có hold
  const answers = new Set<number>();
  lesson.beats.forEach((b, i) => {
    if (b.k === "n" && b.hold && lesson.beats[i + 1]?.k === "e") answers.add(i + 1);
  });
  // bảng công thức / bảng biểu: gắn vào đoạn giảng đầu tiên dùng bảng đó
  const boardAt = new Map<number, Board>();
  const seenBoard = new Set<number>();
  lesson.beats.forEach((b, i) => {
    const bd = lesson.boards[b.b];
    if (b.k === "n" && bd && (bd.type === "table" || bd.type === "formula") && !seenBoard.has(b.b)) {
      seenBoard.add(b.b);
      boardAt.set(i, bd);
    }
  });
  return (
    <div ref={box} className="space-y-5">
      {secs.map((sc) => {
        const Icon = SEC_ICON[sc.sec];
        return (
          <section key={sc.from} className="space-y-1.5">
            <h3 className="flex items-center gap-2 px-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              <Icon className="size-4" /> {SECTIONS[sc.sec]}
            </h3>
            {lesson.beats.slice(sc.from, sc.to).map((b, k) => {
              const i = sc.from + k;
              return (
                <BeatRow
                  key={i}
                  b={b}
                  i={i}
                  active={i === idx}
                  hi={i === idx ? hi : -1}
                  layers={layers}
                  lesson={lesson}
                  hidden={answers.has(i) && idx < i && !shown.has(i)}
                  board={boardAt.get(i)}
                  onSeek={onSeek}
                  onReveal={reveal}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
