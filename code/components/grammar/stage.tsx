"use client";

// Sân khấu 16:9 của bài Ngữ pháp: BẢNG giảng (component dùng chung theo loại bảng — công thức, câu tô vai, cặp đối
// chiếu, sửa lỗi, trục thời gian, di chuyển từ, bảng, phát âm, tự nhiên hay không, câu đố, tóm tắt) + cô giáo nhép
// miệng theo audio; phần hội thoại chuyển sang cảnh nhân vật của Video (tải lười). Bảng vẽ lại theo ĐOẠN (idx), từ
// đang đọc (hi) và cue; chuyển động từng khung (miệng, mắt, cảnh, di chuyển từ) đi thẳng vào DOM qua `update(t)`.
import { memo, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import dynamic from "next/dynamic";
import { Eye, HelpCircle } from "lucide-react";
import { RANK_LABEL, SECTIONS, speakerOf, type Board, type GrammarLesson, type LineBeat, type RankGrade } from "@/lib/grammar";
import { mouthAt } from "@/lib/video";
import { contentLevel } from "@/lib/levels";
import type { Layers } from "@/components/video/transcript";
import { Character, type CharacterHandle } from "@/components/video/character";
import type { CharPose } from "@/components/video/pose";
import { lookOf } from "@/components/video/rig";
import type { SceneHandle } from "@/components/video/scene";
import { EnLine } from "./en-line";

const DialogueScene = dynamic(() => import("./dialogue-scene"), { ssr: false });

export interface StageHandle {
  update(t: number): void;
}

// Cô giáo (content/grammar/cast.json → teacher): rig Video, áo cardigan xanh, kính.
export const TEACHER = {
  look: "woman",
  style: { outfit: "cardigan", top: "#3E6FB0", topShade: "#325B92", collar: "#F4F1EA", accent: "#325B92", glasses: true, hair: "bun", hairColor: "#2E2220" },
};

function teacherPose(t: number, talking: number): CharPose {
  const blinkPhase = (t * 0.31 + 0.17) % 1;
  return {
    bodyX: 0,
    bodyY: -talking * 2,
    bodyRot: 0,
    headX: Math.sin(t * 1.3) * 1.5,
    headY: 0,
    headRot: talking > 0.05 ? Math.sin(t * 2.1) * 2.2 : Math.sin(t * 0.7) * 0.8,
    eyeOpen: blinkPhase < 0.035 ? 0.1 : 1,
    gazeX: 3,
    gazeY: 0,
    mouth: talking,
    armL: 7,
    armR: -7,
    emote: 0,
    tear: -1,
  };
}

// Cỡ chữ câu lớn trên bảng theo độ dài (cqw — theo bề ngang sân khấu).
function lineSize(n: number): string {
  if (n <= 14) return "6.6cqw";
  if (n <= 22) return "5.4cqw";
  if (n <= 32) return "4.5cqw";
  if (n <= 44) return "3.8cqw";
  if (n <= 60) return "3.2cqw";
  return "2.7cqw";
}
const INK = "text-[#2B2620]";
const MUTED = "text-[#5A5044]";
const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase());

export const GrammarStage = memo(function GrammarStage({
  lesson,
  idx,
  hi,
  cue,
  layers,
  held,
  onReveal,
  getTime,
  ref,
}: {
  lesson: GrammarLesson;
  idx: number;
  hi: number;
  cue: number;
  layers: Layers;
  held: boolean;
  onReveal: () => void;
  getTime: () => number;
  ref?: Ref<StageHandle>;
}) {
  const beat = idx >= 0 ? lesson.beats[idx] : undefined;
  const bi = beat ? beat.b : 0;
  const board = lesson.boards[bi] ?? { type: "title" };
  const teacher = useRef<CharacterHandle>(null);
  const scene = useRef<SceneHandle>(null);
  const move = useRef<((t: number) => void) | null>(null);
  const registerMove = useCallback((f: ((t: number) => void) | null) => {
    move.current = f;
  }, []);
  const look = useMemo(() => lookOf(TEACHER as never), []);
  const showIpa = layers.ipa;
  const showVi = layers.vi;

  const apply = useCallback(
    (t: number) => {
      const b = lesson.beats[idx];
      const talking = b && speakerOf(b) === "teacher" && t >= b.start - 0.02 && t <= b.end + 0.08 ? mouthAt(lesson.audio, t) : 0;
      teacher.current?.apply(teacherPose(t, talking));
      scene.current?.update(t);
      move.current?.(t);
    },
    [lesson, idx],
  );
  useImperativeHandle(ref, () => ({ update: apply }), [apply]);
  useLayoutEffect(() => apply(getTime()));

  const isScene = board.type === "scene";
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ containerType: "size" }}>
      {isScene ? (
        <>
          <DialogueScene ref={scene} lesson={lesson} idx={idx} getTime={getTime} />
          <SceneCaption lesson={lesson} idx={idx} hi={hi} showIpa={showIpa} showVi={showVi} blind={!layers.en && !layers.ipa && !layers.vi} />
        </>
      ) : (
        <>
          {/* bảng + khung gỗ (màu cố định như cảnh Video, không theo dark mode) */}
          <div className="absolute inset-0 bg-[#E6DDCB]" />
          <div
            className="absolute rounded-[2.2cqw] border-[0.9cqw] border-[#8C6D4B] bg-[#FBF8F1] shadow-[inset_0_0_2cqw_rgba(120,90,50,0.15)]"
            style={{ left: "3%", right: "3%", top: "5%", bottom: "7%" }}
          />
          <div className={`absolute ${INK}`} style={{ left: "6%", right: "5%", top: "9%", bottom: "11%", containerType: "size" }}>
            <BoardView key={bi} board={board} lesson={lesson} idx={idx} hi={hi} cue={cue} showIpa={showIpa} showVi={showVi} registerMove={registerMove} />
          </div>
          {/* cô giáo ở góc dưới trái */}
          <svg viewBox="-190 -540 380 560" className="pointer-events-none absolute bottom-0 left-[0.5%] h-[40%]" aria-hidden="true">
            <Character ref={teacher} look={look} x={0} baseY={0} facing={1} expression={beat?.sec === "mistakes" ? "thinking" : beat?.sec === "recap" ? "happy" : "neutral"} />
          </svg>
        </>
      )}
      {held && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReveal();
          }}
          className="absolute bottom-[9%] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95"
        >
          <Eye className="size-4" /> Xem đáp án
        </button>
      )}
    </div>
  );
});

