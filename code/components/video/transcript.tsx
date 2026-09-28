"use client";

// Transcript đồng bộ audio: mỗi câu = nhãn người nói + các LỚP bật/tắt độc lập
// (English · IPA · Việt). IPA là ruby theo TỪ (GA, dạng từ điển); từ đang đọc bôi vàng (karaoke).
// Tắt hết = luyện nghe (chỉ còn thanh độ dài). Câu đang nói tự cuộn vào vùng nhìn; bấm câu → tua.
import { memo, useEffect, useMemo, useRef } from "react";
import { lineTokens, speakersOf, type VideoLesson, type VideoLine } from "@/lib/video";
import { lookOf } from "./rig";

export interface Layers {
  en: boolean;
  ipa: boolean;
  vi: boolean;
}

export const noLayers = (l: Layers) => !l.en && !l.ipa && !l.vi;

const WORD_HI = "rounded bg-amber-300/80 text-foreground dark:bg-amber-400/40";

function EnglishLine({ line, ipa, hi, className }: { line: VideoLine; ipa: boolean; hi: number; className: string }) {
  const toks = useMemo(() => lineTokens(line.en), [line.en]);
  return (
    <p className={className}>
      {toks.map((tk, k) => {
        if (tk.w < 0) return <span key={k}>{tk.t}</span>;
        const on = tk.w === hi;
        const p = ipa ? line.ipa?.[tk.w] : "";
        if (!p)
          return (
            <span key={k} className={on ? WORD_HI : undefined}>
              {tk.t}
            </span>
          );
        // inline-block: trình duyệt ngắt dòng theo bề rộng THẬT của ruby (IPA thường rộng hơn chữ gốc) —
        // để ruby trần thì Chrome đo theo chữ gốc, cuối dòng tràn ra ngoài khung ở màn hẹp.
        return (
          <span key={k} className="inline-block">
            <ruby className={on ? WORD_HI : undefined}>
              {tk.t}
              <rt className="px-px text-[0.56em] font-normal tracking-tight text-primary dark:text-sky-400">{p}</rt>
            </ruby>
          </span>
        );
      })}
    </p>
  );
}

const Line = memo(function Line({
  line,
  i,
  active,
  hi,
  layers,
  lesson,
  onSeek,
  hidden,
}: {
  line: VideoLine;
  i: number;
  active: boolean;
  hi: number;
  layers: Layers;
  lesson: VideoLesson;
  onSeek: (i: number) => void;
  hidden?: boolean; // nhập vai: lượt của người học chưa nói xong thì che chữ
}) {
  const sps = speakersOf(line);
  const accent = lookOf(lesson.cast[sps[0]]).accent;
  const names = sps.map((sp) => lesson.cast[sp].name.en).join(" & ");
  const namesVi = sps.map((sp) => lesson.cast[sp].name.vi).filter((n, k) => n !== lesson.cast[sps[k]].name.en).join(", ");
  const blind = noLayers(layers) || hidden;
  const dur = line.end - line.start;
  return (
    <div
      role="button"
      tabIndex={0}
      data-line={i}
      aria-current={active ? "true" : undefined}
      onClick={() => onSeek(i)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSeek(i);
        }
      }}
      className={`relative cursor-pointer rounded-2xl border-l-4 px-3.5 py-2.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
        active ? "bg-primary/10 dark:bg-primary/20" : "border-transparent hover:bg-muted/60"
      }`}
      style={active ? { borderLeftColor: accent } : undefined}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: accent }}>
        <span className="size-2 rounded-full" style={{ background: accent }} />
        {names}
        {namesVi && (layers.vi || blind) && <span className="font-normal text-muted-foreground">· {namesVi}</span>}
      </div>
      {blind ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-2.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/25"}`} style={{ width: `${Math.min(100, 12 + dur * 14)}%` }} />
          <span className="tabular-nums">{i + 1}</span>
          {hidden && !noLayers(layers) && <span className="ml-auto font-medium text-primary">Lượt của bạn</span>}
        </div>
      ) : (
        <>
          {(layers.en || layers.ipa) && (
            <EnglishLine
              line={line}
              ipa={layers.ipa}
              hi={active ? hi : -1}
              className={`text-[1.12rem] sm:text-xl ${layers.ipa ? "mt-0.5 leading-[2.3]" : "mt-1 leading-relaxed"} ${layers.en ? "" : "text-transparent [&_rt]:text-primary"}`}
            />
          )}
          {layers.vi && <p className="mt-1 text-[0.95rem] leading-snug text-muted-foreground">{line.vi}</p>}
        </>
      )}
    </div>
  );
});

export function Transcript({
  lesson,
  idx,
  hi,
  layers,
  onSeek,
  topInset,
  hiddenFrom,
  role,
}: {
  lesson: VideoLesson;
  idx: number;
  hi: number;
  layers: Layers;
  onSeek: (i: number) => void;
  topInset: () => number; // mép dưới vùng bị che (header / cảnh dính) theo px viewport
  hiddenFrom?: number; // nhập vai: che các lượt của `role` từ câu này trở đi (chưa tới lượt)
  role?: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const lastUser = useRef(0);

  // Người dùng tự cuộn → nhường 4 s, không giật trang về câu đang nói.
  useEffect(() => {
    const mark = () => (lastUser.current = Date.now());
    const onKey = (e: KeyboardEvent) => {
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) mark();
    };
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchmove", mark);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Câu mới bắt đầu → đưa câu vào khoảng trên của vùng còn nhìn thấy (dưới cảnh dính).
  useEffect(() => {
    if (idx < 0 || Date.now() - lastUser.current < 4000) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-line="${idx}"]`);
    if (!el || !box.current) return;
    const top = topInset();
    const b = box.current.getBoundingClientRect();
    if (b.bottom < top + 40 || b.top > window.innerHeight - 40) return;
    const r = el.getBoundingClientRect();
    const region = window.innerHeight - top;
    const want = top + Math.min(24, region * 0.06);
    if (Math.abs(r.top - want) < 8) return;
    window.scrollTo({ top: window.scrollY + r.top - want, behavior: "smooth" });
  }, [idx, topInset]);

  return (
    <div ref={box} className="space-y-1.5">
      {lesson.lines.map((l, i) => (
        <Line
          key={i}
          line={l}
          i={i}
          active={i === idx}
          hi={i === idx ? hi : -1}
          layers={layers}
          lesson={lesson}
          onSeek={onSeek}
          hidden={!!role && hiddenFrom !== undefined && i >= hiddenFrom && speakersOf(l).includes(role)}
        />
      ))}
    </div>
  );
}
