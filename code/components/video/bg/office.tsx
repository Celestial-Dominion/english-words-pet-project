"use client";

// Văn phòng tầng cao buổi sáng: cửa kính nhìn ra thành phố, bảng trắng có biểu đồ, cây xanh,
// đồng hồ; phía trước là bàn làm việc dài màu sáng.
import { useId } from "react";
import type { Background } from "../assets";
import { LongTable } from "./parts";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9FD3F5" />
          <stop offset="1" stopColor="#E6F5FD" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="#E9EEF3" />
      <rect y={570} width={1600} height={330} fill="#D5DDE5" />
      <rect y={800} width={1600} height={100} fill="#9AA5B4" />
      {/* cửa kính thành phố */}
      <rect x={40} y={90} width={560} height={420} rx={8} fill="#FFFFFF" />
      <rect x={54} y={104} width={532} height={392} fill={`url(#${id}sky)`} />
      {[
        [70, 260, 90],
        [170, 200, 70],
        [250, 300, 110],
        [370, 180, 80],
        [460, 250, 100],
      ].map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={496 - y} fill={["#8FA7C0", "#7C94AE", "#A3B7CB", "#6F87A1", "#98ADC3"][i]} />
          {Array.from({ length: Math.floor((496 - y) / 40) }, (_, r) => (
            <rect key={r} x={x + 12} y={y + 16 + r * 40} width={w - 24} height={14} fill="#DCEBF8" opacity={0.7} />
          ))}
        </g>
      ))}
      <path d="M 320 104 L 320 496 M 54 300 L 586 300" stroke="#FFFFFF" strokeWidth={10} />
      {/* bảng trắng + biểu đồ */}
      <rect x={720} y={120} width={520} height={320} rx={10} fill="#FFFFFF" stroke="#C9D1DB" strokeWidth={8} />
      <path d="M 770 390 L 770 170 M 770 390 L 1200 390" stroke="#9AA5B4" strokeWidth={5} />
      <path d="M 790 360 L 880 320 L 960 340 L 1050 250 L 1160 210" stroke="#5B8DEF" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 790 380 L 880 360 L 960 350 L 1050 330 L 1160 300" stroke="#F2C14E" strokeWidth={8} fill="none" strokeLinecap="round" />
      {/* đồng hồ + cây */}
      <circle cx={1420} cy={170} r={46} fill="#FFFFFF" stroke="#6B7686" strokeWidth={7} />
      <path d="M 1420 170 L 1420 140 M 1420 170 L 1440 170" stroke="#2F3A4A" strokeWidth={6} strokeLinecap="round" />
      <g transform="translate(1450 600)">
        <path d="M -44 0 L 44 0 L 34 -70 L -34 -70 Z" fill="#E9EEF3" stroke="#B5BDC7" strokeWidth={4} />
        <path d="M 0 -70 C -60 -110 -70 -200 -40 -250 C -20 -190 -10 -140 0 -70 Z" fill="#4FA955" />
        <path d="M 0 -70 C 60 -120 80 -200 50 -260 C 30 -190 12 -140 0 -70 Z" fill="#5DBB63" />
        <path d="M 0 -70 C -10 -140 0 -230 10 -290 C 24 -220 20 -140 0 -70 Z" fill="#3E9A48" />
      </g>
    </g>
  );
}

const bg: Background = {
  back: () => <Back />,
  front: () => <LongTable wood="#D6DCE3" topColor="#F4F6F8" edge="#C3CBD4" legs="#9AA5B4" />,
};
export default bg;