function SceneCaption({ lesson, idx, hi, showIpa, showVi, blind }: { lesson: GrammarLesson; idx: number; hi: number; showIpa: boolean; showVi: boolean; blind: boolean }) {
  const b = lesson.beats[idx];
  if (!b || b.k !== "e" || !b.who || blind) return null;
  const c = lesson.cast?.[b.who];
  return (
    <div className="absolute inset-x-[3%] bottom-[3%] rounded-[1.6cqw] bg-white/92 px-[2cqw] py-[1.1cqw] text-center text-[#2B2620] shadow-md">
      <div className="text-[2.1cqw] font-semibold" style={{ color: c ? lookOf(c as never).accent : undefined }}>
        {c?.name.en}
      </div>
      <EnLine en={b.en} ipa={b.ipa} showIpa={showIpa} spans={b.hl} hi={hi} board className={`text-[3.5cqw] ${showIpa ? "leading-[2]" : "leading-snug"}`} />
      {showVi && <div className="text-[2.3cqw] text-[#5A5044]">{b.vi}</div>}
    </div>
  );
}

// Câu tiếng Anh "giữ bảng" (dòng + trong nguồn) hiện ở chân bảng công thức / bảng / phát âm / di chuyển / trục thời gian.
function CaptionLine({ L, active, hi, showIpa, showVi }: { L: LineBeat; active: boolean; hi: number; showIpa: boolean; showVi: boolean }) {
  return (
    <div className="g-in absolute inset-x-[12%] bottom-0 text-center">
      <EnLine en={L.en} ipa={L.ipa} showIpa={showIpa} spans={L.hl} hi={active ? hi : -1} board className={`text-[3.4cqw] ${showIpa ? "leading-[2]" : "leading-snug"}`} />
      {showVi && <div className={`text-[2.5cqw] ${MUTED}`}>{L.vi}</div>}
    </div>
  );
}

const GRADE_STYLE: Record<RankGrade, { badge: string; mark: string; text: string }> = {
  best: { badge: "bg-emerald-600 text-white", mark: "✓✓", text: "" },
  ok: { badge: "bg-teal-500 text-white", mark: "✓", text: "" },
  odd: { badge: "bg-amber-500 text-white", mark: "?", text: "text-[#6B5A45]" },
  bad: { badge: "bg-red-600 text-white", mark: "✕", text: "g-strike text-[#7A2E2E]" },
};

