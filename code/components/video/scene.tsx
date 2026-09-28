"use client";

// Sân khấu SVG 16:9 của một bài Video: bối cảnh → đạo cụ phía sau → nhân vật → mép che
// (bàn, quầy…) → đạo cụ → bóng tối → bong bóng. React vẽ lại theo CÂU (idx); `update(t)` áp
// tư thế từng khung (gọi từ vòng requestAnimationFrame của player, hoặc sau mỗi lần vẽ lại khi
// đang tạm dừng/tua). Bối cảnh/đạo cụ/bong bóng tải lười theo bài (assets.ts).
import { memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from "react";
import { castOnStage, parseBubble, propVisible, sceneAt, speakersOf, type VideoLesson } from "@/lib/video";
import type { BackgroundId, LookId } from "@/lib/video-assets";
import { useSceneAssets, type BubbleCtx } from "./assets";
import { Bubble, BUBBLE_R } from "./bubbles";
import { Character, type CharacterHandle } from "./character";
import { Parrot } from "./parrot";
import { bubbleScale, callScale, charPose, facingOf, litAt, pointingSide, propPulse } from "./pose";
import { LOOKS, lookOf, STAGES } from "./rig";

// Ô gọi (người ở đầu dây — cast.call): góc trên trái nếu x < 800, không thì góc trên phải.
export const CALL_W = 430;
export const CALL_H = 290;
const CALL_M = 34;
const callBox = (x: number) => ({ x: x < 800 ? CALL_M : 1600 - CALL_M - CALL_W, y: CALL_M });

export interface SceneHandle {
  update(t: number): void;
}

// memo: player vẽ lại theo nhịp karaoke (~4 lần/giây) — cảnh chỉ cần vẽ lại khi đổi câu.
export const Scene = memo(function Scene({
  lesson,
  idx,
  getTime,
  ref,
}: {
  lesson: VideoLesson;
  idx: number;
  getTime: () => number;
  ref?: Ref<SceneHandle>;
}) {
  const assets = useSceneAssets(lesson);
  const stage = STAGES[lesson.scene.background as BackgroundId];
  const ids = useMemo(() => Object.keys(lesson.cast), [lesson]);
  const looks = useMemo(() => Object.fromEntries(ids.map((id) => [id, lookOf(lesson.cast[id])])), [ids, lesson]);
  const states = useMemo(() => sceneAt(lesson, idx), [lesson, idx]);
  const shown = useMemo(() => (lesson.scene.props ?? []).filter((p) => propVisible(p, idx)), [lesson, idx]);
  const svg = useRef<SVGSVGElement>(null);
  const chars = useRef<Record<string, CharacterHandle | null>>({});
  const props = useRef<Record<string, SVGGElement | null>>({});
  const glows = useRef<Record<string, SVGEllipseElement | null>>({});
  const bubble = useRef<SVGGElement>(null);
  const calls = useRef<Record<string, SVGGElement | null>>({});

  // Bong bóng của câu hiện tại: đặt trên đầu người nói, lệch vào giữa cảnh, đuôi chỉ về đầu.
  const line = lesson.lines[idx];
  const bub = useMemo(() => {
    if (!line?.thoughtBubble) return null;
    const { id, arg } = parseBubble(line.thoughtBubble);
    const sp = speakersOf(line)[0];
    const c = lesson.cast[sp];
    const look = looks[sp];
    const facing = facingOf(lesson, sp);
    const headTop = stage.baseY + (look.headY - 100) * look.scale;
    const bx = Math.max(BUBBLE_R + 20, Math.min(1600 - BUBBLE_R - 20, c.x + facing * 150));
    const by = Math.max(BUBBLE_R + 10, headTop - 34 - BUBBLE_R);
    const dx = c.x - bx;
    const dy = headTop - by;
    const n = Math.hypot(dx, dy) || 1;
    return { id, arg, bx, by, tx: dx / n, ty: dy / n };
  }, [line, lesson, stage, looks]);
  const ctx = useMemo<BubbleCtx>(
    () => ({ look: (who) => (lesson.cast[who] ? looks[who] : LOOKS[who as LookId]) }),
    [lesson, looks],
  );

  const handle = useMemo<SceneHandle>(
    () => ({
      update(t) {
        svg.current?.style.setProperty("--lit", litAt(lesson, t).toFixed(3));
        ids.forEach((id, i) => chars.current[id]?.apply(charPose(lesson, idx, t, states, id, i * 7 + 3)));
        for (const p of shown) {
          const k = propPulse(lesson, idx, t, p.id);
          const s = (p.scale ?? 1) * (1 + 0.14 * k);
          props.current[p.id]?.setAttribute("transform", `translate(${p.x} ${p.y ?? stage.tableTop}) scale(${s.toFixed(3)})`);
          glows.current[p.id]?.setAttribute("opacity", (k * 0.75).toFixed(2));
        }
        for (const id of ids) {
          const el = calls.current[id];
          if (!el) continue;
          const b = callBox(lesson.cast[id].x);
          const k = callScale(lesson, id, t);
          const cx = b.x + CALL_W / 2;
          el.setAttribute("transform", `translate(${cx} ${b.y}) scale(${k.toFixed(3)}) translate(${-cx} ${-b.y})`);
          el.setAttribute("opacity", Math.min(1, k * 1.6).toFixed(2));
        }
        if (bub && bubble.current)
          bubble.current.setAttribute("transform", `translate(${bub.bx} ${bub.by}) scale(${bubbleScale(lesson, idx, t).toFixed(3)})`);
      },
    }),
    [lesson, idx, states, ids, stage, bub, shown],
  );
  useImperativeHandle(ref, () => handle, [handle]);
  // Vẽ lại (đổi câu, tua khi đang dừng, asset vừa tải xong) → áp ngay tư thế đúng thời điểm hiện tại.
  useLayoutEffect(() => handle.update(getTime()));

  const opts = { weather: lesson.scene.weather };
  const prop = (p: (typeof shown)[number]) => (
    <g key={p.id}>
      <ellipse
        ref={(el) => void (glows.current[p.id] = el)}
        cx={p.x}
        cy={(p.y ?? stage.tableTop) - 40 * (p.scale ?? 1)}
        rx={120 * (p.scale ?? 1)}
        ry={90 * (p.scale ?? 1)}
        fill="#FFE08A"
        opacity={0}
      />
      <g ref={(el) => void (props.current[p.id] = el)} transform={`translate(${p.x} ${p.y ?? stage.tableTop}) scale(${p.scale ?? 1})`}>
        {assets?.props[p.id]?.()}
      </g>
    </g>
  );

  return (
    <svg
      ref={svg}
      viewBox="0 0 1600 900"
      className="block h-full w-full"
      style={{ ["--lit" as string]: 1 }}
      aria-hidden="true"
    >
      {assets && (
        <>
          {assets.bg.back(opts)}
          {shown.filter((p) => p.back).map(prop)}
          {ids.map((id) => {
            const c = lesson.cast[id];
            if (c.call || !castOnStage(c, idx)) return null;
            const common = {
              ref: (h: CharacterHandle | null) => void (chars.current[id] = h),
              look: looks[id],
              x: c.x,
              baseY: stage.baseY,
              facing: facingOf(lesson, id),
              expression: states[id]?.expression ?? "neutral",
            };
            return looks[id].kind === "bird" ? (
              <Parrot key={id} {...common} />
            ) : (
              <Character key={id} {...common} pointing={pointingSide(lesson, idx, id)} />
            );
          })}
          {assets.bg.front(opts)}
          {shown.filter((p) => !p.back).map(prop)}
          {assets.bg.overlay?.(opts)}
          {ids.map((id) => {
            const c = lesson.cast[id];
            if (!c.call || !castOnStage(c, idx)) return null;
            const b = callBox(c.x);
            const look = looks[id];
            const k = 0.6 / look.scale; // đầu cỡ như nhau với mọi preset
            const cbg = c.call.bg ? assets.callBgs[c.call.bg] : undefined;
            const cs = Math.max(CALL_W / 1600, CALL_H / 900);
            return (
              <g key={id} ref={(el) => void (calls.current[id] = el)} opacity={0}>
                <clipPath id={`call-${idx}-${ids.indexOf(id)}`}>
                  <rect x={b.x} y={b.y} width={CALL_W} height={CALL_H} rx={22} />
                </clipPath>
                <g clipPath={`url(#call-${idx}-${ids.indexOf(id)})`}>
                  <rect x={b.x} y={b.y} width={CALL_W} height={CALL_H} fill="#DCE8F2" />
                  {cbg && (
                    <g transform={`translate(${b.x + (CALL_W - 1600 * cs) / 2} ${b.y}) scale(${cs})`} style={{ ["--lit" as string]: 1 }}>
                      {cbg.back(opts)}
                    </g>
                  )}
                  <g transform={`translate(${b.x + CALL_W / 2} ${b.y + 100}) scale(${k})`}>
                    <Character
                      ref={(h: CharacterHandle | null) => void (chars.current[id] = h)}
                      look={look}
                      x={0}
                      baseY={-look.headY * look.scale}
                      facing={facingOf(lesson, id)}
                      expression={states[id]?.expression ?? "neutral"}
                    />
                  </g>
                </g>
                <rect x={b.x} y={b.y} width={CALL_W} height={CALL_H} rx={22} fill="none" stroke="#FFFFFF" strokeWidth={9} />
                <g transform={`translate(${b.x + CALL_W - 40} ${b.y + 40})`}>
                  <circle r={22} fill="#3BB273" />
                  <path d="M -9 -10 C -12 -2 -4 10 8 11 L 11 5 L 5 1 L 2 4 C -2 2 -4 -1 -5 -4 L -2 -7 L -5 -13 Z" fill="#FFFFFF" />
                </g>
              </g>
            );
          })}
          {bub && assets.bubbles[bub.id] && (
            <g key={`${idx}-${bub.id}`} ref={bubble} transform={`translate(${bub.bx} ${bub.by}) scale(0)`}>
              <Bubble draw={() => assets.bubbles[bub.id](bub.arg, ctx)} tx={bub.tx} ty={bub.ty} />
            </g>
          )}
        </>
      )}
    </svg>
  );
});
