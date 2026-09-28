"use client";

// Quảng trường / công viên ven hồ ban ngày: trời xanh, hồ có thuyền, lối đi, cột đèn; phía trước
// là hàng rào cây thấp (đồ lớn như xe đạp, giá tranh đặt `back` + `y` để đứng sau rào).
import { useId } from "react";
import type { Background } from "../assets";
import { Cloud, Tree } from "./parts";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86CBF2" />
          <stop offset="1" stopColor="#E2F5FD" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      <Cloud x={240} y={110} />
      <Cloud x={1320} y={140} s={0.8} />
      <circle cx={1450} cy={90} r={44} fill="#FFE27A" />
      {/* đồi xa + hồ */}
      <path d="M 0 420 Q 200 330 420 400 Q 640 320 880 396 Q 1120 330 1360 392 Q 1480 360 1600 380 L 1600 470 L 0 470 Z" fill="#9CCB86" />
      <rect y={440} width={1600} height={110} fill="#7CC3E6" />
      <path d="M 120 480 h 70 M 420 510 h 90 M 900 470 h 60 M 1180 500 h 90 M 1450 486 h 60" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={5} strokeLinecap="round" />
      <path d="M 980 470 L 1080 470 L 1064 490 L 996 490 Z" fill="#E07B5F" />
      <path d="M 1030 470 L 1030 420 L 1060 462 Z" fill="#FFFFFF" />
      {/* bãi cỏ + lối đi */}
      <rect y={540} width={1600} height={360} fill="#A8D98E" />
      <path d="M 520 540 L 1080 540 L 1320 900 L 280 900 Z" fill="#E9DDC4" />
      <Tree x={150} y={600} s={1.3} />
      <Tree x={1450} y={590} s={1.2} c="#63B363" />
      {/* cột đèn */}
      <rect x={1230} y={300} width={12} height={260} fill="#4A5563" />
      <path d="M 1206 300 L 1266 300 L 1256 270 L 1216 270 Z" fill="#4A5563" />
      <ellipse cx={1236} cy={304} rx={18} ry={8} fill="#FFF3C4" />
    </g>
  );
}

function Front() {
  return (
    <g>
      <path d="M -10 720 C 30 690 90 690 130 712 C 170 686 240 686 280 710 C 320 684 390 686 430 710 C 470 684 540 686 580 708 C 620 684 690 686 730 710 C 770 684 840 686 880 708 C 920 684 990 686 1030 710 C 1070 684 1140 686 1180 708 C 1220 684 1290 686 1330 710 C 1370 684 1440 686 1480 710 C 1520 686 1580 690 1610 712 L 1610 900 L -10 900 Z" fill="#5DAA5A" />
      <path d="M -10 780 L 1610 780 L 1610 900 L -10 900 Z" fill="#4E9A4C" />
      {[80, 360, 700, 1020, 1300, 1540].map((x) => (
        <circle key={x} cx={x} cy={740} r={10} fill="#F08FB0" />
      ))}
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
