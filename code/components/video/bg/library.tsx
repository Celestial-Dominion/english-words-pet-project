"use client";

// Thư viện trường: kệ sách gỗ kín tường, cửa sổ cao, đèn thả; phía trước là bàn đọc dài có
// đèn bàn xanh ở đầu bàn. --lit: 1 = ban ngày; 0 = chạng vạng (trời ngoài cửa sổ sẫm lại, phòng
// tối dần, đèn bàn toả sáng) — dùng `lights=off fade=…` trong bài.
import { useId } from "react";
import type { Background } from "../assets";
import { BookRow, LongTable } from "./parts";

const DARK = "calc(1 - var(--lit))";

function Shelf({ x, w, seed }: { x: number; w: number; seed: number }) {
  return (
    <g>
      <rect x={x} y={90} width={w} height={480} fill="#7A4E32" />
      <rect x={x + 12} y={102} width={w - 24} height={456} fill="#5E3B26" />
      {[190, 290, 390, 490].map((y, i) => (
        <g key={y}>
          <BookRow x0={x + 16} x1={x + w - 16} y={y} h={82} seed={seed * 10 + i} />
          <rect x={x + 12} y={y} width={w - 24} height={12} fill="#8A5A3C" />
        </g>
      ))}
    </g>
  );
}

function Back() {
  return (
    <g>
      <rect width={1600} height={900} fill="#EFE3CF" />
      <rect y={570} width={1600} height={330} fill="#D9C4A4" />
      <rect y={800} width={1600} height={100} fill="#A9774E" />
      <Shelf x={30} w={460} seed={1} />
      <Shelf x={1110} w={460} seed={2} />
      {/* cửa sổ cao giữa */}
      <rect x={600} y={80} width={400} height={400} rx={200} fill="#FFFFFF" />
      <rect x={618} y={98} width={364} height={382} rx={182} fill="#CDEAF7" />
      <path d="M 800 98 L 800 480 M 618 300 L 982 300" stroke="#FFFFFF" strokeWidth={12} />
      <path d="M 640 440 Q 720 400 800 430 T 960 420 L 960 480 L 640 480 Z" fill="#A8D98E" />
      {/* chạng vạng: trời ngoài cửa sổ chuyển xanh sẫm */}
      <g style={{ opacity: DARK }}>
        <rect x={618} y={98} width={364} height={382} rx={182} fill="#2B3A67" />
        <circle cx={900} cy={170} r={20} fill="#F4E7B0" />
      </g>
      <path d="M 800 98 L 800 480 M 618 300 L 982 300" stroke="#FFFFFF" strokeWidth={12} style={{ opacity: DARK }} />
      {[640, 960].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={0} width={6} height={80} fill="#6B5B4B" />
          <path d={`M ${x - 40} 110 Q ${x} 60 ${x + 40} 110 Z`} fill="#3E8E6A" />
        </g>
      ))}
    </g>
  );
}

function Front() {
  return (
    <g>
      <LongTable wood="#8A5A3C" topColor="#B8875A" edge="#7A4E32" legs="#6E452C" />
      <g transform="translate(250 692)">
        <path d="M -40 0 L 40 0 L 30 -10 L -30 -10 Z" fill="#2F3A4A" />
        <rect x={-4} y={-90} width={8} height={82} fill="#C9A36A" />
        <path d="M -54 -84 C -50 -124 50 -124 54 -84 Z" fill="#2E7D5B" />
        <ellipse cx={0} cy={-84} rx={54} ry={8} fill="#FFF3C4" />
      </g>
    </g>
  );
}

// Phòng tối dần (vẫn thấy người), chừa quầng sáng quanh đèn bàn.
function Overlay() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g style={{ opacity: DARK }} pointerEvents="none">
      <defs>
        <radialGradient id={`${id}lamp`} cx="250" cy="640" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFE8A3" stopOpacity={0.55} />
          <stop offset="1" stopColor="#FFE8A3" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1600} height={900} fill="#1B2240" opacity={0.42} />
      <rect width={1600} height={900} fill={`url(#${id}lamp)`} />
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front />, overlay: () => <Overlay /> };
export default bg;
