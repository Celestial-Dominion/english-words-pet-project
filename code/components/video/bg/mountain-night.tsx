"use client";

// Đêm trên núi: trời đầy sao + dải Ngân Hà, trăng to vàng, dãy núi và rừng thông sẫm, căn nhà
// nghỉ sáng đèn; phía trước là sườn đá cỏ. Lớp phủ xanh nhẹ để nhân vật hoà vào ánh đêm.
import { useId } from "react";
import type { Background } from "../assets";
import { Pine, rand } from "./parts";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1233" />
          <stop offset="0.7" stopColor="#23305F" />
          <stop offset="1" stopColor="#3C3D72" />
        </linearGradient>
        <radialGradient id={`${id}moon`}>
          <stop offset="0.55" stopColor="#FFF1B8" stopOpacity={0.5} />
          <stop offset="1" stopColor="#FFF1B8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      <path d="M -40 360 C 300 200 700 180 1000 110 C 1250 50 1450 40 1660 0" stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={130} fill="none" />
      <g fill="#FFFFFF">
        {Array.from({ length: 130 }, (_, i) => {
          const r = rand(i, 3);
          return <circle key={i} cx={rand(i, 1) * 1600} cy={rand(i, 2) * 470} r={r > 0.93 ? 4.5 : r > 0.7 ? 3 : 1.8} opacity={0.55 + rand(i, 4) * 0.45} />;
        })}
      </g>
      {[
        [240, 120],
        [700, 70],
        [1060, 190],
      ].map(([x, y], i) => (
        <path key={i} d={`M ${x} ${y - 14} L ${x + 4} ${y - 4} L ${x + 14} ${y} L ${x + 4} ${y + 4} L ${x} ${y + 14} L ${x - 4} ${y + 4} L ${x - 14} ${y} L ${x - 4} ${y - 4} Z`} fill="#FFF6D0" />
      ))}
      <circle cx={1330} cy={150} r={130} fill={`url(#${id}moon)`} />
      <circle cx={1330} cy={150} r={64} fill="#FFE9A0" />
      <circle cx={1308} cy={134} r={10} fill="#F2D27A" />
      <circle cx={1350} cy={170} r={14} fill="#F2D27A" />
      {/* núi + rừng */}
      <path d="M 0 520 L 220 380 L 380 470 L 600 330 L 820 480 L 1040 360 L 1260 470 L 1440 390 L 1600 460 L 1600 620 L 0 620 Z" fill="#1E2A52" />
      <path d="M 0 580 L 180 500 L 420 560 L 700 480 L 980 560 L 1240 500 L 1600 560 L 1600 700 L 0 700 Z" fill="#17213F" />
      {[60, 150, 1380, 1470, 1550].map((x, i) => (
        <Pine key={x} x={x} y={640} s={1 + (i % 2) * 0.25} />
      ))}
      {/* nhà nghỉ sáng đèn */}
      <g transform="translate(300 560)">
        <path d="M -70 0 L -70 -70 L 0 -120 L 70 -70 L 70 0 Z" fill="#2B2F4A" />
        <rect x={-40} y={-60} width={34} height={30} fill="#FFD76A" />
        <rect x={10} y={-60} width={34} height={30} fill="#FFD76A" />
      </g>
    </g>
  );
}

function Front() {
  return (
    <g>
      <path d="M -10 716 C 200 700 380 720 560 706 C 760 692 960 716 1160 704 C 1340 694 1480 708 1610 700 L 1610 900 L -10 900 Z" fill="#23402F" />
      <path d="M -10 790 C 300 770 700 800 1100 780 C 1300 772 1480 786 1610 780 L 1610 900 L -10 900 Z" fill="#1B3326" />
      <g stroke="#2F5A40" strokeWidth={5} strokeLinecap="round">
        {[60, 240, 520, 830, 1120, 1400].map((x) => (
          <path key={x} d={`M ${x} 716 l -8 -22 M ${x + 10} 716 l 4 -26 M ${x + 20} 716 l 10 -18`} />
        ))}
      </g>
      <ellipse cx={1500} cy={730} rx={90} ry={34} fill="#3A4A58" />
      <ellipse cx={120} cy={740} rx={70} ry={26} fill="#3A4A58" />
    </g>
  );
}

// Ánh đêm: phủ xanh nhẹ lên cả người (vẫn đủ sáng để thấy nét mặt).
function Overlay() {
  return <rect width={1600} height={900} fill="#0B1640" opacity={0.16} pointerEvents="none" />;
}

const bg: Background = { back: () => <Back />, front: () => <Front />, overlay: () => <Overlay /> };
export default bg;
