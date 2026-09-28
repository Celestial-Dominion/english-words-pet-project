"use client";

// Sân trường miền Bắc sau trận tuyết: trời xám nhạt, dãy lớp học mái phủ tuyết, cây phủ tuyết,
// bông tuyết rơi; phía trước là bờ tuyết (mặt bờ = chỗ đặt người tuyết).
import { useId } from "react";
import type { Background } from "../assets";
import { rand, Tree } from "./parts";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B9CCDD" />
          <stop offset="1" stopColor="#EAF1F7" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      {/* dãy lớp học gạch đỏ, mái tuyết */}
      <rect x={300} y={250} width={1000} height={300} fill="#C9745E" />
      <path d="M 280 256 L 1320 256 L 1300 222 L 300 222 Z" fill="#FFFFFF" />
      <path d="M 280 256 C 400 272 520 262 640 270 C 800 278 1000 262 1320 256" stroke="#FFFFFF" strokeWidth={14} fill="none" />
      {[0, 1, 2, 3, 4, 5].map((c) =>
        [0, 1].map((r) => (
          <g key={`${c}-${r}`}>
            <rect x={350 + c * 160} y={300 + r * 120} width={90} height={70} rx={4} fill="#FFE9B0" />
            <rect x={346 + c * 160} y={292 + r * 120} width={98} height={10} rx={4} fill="#FFFFFF" />
          </g>
        )),
      )}
      <rect y={540} width={1600} height={360} fill="#F4F8FB" />
      <path d="M 0 560 Q 400 540 800 562 T 1600 552 L 1600 600 L 0 600 Z" fill="#E3ECF4" />
      <Tree x={170} y={600} s={1.2} snow />
      <Tree x={1450} y={604} s={1.1} snow />
      {/* bông tuyết rơi */}
      <g fill="#FFFFFF">
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={rand(i, 1) * 1600} cy={rand(i, 2) * 640} r={3 + rand(i, 3) * 5} opacity={0.75 + rand(i, 4) * 0.25} />
        ))}
      </g>
    </g>
  );
}

function Front() {
  return (
    <g>
      <path d="M -10 716 C 150 690 320 706 480 698 C 660 690 820 712 1000 700 C 1180 690 1360 710 1610 698 L 1610 900 L -10 900 Z" fill="#FFFFFF" />
      <path d="M -10 760 C 200 744 420 770 640 756 C 880 742 1120 772 1610 752 L 1610 900 L -10 900 Z" fill="#E8F0F7" />
      <path d="M 120 800 q 60 -14 120 0 M 700 820 q 80 -16 160 0 M 1300 796 q 60 -12 120 0" stroke="#D2DFEA" strokeWidth={6} fill="none" strokeLinecap="round" />
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