// Bảng: chia cột như bảng HTML tự động, tính trước bằng ước lượng bề rộng chữ (đơn vị cqw, hệ số đã đo trên sân khấu).
// Mỗi cột: max = ô dài nhất trên một dòng, min = từ dài nhất (kể cả tiêu đề). Chữ thu nhỏ tới 0.8 cho vừa (bảng ≥6 dòng
// luôn 0.8); mỗi cột nhận min, cột ngắn được đủ max để khỏi xuống dòng, cột cuối (câu ví dụ tiếng Anh) được ưu tiên
// nếu không quá tốn chỗ, phần còn lại chia cho các cột dài theo tỉ lệ phần còn thiếu.
// Tóm tắt: các dòng công thức dài (xuống 2–3 dòng) làm khung tràn quá chiều cao sân khấu → thu chữ vừa đủ (tối thiểu 0.72).
// Ước lượng theo cqw: bề ngang chữ ≈ 75cqw, chữ đậm ≈ 0.5em, sân khấu cao 56cqw (16:9), khung bảng giảng cao ≈ 47cqw bên trong viền → ước lượng ≤ 46 (ước lượng thấp hơn đo thật ≈ 3%).
function recapScale(forms: { f: string; vi?: string }[]) {
  const fits = (k: number) =>
    forms.reduce((h, f) => h + Math.ceil(f.f.length / (75 / (3.3 * k * 0.5))) * 3.3 * k * 1.3 + (f.vi ? 2.2 * Math.max(0.85, k) * 1.45 : 0) + 2.6 * k, 5) <= 46;
  return [1, 0.92, 0.85, 0.78].find(fits) ?? 0.72;
}

const TABLE_ROOM = 71.8;
function tableLayout(board: { head?: string[]; rows: string[][] }) {
  const cols = Math.max(board.head?.length ?? 0, ...board.rows.map((r) => r.length));
  const perChar = (j: number) => (j === 0 ? 4.1 * 0.43 : j === 1 ? 3.9 * 0.42 : 3.6 * 0.4) * 1.08;
  const HEAD = 2.4 * 0.58 * 1.08;
  const measure = (t: string | undefined, k: number) => ({ max: (t?.length ?? 0) * k, min: Math.max(0, ...(t ?? "").split(/\s+/).map((w) => w.length)) * k });
  const room = TABLE_ROOM - (cols - 1) * 1.6;
  const sumMax1 = Array.from({ length: cols }, (_, j) => Math.max(measure(board.head?.[j], HEAD).max, ...board.rows.map((r) => measure(r[j], perChar(j)).max))).reduce((a, x) => a + x, 0);
  const scale = Math.min(board.rows.length >= 6 ? 0.8 : 1, Math.max(0.8, Math.min(1, (room * 0.92) / Math.max(1, sumMax1))));
  const span = Array.from({ length: cols }, (_, j) => {
    const cells = [measure(board.head?.[j], HEAD), ...board.rows.map((r) => measure(r[j], perChar(j) * scale))];
    return { max: Math.max(...cells.map((c) => c.max)), w: Math.max(...cells.map((c) => c.min)) };
  });
  let free = room - span.reduce((a, c) => a + c.w, 0);
  let open = span.filter((c) => c.max > c.w);
  for (let done = false; !done && free > 0; ) {
    done = true;
    for (const c of open)
      if (c.max - c.w <= free / open.length) {
        free -= c.max - c.w;
        c.w = c.max;
        done = false;
      }
    open = open.filter((c) => c.max > c.w);
  }
  const last = span[cols - 1];
  if (cols >= 3 && open.includes(last) && last.max - last.w <= free * 0.62) {
    free -= last.max - last.w;
    last.w = last.max;
    open = open.filter((c) => c !== last);
  }
  const need = open.reduce((a, c) => a + c.max - c.w, 0);
  const extra = (c: (typeof span)[number]) => (free <= 0 ? 0 : need > 0 ? (open.includes(c) ? (free * (c.max - c.w)) / need : 0) : free / cols);
  return { scale, grid: span.map((c) => `minmax(0, ${Math.max(1, c.w + extra(c)).toFixed(2)}fr)`).join(" ") };
}

