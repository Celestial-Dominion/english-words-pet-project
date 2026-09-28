"use client";

// Vẹt biết nói (nhân vật không phải người, look.kind = "bird"): đậu trong lồng đặt trên mặt bàn.
// Cùng giao diện `apply(pose)` với Character: mỏ mở theo đường bao âm lượng, chớp mắt, đảo mắt
// về người nói, gật/lắc đầu, "cheer" = vỗ cánh. Gốc (0,0) = eo sân khấu (đáy lồng ngay dưới).
import { useImperativeHandle, useRef, type Ref } from "react";
import type { Expression } from "@/lib/video";
import type { CharacterHandle } from "./character";
import type { Look } from "./rig";

export function Parrot({
  look,
  x,
  baseY,
  facing,
  expression,
  ref,
}: {
  look: Look;
  x: number;
  baseY: number;
  facing: 1 | -1;
  expression: Expression;
  ref?: Ref<CharacterHandle>;
}) {
  const body = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const eye = useRef<SVGGElement>(null);
  const pupil = useRef<SVGCircleElement>(null);
  const jaw = useRef<SVGPathElement>(null);
  const wing = useRef<SVGPathElement>(null);
  const emote = useRef<SVGGElement>(null);
  const hy = look.headY + 150; // tâm đầu trong toạ độ thân (thân đặt tại y = -150)

  useImperativeHandle(
    ref,
    () => ({
      apply(p) {
        body.current?.setAttribute("transform", `translate(${p.bodyX.toFixed(1)} ${(-150 + p.bodyY).toFixed(2)})`);
        head.current?.setAttribute(
          "transform",
          `translate(${(p.headX * 0.8).toFixed(2)} ${(p.headY * 0.8).toFixed(2)}) rotate(${(p.headRot * 1.4).toFixed(2)} 0 ${hy + 30})`,
        );
        eye.current?.setAttribute("transform", `translate(0 ${(-8 * (1 - p.eyeOpen)).toFixed(2)}) scale(1 ${Math.max(0.08, p.eyeOpen).toFixed(3)})`);
        pupil.current?.setAttribute("transform", `translate(${(p.gazeX * 0.5).toFixed(2)} ${(p.gazeY * 0.5).toFixed(2)})`);
        jaw.current?.setAttribute("transform", `rotate(${(p.mouth * 28).toFixed(2)} 30 ${hy + 2})`);
        const flap = Math.max(0, Math.min(1, (-p.armR - 7) / 140));
        wing.current?.setAttribute("transform", `rotate(${(-70 * flap).toFixed(2)} -6 -26)`);
        emote.current?.setAttribute("transform", `translate(40 ${hy - 70}) scale(${p.emote.toFixed(3)})`);
      },
    }),
    [hy],
  );

  const e = expression;
  const emoteChar = e === "surprised" ? "!" : e === "confused" ? "?" : "";
  return (
    <g transform={`translate(${x} ${baseY}) scale(${facing * look.scale} ${look.scale})`}>
      {/* lồng: đế + nan (sau chim) */}
      <path d="M -110 -8 L -110 -250 C -110 -330 110 -330 110 -250 L 110 -8 Z" fill="#FFF8E8" opacity={0.35} />
      <rect x={-122} y={-14} width={244} height={16} rx={6} fill="#B98A5E" />
      <path d="M -60 -90 L 60 -90" stroke="#9C6B45" strokeWidth={10} strokeLinecap="round" />
      <g ref={body} transform="translate(0 -150)">
        <path d="M -30 40 L -52 118 L -26 112 L -14 46 Z" fill={look.topShade} />
        <ellipse cx={0} cy={0} rx={44} ry={62} fill={look.top} />
        <ellipse cx={10} cy={14} rx={26} ry={40} fill={look.collar} />
        <path ref={wing} d="M -6 -26 C -52 -20 -60 40 -30 70 C -16 40 -4 10 -6 -26 Z" fill={look.topShade} />
        <path d="M -8 58 L -12 64 M 12 58 L 14 64" stroke="#8A6A4A" strokeWidth={6} strokeLinecap="round" />
        <g ref={head}>
          <g transform={`translate(0 ${hy})`}>
            <circle cx={0} cy={0} r={40} fill={look.top} />
            <ellipse cx={12} cy={14} rx={14} ry={10} fill="#F28C28" opacity={0.8} />
            <g ref={eye}>
              <circle cx={12} cy={-8} r={12} fill="#FFFFFF" />
              <circle ref={pupil} cx={15} cy={-8} r={6} fill={look.iris} />
            </g>
            <path d="M 26 -14 C 52 -16 60 6 44 18 C 40 8 34 2 26 2 Z" fill="#3A3A3A" />
            <path ref={jaw} d="M 28 4 C 38 4 44 10 42 20 C 36 22 30 16 28 4 Z" fill="#555" />
            {e === "angry" && <path d="M 0 -22 L 22 -16" stroke="#2A1D1A" strokeWidth={4} strokeLinecap="round" />}
          </g>
          {emoteChar && (
            <g ref={emote} transform={`translate(40 ${hy - 70}) scale(0)`}>
              <g transform={`scale(${facing} 1)`}>
                <circle r={24} fill="#fff" stroke="#2A2A2A" strokeWidth={4} />
                <text y={11} textAnchor="middle" fontSize={32} fontWeight={800} fill={e === "surprised" ? "#E5484D" : "#3F7FCB"}>
                  {emoteChar}
                </text>
              </g>
            </g>
          )}
        </g>
      </g>
      {/* nan lồng phía trước */}
      <g stroke="#C9A36A" strokeWidth={5} fill="none">
        <path d="M -110 -8 L -110 -250 C -110 -330 110 -330 110 -250 L 110 -8" />
        {[-66, -22, 22, 66].map((xx) => (
          <path key={xx} d={`M ${xx} -8 L ${xx} ${-306 + Math.abs(xx) * 0.5}`} />
        ))}
        <path d="M -110 -200 L 110 -200" strokeWidth={4} />
      </g>
      <path d="M 0 -318 L 0 -346" stroke="#C9A36A" strokeWidth={6} />
      <circle cx={0} cy={-352} r={10} fill="none" stroke="#C9A36A" strokeWidth={5} />
    </g>
  );
}
