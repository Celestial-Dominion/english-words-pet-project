"use client";

// Câu tiếng Anh của bài Ngữ pháp: tô các chỗ nhấn theo VAI (dạng đang học, chủ ngữ, động từ, trợ động từ…), IPA ruby
// theo TỪ (GA, như Video), từ đang đọc (karaoke) và chỗ lời giảng đang nhắc tới (cue). Dùng cho bảng giảng (board —
// nền giấy cố định, không theo dark mode) và transcript.
import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import { lineTokens } from "@/lib/video";
import type { Role, Span } from "@/lib/grammar";

// Màu cố định theo vai. Class literal để Tailwind không purge.
export const ROLE_CLASS: Record<Role, string> = {
  k: "bg-amber-300/75 dark:bg-amber-400/40 font-semibold",
  s: "bg-rose-200/80 dark:bg-rose-500/30",
  v: "bg-emerald-200/90 dark:bg-emerald-500/35",
  a: "bg-indigo-200/90 dark:bg-indigo-500/35",
  o: "bg-sky-200/90 dark:bg-sky-500/35",
  t: "bg-cyan-200/90 dark:bg-cyan-500/30",
  n: "bg-red-200/90 dark:bg-red-500/35",
  q: "bg-orange-200/90 dark:bg-orange-500/35",
  c: "bg-violet-200/90 dark:bg-violet-500/35",
};
export const ROLE_BOARD: Record<Role, string> = {
  k: "bg-amber-300/80 font-bold",
  s: "bg-rose-200",
  v: "bg-emerald-200",
  a: "bg-indigo-200",
  o: "bg-sky-200",
  t: "bg-cyan-200",
  n: "bg-red-200",
  q: "bg-orange-200",
  c: "bg-violet-200",
};

export interface EnLineProps {
  en: string;
  ipa?: readonly string[];
  showIpa?: boolean;
  spans?: readonly Span[];
  hi?: number; // chỉ số TỪ đang đọc (-1 = không)
  cue?: number; // chỉ số span lời giảng đang nhắc (-1 = không)
  board?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const EnLine = memo(function EnLine({ en, ipa, showIpa = false, spans, hi = -1, cue = -1, board = false, className = "", style }: EnLineProps) {
  const toks = useMemo(() => lineTokens(en), [en]);
  const tag = useMemo(() => {
    const t: (number | undefined)[] = new Array(en.length).fill(undefined);
    (spans ?? []).forEach(([a, b], k) => {
      for (let i = Math.max(0, a); i < Math.min(en.length, b); i++) if (t[i] === undefined) t[i] = k;
    });
    return t;
  }, [en, spans]);
  const palette = board ? ROLE_BOARD : ROLE_CLASS;
  const hiCls = board ? "g-hi-board" : "g-hi";
  let pos = 0;
  const out: ReactNode[] = [];
  toks.forEach((tk, ti) => {
    const from = pos;
    pos += tk.t.length;
    // cụm ký tự liền cùng vai → một mảnh màu; bo góc ở đầu / cuối của cả vai (không bo giữa các từ)
    const runs: ReactNode[] = [];
    for (let i = 0; i < tk.t.length; ) {
      const k = tag[from + i];
      let j = i + 1;
      while (j < tk.t.length && tag[from + j] === k) j++;
      const text = tk.t.slice(i, j);
      if (k === undefined) runs.push(<span key={i}>{text}</span>);
      else {
        const [a, b, role] = spans![k];
        const l = from + i === a ? "rounded-l-[0.2em] pl-[0.05em]" : "";
        const r = from + j === b ? "rounded-r-[0.2em] pr-[0.05em]" : "";
        runs.push(
          <span key={i} className={`${palette[role]} ${l} ${r} ${cue === k ? "g-cue" : ""}`}>
            {text}
          </span>,
        );
      }
      i = j;
    }
    if (tk.w < 0) {
      out.push(<span key={ti}>{runs}</span>);
      return;
    }
    const on = tk.w === hi;
    const p = showIpa ? ipa?.[tk.w] : "";
    if (!p)
      out.push(
        <span key={ti} className={on ? hiCls : undefined}>
          {runs}
        </span>,
      );
    else
      // inline-block: ngắt dòng theo bề rộng THẬT của ruby (IPA thường rộng hơn chữ gốc) — xem transcript Video
      out.push(
        <span key={ti} className="inline-block">
          <ruby className={on ? hiCls : undefined}>
            {runs}
            <rt className={`px-px text-[0.52em] font-normal tracking-tight ${board ? "text-sky-700" : "text-primary dark:text-sky-400"}`}>{p}</rt>
          </ruby>
        </span>,
      );
  });
  return (
    <p className={className} style={style}>
      {out}
    </p>
  );
});