// Bảng: chữ ước lượng theo bề ngang (tableLayout), rồi ĐO chiều cao thật sau khi dựng — bảng dày (nhiều dòng, ô xuống
// dòng) vượt khung bên trong viền (≈45cqw, còn ≈35cqw khi có phụ đề bên dưới) thì thu chữ tiếp. Mọi kích thước là cqw
// nên tỉ lệ đo được đúng ở mọi bề ngang sân khấu.
function TableBoard({ board, caption, narrCue }: { board: Extract<Board, { type: "table" }>; caption: React.ReactNode; narrCue: number }) {
  const { scale, grid } = useMemo(() => tableLayout(board), [board]);
  const [fit, setFit] = useState<{ b: typeof board; k: number }>({ b: board, k: 1 });
  const k = fit.b === board ? fit.k : 1;
  const inner = useRef<HTMLDivElement>(null);
  const hasCaption = !!caption;
  useLayoutEffect(() => {
    const el = inner.current;
    const stageW = el?.closest<HTMLElement>('[style*="container-type"]')?.clientWidth;
    if (!el || !stageW) return;
    const room = ((hasCaption ? 35 : 45) * stageW) / 100;
    const h = el.offsetHeight;
    if (h > room + 1 && scale * k > 0.56) setFit({ b: board, k: Math.max(0.56 / scale, (k * room) / h) });
  }, [board, k, scale, hasCaption]);
  const cw = (v: number) => `${(v * scale * k).toFixed(2)}cqw`;
  return (
    <div className="relative flex h-full flex-col justify-center pl-[16%]">
      <div ref={inner} className="flex flex-col gap-[0.8cqh]">
        {board.head && (
          <div className="grid gap-[1.6cqw] px-[1.4cqw] font-bold tracking-wide text-[#7A5E3A] uppercase" style={{ gridTemplateColumns: grid, fontSize: `${(2.4 * Math.max(0.85, k)).toFixed(2)}cqw` }}>
            {board.head.map((h, j) => (
              <span key={j}>{h}</span>
            ))}
          </div>
        )}
        {board.rows.map((r, i) => (
          <div
            key={i}
            className={`g-in grid items-center gap-[1.6cqw] rounded-[1cqw] px-[1.4cqw] py-[0.4cqh] transition-colors ${narrCue === i ? "bg-amber-200/80" : i % 2 ? "bg-transparent" : "bg-[#F4EEE3]"}`}
            style={{ gridTemplateColumns: grid, animationDelay: `${i * 0.12}s` }}
          >
            {r.map((c, j) => (
              <span key={j} className={`[text-wrap:balance] ${j === 0 ? "font-bold" : j === 1 ? "font-semibold text-[#8A5A12]" : ""}`} style={{ fontSize: cw(j === 0 ? 4.1 : j === 1 ? 3.9 : 3.6) }}>
                {c}
              </span>
            ))}
          </div>
        ))}
      </div>
      {caption && <div className="h-[16cqh]" />}
      {caption}
    </div>
  );
}

