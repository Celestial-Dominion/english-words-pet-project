"use client";

// Sảnh đi quốc tế: vách kính lớn nhìn ra đường băng (máy bay đỗ), bảng giờ bay, trần khung
// thép; phía trước là bồn cây kiêm ghế dài (mặt bồn = chỗ đặt đồ).
import { useId } from "react";
import type { Background } from "../assets";

function Plane({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -220 0 C -220 -34 180 -40 230 -12 C 250 -2 236 22 210 22 L -210 22 C -222 22 -224 10 -220 0 Z" fill="#FFFFFF" />
      <path d="M -30 -4 L -120 -110 L -80 -110 L 60 -4 Z" fill="#5B8DEF" />
      <path d="M -200 -8 L -240 -90 L -206 -90 L -150 -8 Z" fill="#5B8DEF" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={-150 + i * 28} cy={-6} r={6} fill="#9AA5B4" />
      ))}
      <rect x={180} y={-18} width={30} height={16} rx={6} fill="#2F3A4A" />
    </g>
  );
}

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FCBF2" />
          <stop offset="1" stopColor="#E4F4FD" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="#E7EBF0" />
      {/* vách kính */}
      <rect x={0} y={60} width={1600} height={500} fill={`url(#${id}sky)`} />
      <rect x={0} y={420} width={1600} height={140} fill="#A7B1BC" />
      <path d="M 0 470 L 1600 470" stroke="#FFFFFF" strokeWidth={6} strokeDasharray="60 40" />
      <Plane x={560} y={420} s={1.2} />
      <g transform="translate(1260 170) rotate(-14) scale(0.4)">
        <Plane x={0} y={0} s={1} />
      </g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 200 - 6} y={60} width={12} height={500} fill="#8C98A6" />
      ))}
      <rect x={0} y={300} width={1600} height={10} fill="#8C98A6" />
      <rect x={0} y={40} width={1600} height={24} fill="#6B7686" />
      <path d="M 0 0 L 1600 0 L 1600 40 L 0 40 Z" fill="#D4DAE1" />
      {[100, 500, 900, 1300].map((x) => (
        <rect key={x} x={x} y={8} width={200} height={16} rx={8} fill="#FFFFFF" opacity={0.8} />
      ))}
      {/* bảng giờ bay */}
      <rect x={1160} y={330} width={380} height={170} rx={10} fill="#1F2733" />
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <rect x={1180} y={350 + r * 36} width={120} height={20} rx={4} fill="#3A4556" />
          <rect x={1316} y={350 + r * 36} width={96} height={20} rx={4} fill={r === 1 ? "#F2C14E" : "#3A4556"} />
          <circle cx={1500} cy={360 + r * 36} r={9} fill={r === 1 ? "#E5484D" : "#6CCB8B"} />
        </g>
      ))}
      <rect y={560} width={1600} height={340} fill="#C7CED6" />
      <path d="M 0 640 L 1600 640 M 0 740 L 1600 740" stroke="#B5BDC7" strokeWidth={4} />
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={-10} y={700} width={1620} height={210} fill="#6B7686" />
      <rect x={-10} y={692} width={1620} height={20} rx={8} fill="#9AA5B4" />
      <rect x={-10} y={760} width={1620} height={10} fill="#5B6676" />
      {[40, 1560].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={684} rx={70} ry={40} fill="#4FA955" />
          <ellipse cx={x + 30} cy={666} rx={40} ry={30} fill="#5DBB63" />
        </g>
      ))}
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
