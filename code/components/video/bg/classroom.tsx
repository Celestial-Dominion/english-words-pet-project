"use client";

// Lớp học tiểu học: bảng đen lớn giữa tường (hình vẽ phấn là đạo cụ `board-bird` đặt `back`),
// cửa sổ nắng bên trái, đồng hồ; phía trước là bàn giáo viên dài.
import type { Background } from "../assets";
import { LongTable } from "./parts";

function Back() {
  return (
    <g>
      <rect width={1600} height={900} fill="#EEF0DE" />
      <rect y={560} width={1600} height={340} fill="#DCE0C4" />
      <rect y={556} width={1600} height={10} fill="#C4C9A6" />
      <rect y={800} width={1600} height={100} fill="#C9976A" />
      {/* cửa sổ */}
      <rect x={30} y={120} width={250} height={330} rx={10} fill="#FFFFFF" />
      <rect x={44} y={134} width={222} height={302} rx={6} fill="#BFE4F7" />
      <circle cx={210} cy={190} r={26} fill="#FFE27A" />
      <path d="M 44 380 Q 120 340 180 372 T 266 360 L 266 436 L 44 436 Z" fill="#9FD39A" />
      <rect x={150} y={134} width={10} height={302} fill="#FFFFFF" />
      <rect x={44} y={280} width={222} height={10} fill="#FFFFFF" />
      {/* bảng đen + khay phấn */}
      <rect x={370} y={100} width={860} height={380} rx={8} fill="#A8703F" />
      <rect x={388} y={118} width={824} height={344} rx={4} fill="#2F5A48" />
      <path d="M 420 160 q 60 -10 120 0" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={5} fill="none" strokeLinecap="round" />
      <rect x={360} y={478} width={880} height={16} rx={6} fill="#8A5A3C" />
      <rect x={620} y={470} width={30} height={10} rx={3} fill="#FFFFFF" />
      <rect x={670} y={470} width={24} height={10} rx={3} fill="#FFD166" />
      {/* đồng hồ + bảng tin */}
      <circle cx={1380} cy={170} r={50} fill="#FFFFFF" stroke="#6B7686" strokeWidth={8} />
      <path d="M 1380 170 L 1380 138 M 1380 170 L 1402 182" stroke="#2F3A4A" strokeWidth={6} strokeLinecap="round" />
      <rect x={1300} y={270} width={220} height={170} rx={8} fill="#E8C9A0" />
      <rect x={1318} y={288} width={80} height={60} fill="#FFFFFF" transform="rotate(-4 1358 318)" />
      <rect x={1414} y={292} width={86} height={64} fill="#FFE9A0" transform="rotate(3 1457 324)" />
      <rect x={1330} y={366} width={150} height={56} fill="#CFE8F2" />
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <LongTable wood="#B98552" topColor="#E3B887" edge="#A8743F" /> };
export default bg;