function BoardView({
  board,
  lesson,
  idx,
  hi,
  cue,
  showIpa,
  showVi,
  registerMove,
}: {
  board: Board;
  lesson: GrammarLesson;
  idx: number;
  hi: number;
  cue: number;
  showIpa: boolean;
  showVi: boolean;
  registerMove: (f: ((t: number) => void) | null) => void;
}) {
  const beats = lesson.beats;
  const cur = beats[idx];
  const lineAt = (i: number) => (beats[i]?.k === "e" ? (beats[i] as LineBeat) : undefined);
  // câu đang đọc thuộc bảng này nhưng bảng không tự vẽ nó (dòng "+") → hiện ở chân bảng
  const caption = cur?.k === "e" && ["formula", "table", "sound", "move", "title", "recap"].includes(board.type) ? <CaptionLine L={cur} active hi={hi} showIpa={showIpa} showVi={showVi} /> : null;
  const narrCue = cur?.k === "n" ? cue : -1;
  switch (board.type) {
    case "title":
      return board.sec ? (
        <div className="g-in flex h-full flex-col items-center justify-center gap-[1.4cqh] pl-[16%] text-center">
          <div className="text-[2.2cqw] font-semibold text-[#9C7A54]">{lesson.en}</div>
          <div className="rounded-[1.4cqw] bg-[#EDE3D2] px-[3cqw] py-[1.2cqw] text-[5cqw] font-bold text-[#6B4E2E]">{SECTIONS[board.sec]}</div>
          {caption}
        </div>
      ) : (
        <div className="g-in flex h-full flex-col items-center justify-center gap-[1.6cqh] pl-[16%] text-center">
          <div className="rounded-full bg-[#EDE3D2] px-[2.4cqw] py-[0.6cqw] text-[2.2cqw] font-semibold text-[#7A5E3A]">
            {contentLevel(lesson.lv)?.cefr} · Ngữ pháp · Bài {lesson.n}
          </div>
          <div className="text-[5.4cqw] leading-tight font-bold">{lesson.en}</div>
          <div className="text-[3cqw] font-semibold text-[#4A3F33]">{lesson.t}</div>
          {caption}
        </div>
      );
    case "recap": {
      const k = recapScale(lesson.forms);
      return (
        <div className="relative flex h-full flex-col justify-center pl-[18%]" style={{ gap: `${(1.4 * k).toFixed(2)}cqh` }}>
          <div className="text-[2.6cqw] font-bold tracking-wide text-[#7A5E3A] uppercase">Tóm tắt</div>
          {lesson.forms.map((f, i) => (
            <div key={i} className="g-pop rounded-[1.2cqw] bg-[#F1E8D8] px-[2cqw]" style={{ paddingBlock: `${(0.9 * k).toFixed(2)}cqw`, animationDelay: `${i * 0.25}s` }}>
              <div className="font-bold" style={{ fontSize: `${(3.3 * k).toFixed(2)}cqw` }}>
                {f.f}
              </div>
              {f.vi && (
                <div className={MUTED} style={{ fontSize: `${(2.2 * Math.max(0.85, k)).toFixed(2)}cqw` }}>
                  {f.vi}
                </div>
              )}
            </div>
          ))}
          {caption}
        </div>
      );
    }
    case "formula": {
      let flat = 0;
      return (
        <div className="relative flex h-full flex-col items-center justify-center gap-[3cqh] pl-[14%]">
          {board.rows.map((row, r) => (
            <div key={r} className="flex flex-wrap items-center justify-center gap-x-[1.1cqw] gap-y-[1.4cqh]">
              {row.map((c, k) => {
                const n = flat++;
                return (
                  <span key={k} className="flex items-center gap-[1.1cqw]">
                    {k > 0 && <span className="text-[4.2cqw] font-bold text-[#9C7A54]">+</span>}
                    <span
                      className={`g-pop inline-flex items-center rounded-[1.2cqw] px-[1.7cqw] py-[0.9cqw] ${c.en ? "bg-amber-300/80 text-[4.8cqw] font-bold" : "bg-[#E4ECF6] text-[3.6cqw] font-semibold text-[#2F4A6E]"} ${narrCue === n ? "g-cue" : ""}`}
                      style={{ animationDelay: `${n * 0.26}s` }}
                    >
                      {c.x}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
          {board.cap && <div className={`text-[2.3cqw] ${MUTED}`}>{board.cap}</div>}
          {caption}
        </div>
      );
    }
    case "line": {
      const L = lineAt(board.beat);
      if (!L) return null;
      const active = idx === board.beat;
      return (
        <div className="g-in flex h-full flex-col items-center justify-center pl-[14%] text-center">
          <EnLine
            en={L.en}
            ipa={L.ipa}
            showIpa={showIpa}
            spans={L.hl}
            hi={active ? hi : -1}
            cue={narrCue}
            board
            className={showIpa ? "leading-[2.1]" : "leading-snug"}
            style={{ fontSize: lineSize(L.en.length) }}
          />
          {showVi && <div className={`mt-[1.2cqh] text-[2.7cqw] ${MUTED}`}>{L.vi}</div>}
          {L.note && <div className="mt-[1cqh] rounded-full bg-[#EDE3D2] px-[1.8cqw] py-[0.4cqw] text-[2.1cqw] text-[#6B5A45]">{L.note}</div>}
        </div>
      );
    }
    case "pair":
      return (
        <div className="flex h-full flex-col justify-center gap-[2cqh] pl-[15%]">
          {board.beats.map((b, k) => {
            const L = lineAt(b);
            if (!L) return null;
            const active = idx === b || narrCue === k;
            return (
              <div
                key={k}
                className={`g-in flex items-center gap-[1.6cqw] rounded-[1.4cqw] border-[0.35cqw] px-[1.6cqw] py-[0.7cqh] transition-colors ${active ? "border-amber-500 bg-amber-50" : "border-transparent bg-[#F4EEE3]"}`}
                style={{ animationDelay: `${k * 0.2}s` }}
              >
                <span className="flex size-[4.2cqw] shrink-0 items-center justify-center rounded-full bg-[#9C7A54] text-[2.3cqw] font-bold text-white">{String.fromCharCode(65 + k)}</span>
                <div className="min-w-0">
                  {board.labels?.[k] && <div className="text-[2.3cqw] font-semibold text-[#7A5E3A]">{board.labels[k]}</div>}
                  <EnLine en={L.en} ipa={L.ipa} showIpa={showIpa} spans={L.hl} hi={idx === b ? hi : -1} board className={`text-[4.2cqw] ${showIpa ? "leading-[2]" : "leading-snug"}`} />
                  {showVi && <div className={`text-[2.5cqw] ${MUTED}`}>{L.vi}</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    case "fix": {
      const L = lineAt(board.beat);
      if (!L?.bad) return null;
      const shownGood = idx >= board.beat;
      return (
        <div className="flex h-full flex-col justify-center gap-[2.4cqh] pl-[15%]">
          <div className="g-in flex items-center gap-[1.6cqw]">
            <span className="flex size-[4.6cqw] shrink-0 items-center justify-center rounded-full bg-red-600 text-[2.8cqw] font-bold text-white">✕</span>
            <EnLine en={L.bad.en} spans={L.bad.hl} board className="g-strike text-[4.1cqw] leading-snug text-[#7A2E2E]" />
          </div>
          {shownGood && (
            <div className="g-pop flex items-center gap-[1.6cqw]">
              <span className="flex size-[4.6cqw] shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[2.8cqw] font-bold text-white">✓</span>
              <div>
                <EnLine en={L.en} ipa={L.ipa} showIpa={showIpa} spans={L.hl} hi={idx === board.beat ? hi : -1} board className={`text-[4.1cqw] ${showIpa ? "leading-[2]" : "leading-snug"}`} />
                {showVi && <div className={`text-[2.3cqw] ${MUTED}`}>{L.vi}</div>}
              </div>
            </div>
          )}
        </div>
      );
    }
    case "timeline":
      return <TimelineBoard board={board} cur={cur} idx={idx} hi={hi} cue={narrCue} showIpa={showIpa} showVi={showVi} />;
    case "move":
      return (
        <div className="relative h-full">
          <MoveBoard from={board.from} to={board.to} cue={narrCue} beat={cur} register={registerMove} />
          {caption}
        </div>
      );
    case "table":
      return <TableBoard board={board} caption={caption} narrCue={narrCue} />;
    case "sound":
      return (
        <div className="relative flex h-full flex-col justify-center gap-[1.2cqh] pl-[16%]">
          {board.rows.map((r, k) => (
            <div
              key={k}
              className={`g-in flex items-baseline gap-[2cqw] rounded-[1cqw] px-[1.6cqw] py-[0.5cqh] transition-colors ${narrCue === k ? "bg-amber-200/80" : "bg-[#F4EEE3]"}`}
              style={{ animationDelay: `${k * 0.15}s` }}
            >
              <span className="min-w-[26%] text-[4cqw] font-semibold text-[#4A3F33]">{r.a}</span>
              {r.b && (
                <>
                  <span className="text-[3cqw] text-[#9C7A54]">→</span>
                  <span className="text-[4.4cqw] font-bold text-[#1d4ed8]">{r.b}</span>
                </>
              )}
              <span className="ml-auto text-[3.8cqw] text-sky-700">/{r.ipa}/</span>
            </div>
          ))}
          {caption && <div className="h-[16cqh]" />}
          {caption}
        </div>
      );
    case "rank":
      return (
        <div className="flex h-full flex-col justify-center gap-[1.4cqh] pl-[15%]">
          {board.items.map((it, k) => {
            const st = GRADE_STYLE[it.g];
            const L = it.beat !== undefined ? lineAt(it.beat) : undefined;
            const active = (it.beat !== undefined && idx === it.beat) || narrCue === k;
            return (
              <div
                key={k}
                className={`g-in flex items-center gap-[1.6cqw] rounded-[1.2cqw] border-[0.3cqw] px-[1.4cqw] py-[0.5cqh] ${active ? "border-amber-500 bg-amber-50" : "border-transparent bg-[#F4EEE3]"}`}
                style={{ animationDelay: `${k * 0.18}s` }}
              >
                <span className={`flex h-[4.2cqw] min-w-[4.2cqw] shrink-0 items-center justify-center rounded-full px-[0.8cqw] text-[2.2cqw] font-bold ${st.badge}`}>{st.mark}</span>
                <div className="min-w-0">
                  <div className="text-[2.2cqw] font-semibold text-[#7A5E3A]">{RANK_LABEL[it.g]}</div>
                  {L ? (
                    <EnLine en={L.en} ipa={L.ipa} showIpa={showIpa} spans={L.hl} hi={active ? hi : -1} board className={`text-[3.9cqw] ${showIpa ? "leading-[2]" : "leading-snug"}`} />
                  ) : (
                    <p className={`text-[3.9cqw] leading-snug ${st.text}`}>{it.en}</p>
                  )}
                  {showVi && it.vi && <div className={`text-[2.1cqw] ${MUTED}`}>{it.vi}</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    case "quiz":
      return (
        <div className="g-in flex h-full flex-col items-center justify-center gap-[2cqh] pl-[16%] text-center">
          <HelpCircle className="size-[8cqw] text-amber-500" />
          <div className="text-[3.5cqw] leading-snug font-semibold">{board.q}</div>
          <div className="text-[2.5cqw] text-[#6B5A45]">Tự nói thành tiếng trước, rồi xem đáp án</div>
        </div>
      );
    case "scene":
      return null;
  }
}

// Trục thời gian: quá khứ ← bây giờ → tương lai; mốc điểm (việc xảy ra), khoảng (kéo dài / tới bây giờ), gợn sóng
// (tiếp diễn). Mốc được lời giảng nhắc tới hoặc có trong câu đang đọc thì sáng lên.
function TimelineBoard({
  board,
  cur,
  idx,
  hi,
  cue,
  showIpa,
  showVi,
}: {
  board: Extract<Board, { type: "timeline" }>;
  cur: GrammarLesson["beats"][number] | undefined;
  idx: number;
  hi: number;
  cue: number;
  showIpa: boolean;
  showVi: boolean;
}) {
  void idx;
  const X = (at: number) => 22 + ((at + 3) / 6) * 72; // % bề ngang
  const curText = cur?.k === "e" ? cur.en : "";
  // nhãn “quá khứ / tương lai” ở hai đầu trục: mặc định dưới trục; mốc nào phía dưới chạm tới đầu trục thì đưa lên trên,
  // hai phía đều vướng (khoảng phía trên) thì bỏ nhãn — mũi tên đã đủ chỉ chiều thời gian. (cqw = % bề ngang sân khấu)
  const reach = (m: (typeof board.marks)[number]) => {
    const w = Math.max(m.label.length * 1.75, (m.vi?.length ?? 0) * 1.1);
    const a = X(m.to === undefined ? m.at : Math.min(m.at, m.to));
    const b = X(m.to === undefined ? m.at : Math.max(m.at, m.to));
    return [Math.min(a, (a + b) / 2 - w / 2), Math.max(b, (a + b) / 2 + w / 2)];
  };
  const side = (lo: number, hi: number) => {
    const hit = (down: boolean) => board.marks.some((m, k) => !m.now && k % 2 === (down ? 1 : 0) && (down || m.to !== undefined) && reach(m)[0] < hi && reach(m)[1] > lo);
    return !hit(true) ? "down" : !hit(false) ? "up" : null;
  };
  const ends = { left: side(19, 29), right: side(86, 97) };
  // nhãn khoảng phía trên trục cùng tầng với nhãn “now” → đẩy ngang cho khỏi đè lên “now”
  const hasNow = board.marks.some((m) => m.now);
  const nudge = (m: (typeof board.marks)[number]) => {
    if (!hasNow) return 0;
    const [lo, hi] = reach(m);
    const n0 = X(0) - 3.4;
    const n1 = X(0) + 3.4;
    if (hi <= n0 || lo >= n1) return 0;
    return (lo + hi) / 2 < X(0) ? n0 - hi : n1 - lo;
  };
  return (
    <div className="relative h-full">
      <div className="absolute top-[46%] right-[3%] left-[19%] h-[0.5cqw] rounded-full bg-[#9C7A54]" />
      <div className="absolute top-[46%] right-[1.5%] -translate-y-[42%] text-[2.8cqw] text-[#9C7A54]">▶</div>
      {ends.left && <div className={`absolute left-[19%] text-[2.1cqw] text-[#9C7A54] ${ends.left === "down" ? "top-[53%]" : "top-[39.5%]"}`}>quá khứ</div>}
      {ends.right && <div className={`absolute right-[3%] text-[2.1cqw] text-[#9C7A54] ${ends.right === "down" ? "top-[53%]" : "top-[39.5%]"}`}>tương lai</div>}
      {board.marks.map((m, k) => {
        const on = cue === k || (!!curText && has(curText, m.label));
        const up = k % 2 === 0;
        if (m.now)
          return (
            <div key={k} className="g-pop absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${X(0)}%`, top: "30%", animationDelay: `${k * 0.2}s` }}>
              <span className={`rounded-[0.8cqw] px-[1cqw] text-[3cqw] font-bold ${on ? "bg-amber-300/80" : "text-[#1d4ed8]"}`}>{m.label}</span>
              <span className="mt-[0.4cqh] h-[9cqh] w-[0.45cqw] rounded-full bg-[#1d4ed8]" />
              {showVi && m.vi && <span className="mt-[0.4cqh] text-[2.2cqw] text-[#1d4ed8]">{m.vi}</span>}
            </div>
          );
        if (m.to !== undefined) {
          const a = X(Math.min(m.at, m.to));
          const b = X(Math.max(m.at, m.to));
          return (
            <div key={k} className="g-in absolute" style={{ left: `${a}%`, width: `${b - a}%`, top: up ? "22%" : "50%", animationDelay: `${k * 0.2}s` }}>
              {!up && <div className={`mx-auto h-[1.6cqw] rounded-full ${m.wave ? "g-wave" : ""} ${on ? "bg-amber-400 text-amber-600" : "bg-[#C9A777] text-[#9C7A54]"}`} style={m.wave ? { backgroundColor: "transparent" } : undefined} />}
              <div className="flex flex-col items-center text-center whitespace-nowrap" style={up && nudge(m) ? { transform: `translateX(${nudge(m).toFixed(1)}cqw)` } : undefined}>
                <span className={`rounded-[0.8cqw] px-[1cqw] text-[3.4cqw] leading-tight font-bold ${on ? "bg-amber-300/80" : ""}`}>{m.label}</span>
                {showVi && m.vi && <span className={`text-[2.3cqw] ${MUTED}`}>{m.vi}</span>}
              </div>
              {up && <div className={`mx-auto mt-[0.6cqh] h-[1.6cqw] rounded-full ${m.wave ? "g-wave" : ""} ${on ? "bg-amber-400 text-amber-600" : "bg-[#C9A777] text-[#9C7A54]"}`} style={m.wave ? { backgroundColor: "transparent" } : undefined} />}
            </div>
          );
        }
        return (
          <div key={k} className="g-pop absolute flex -translate-x-1/2 flex-col items-center text-center whitespace-nowrap" style={{ left: `${X(m.at)}%`, top: up ? "16%" : "49%", animationDelay: `${k * 0.2}s` }}>
            {!up && <span className={`mb-[0.6cqh] size-[2.2cqw] rounded-full ${on ? "bg-amber-500" : "bg-[#9C7A54]"}`} />}
            <span className={`rounded-[0.8cqw] px-[1cqw] text-[3.4cqw] leading-tight font-bold ${on ? "bg-amber-300/80" : ""}`}>{m.label}</span>
            {showVi && m.vi && <span className={`text-[2.3cqw] ${MUTED}`}>{m.vi}</span>}
            {up && <span className={`mt-[0.6cqh] size-[2.2cqw] rounded-full ${on ? "bg-amber-500" : "bg-[#9C7A54]"}`} />}
          </div>
        );
      })}
      {cur?.k === "e" && (
        <div className="g-in absolute inset-x-[16%] bottom-0 text-center">
          <EnLine en={cur.en} ipa={cur.ipa} showIpa={showIpa} spans={cur.hl} hi={hi} board className={`text-[3.6cqw] ${showIpa ? "leading-[2]" : "leading-snug"}`} />
          {showVi && <div className={`text-[2.5cqw] ${MUTED}`}>{cur.vi}</div>}
        </div>
      )}
    </div>
  );
}

// Di chuyển từ: xếp theo `from` → tới cue đầu (hoặc ~40% đoạn) chuyển sang `to` bằng FLIP (khối cũ trượt tới chỗ mới,
// khối mới bật lên). Khớp khối theo chữ thường + thứ tự xuất hiện (You → you vẫn là một khối).
function MoveBoard({ from, to, cue, beat, register }: { from: string[]; to: string[]; cue: number; beat: GrammarLesson["beats"][number] | undefined; register: (f: ((t: number) => void) | null) => void }) {
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);
  useLayoutEffect(() => {
    register((t) => {
      if (!beat) return;
      const at = beat.k === "n" && beat.cues?.length ? beat.cues[0][1] - 0.1 : beat.start + (beat.end - beat.start) * 0.4;
      const p = t >= at ? 1 : 0;
      if (p !== phaseRef.current) {
        phaseRef.current = p;
        setPhase(p);
      }
    });
    return () => register(null);
  }, [beat, register]);
  const keyed = (arr: string[]) => {
    const seen: Record<string, number> = {};
    return arr.map((x) => {
      const k = x.toLowerCase();
      seen[k] = (seen[k] ?? 0) + 1;
      return { x, key: `${k}#${seen[k]}` };
    });
  };
  const items = keyed(phase ? to : from);
  const fromKeys = new Set(keyed(from).map((x) => x.key));
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    els.current.forEach((el, key) => {
      const now = el.getBoundingClientRect();
      const prev = rects.current.get(key);
      if (prev && (Math.abs(prev.left - now.left) > 1 || Math.abs(prev.top - now.top) > 1)) {
        el.style.transition = "none";
        el.style.transform = `translate(${prev.left - now.left}px, ${prev.top - now.top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 0.75s cubic-bezier(0.2, 0.8, 0.2, 1)";
          el.style.transform = "";
        });
      }
      rects.current.set(key, now);
    });
  }, [phase]);
  // câu dài → chữ nhỏ lại cho đỡ xuống nhiều dòng; dấu câu dính vào khối đứng trước (không rơi xuống dòng một mình)
  const len = Math.max(from.join(" ").length, to.join(" ").length);
  const fs = len > 44 ? 3.4 : len > 30 ? 3.9 : 4.4;
  const isPunct = (x: string) => /^[.,!?;:]+$/.test(x);
  const groups: { it: (typeof items)[number]; k: number }[][] = [];
  items.forEach((it, k) => {
    if (isPunct(it.x) && groups.length) groups[groups.length - 1].push({ it, k });
    else groups.push([{ it, k }]);
  });
  const chip = ({ it, k }: { it: (typeof items)[number]; k: number }) => {
    const isNew = phase === 1 && !fromKeys.has(it.key);
    return (
      <span
        key={it.key}
        ref={(el) => {
          if (el) els.current.set(it.key, el);
          else els.current.delete(it.key);
        }}
        className={
          isPunct(it.x)
            ? "font-bold"
            : `inline-flex items-center rounded-[1.2cqw] px-[1.4cqw] py-[0.7cqw] font-bold ${isNew ? "g-pop bg-amber-300/85" : "bg-[#E4ECF6]"} ${cue === k && phase ? "g-cue" : ""}`
        }
        style={{ fontSize: `${isPunct(it.x) ? fs + 0.2 : fs}cqw` }}
      >
        {it.x}
      </span>
    );
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[2cqh] pl-[14%]">
      <div className="flex flex-wrap items-end justify-center gap-[1.2cqw]">
        {groups.map((g) =>
          g.length === 1 ? (
            chip(g[0])
          ) : (
            <span key={`g-${g[0].it.key}`} className="inline-flex items-end whitespace-nowrap">
              {g.map(chip)}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
