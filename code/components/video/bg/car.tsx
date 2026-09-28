"use client";

// Trong xe ô tô, nhìn qua kính chắn gió từ phía trước: hai ghế trước (tài xế bên PHẢI khung hình —
// ghế trái của xe), kính sau thấy đường; phía trước là táp-lô + vô-lăng + khung kính (trụ A, gương).
// Người: tài xế x≈1030, ghế phụ x≈570 (ghế sau: người đứng sau, cao hơn một chút — hạn chế dùng).
import { useId } from "react";
import type { Background } from "../assets";

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
      {/* ngoài xe (quanh khung) */}
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      <rect y={520} width={1600} height={380} fill="#8A929C" />
      {/* trong xe: trần, cửa sau, ghế */}
      <path d="M 180 120 Q 800 60 1420 120 L 1480 700 L 120 700 Z" fill="#5E6670" />
      <path d="M 520 150 Q 800 120 1080 150 L 1100 330 L 500 330 Z" fill={`url(#${id}sky)`} />
      <path d="M 500 290 L 1100 290 L 1100 330 L 500 330 Z" fill="#7C858F" />
      <path d="M 520 300 Q 640 280 760 296 L 760 330 L 520 330 Z" fill="#6DA66A" />
      <path d="M 840 294 Q 960 276 1080 300 L 1080 330 L 840 330 Z" fill="#6DA66A" />
      <rect x={180} y={330} width={1240} height={40} fill="#4A525C" />
      {/* lưng ghế trước + tựa đầu */}
      {[570, 1030].map((x) => (
        <g key={x}>
          <rect x={x - 70} y={200} width={140} height={110} rx={40} fill="#3B4250" />
          <rect x={x - 20} y={300} width={12} height={40} fill="#9AA5B4" />
          <rect x={x + 8} y={300} width={12} height={40} fill="#9AA5B4" />
          <rect x={x - 160} y={330} width={320} height={420} rx={70} fill="#434B59" />
        </g>
      ))}
    </g>
  );
}

function Front() {
  return (
    <g>
      {/* khung kính: trụ A hai bên + mép trần */}
      <path d="M 0 0 L 1600 0 L 1600 70 Q 800 30 0 70 Z" fill="#2F3540" />
      <path d="M 0 60 L 150 90 L 70 760 L 0 760 Z" fill="#2F3540" />
      <path d="M 1600 60 L 1450 90 L 1530 760 L 1600 760 Z" fill="#2F3540" />
      <rect x={740} y={50} width={120} height={46} rx={14} fill="#1F242C" />
      <rect x={752} y={58} width={96} height={30} rx={8} fill="#9FB6C8" />
      {/* táp-lô */}
      <path d="M 0 720 Q 800 640 1600 720 L 1600 900 L 0 900 Z" fill="#2B3038" />
      <path d="M 0 720 Q 800 640 1600 720" stroke="#454C57" strokeWidth={12} fill="none" />
      <rect x={740} y={700} width={120} height={60} rx={10} fill="#1C2027" />
      <rect x={752} y={710} width={96} height={34} rx={6} fill="#5B9BD5" opacity={0.7} />
      {/* vô-lăng trước ghế tài xế */}
      <g transform="translate(1030 770)">
        <circle r={150} fill="none" stroke="#1C2027" strokeWidth={30} />
        <path d="M -140 10 L 140 10 M 0 10 L 0 140" stroke="#1C2027" strokeWidth={30} />
        <circle r={40} fill="#1C2027" />
      </g>
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
