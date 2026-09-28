"use client";

// Ngoài trời vùng quê — 2 biến thể dùng chung trời/đồi:
//  village: nhà tường trắng mái ngói xám, ruộng bậc thang, cây đa; phía trước là tường đá thấp có cỏ.
//  riverside: bờ sông — bờ bên kia có hàng liễu + nhà thấp, mặt nước gợn; phía trước là lan can đá
//             (dùng cho cả sông trong phố lẫn sông làng).
// Đèn tắt = đêm (phủ xanh thẫm, có trăng).
import { useId } from "react";
import type { Background } from "../assets";
import { Cloud, Tree } from "./parts";

const LIT = "var(--lit)";

function Sky({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86CBF2" />
          <stop offset="1" stopColor="#E6F6FD" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      <circle cx={1420} cy={110} r={46} fill="#FFE27A" />
      <Cloud x={260} y={120} />
      <Cloud x={980} y={90} s={0.75} />
      <path d="M 0 380 Q 180 250 380 340 Q 560 230 780 330 Q 1000 220 1220 320 Q 1420 250 1600 330 L 1600 480 L 0 480 Z" fill="#8DBF7E" />
      <path d="M 0 420 Q 240 350 480 410 Q 760 340 1040 404 Q 1320 350 1600 400 L 1600 500 L 0 500 Z" fill="#76AE68" />
    </g>
  );
}

function House({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-110} y={-120} width={220} height={120} fill="#F7F3EA" />
      <path d="M -134 -118 L -96 -176 L 96 -176 L 134 -118 Z" fill="#5B6270" />
      <path d="M -134 -118 L 134 -118" stroke="#454B57" strokeWidth={8} />
      <rect x={-30} y={-80} width={60} height={80} fill="#8A5A3C" />
      <rect x={-92} y={-90} width={40} height={36} fill="#BFE0F2" stroke="#8A5A3C" strokeWidth={4} />
      <rect x={52} y={-90} width={40} height={36} fill="#BFE0F2" stroke="#8A5A3C" strokeWidth={4} />
    </g>
  );
}

function Night() {
  return (
    <g style={{ opacity: `calc((1 - ${LIT}) * 0.8)` }} pointerEvents="none">
      <rect width={1600} height={900} fill="#0D1838" />
      <circle cx={1300} cy={120} r={40} fill="#FFF4C9" />
      <circle cx={1316} cy={108} r={36} fill="#0D1838" />
    </g>
  );
}

function VillageBack() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <Sky id={id} />
      <House x={330} y={500} s={0.9} />
      <House x={620} y={480} s={0.7} />
      <House x={1180} y={500} s={0.85} />
      {/* ruộng */}
      <rect y={500} width={1600} height={400} fill="#A7D48C" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M 0 ${530 + i * 40} Q 800 ${510 + i * 40} 1600 ${532 + i * 40}`} stroke="#8FC274" strokeWidth={5} fill="none" />
      ))}
      <path d="M 700 900 L 820 500 L 880 500 L 1000 900 Z" fill="#D8C9A6" />
      <Tree x={1450} y={620} s={1.5} c="#4F9D52" />
      <Tree x={120} y={600} s={1.1} />
    </g>
  );
}

function VillageFront() {
  return (
    <g>
      <path d="M -10 716 Q 400 700 800 712 Q 1200 700 1610 716 L 1610 900 L -10 900 Z" fill="#A69B8A" />
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <rect x={i * 120 - 10} y={726 + (i % 2) * 6} width={110} height={56} rx={16} fill="#B8AD9B" stroke="#8F8574" strokeWidth={4} />
          <rect x={i * 120 + 50} y={792} width={110} height={56} rx={16} fill="#B0A592" stroke="#8F8574" strokeWidth={4} />
        </g>
      ))}
      {[60, 420, 900, 1250, 1540].map((x) => (
        <path key={x} d={`M ${x} 722 l -12 -34 M ${x} 722 l 0 -40 M ${x} 722 l 12 -32`} stroke="#5DAA5A" strokeWidth={6} strokeLinecap="round" />
      ))}
    </g>
  );
}

function RiverBack() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <Sky id={id} />
      {/* bờ bên kia */}
      <rect y={440} width={1600} height={70} fill="#9CCB86" />
      <House x={360} y={470} s={0.55} />
      <House x={1240} y={466} s={0.6} />
      {[140, 560, 820, 1000, 1480].map((x) => (
        <g key={x} transform={`translate(${x} 470)`}>
          <rect x={-5} y={-80} width={10} height={80} fill="#8A5A3C" />
          <path d="M 0 -80 C -50 -60 -60 10 -46 30 M 0 -80 C -20 -50 -24 10 -16 36 M 0 -80 C 20 -50 24 10 16 36 M 0 -80 C 50 -60 60 10 46 30" stroke="#6DBB6A" strokeWidth={10} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* mặt sông */}
      <rect y={500} width={1600} height={400} fill="#6DB8DD" />
      {[
        [120, 560, 90],
        [420, 610, 120],
        [900, 540, 80],
        [1200, 590, 110],
        [1460, 640, 70],
        [700, 660, 90],
      ].map(([x, y, w], i) => (
        <path key={i} d={`M ${x} ${y} h ${w}`} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={5} strokeLinecap="round" />
      ))}
    </g>
  );
}

function RiverFront() {
  return (
    <g>
      <rect x={0} y={700} width={1600} height={200} fill="#C9C2B6" />
      <rect x={0} y={690} width={1600} height={20} rx={6} fill="#E2DCD2" />
      {Array.from({ length: 21 }, (_, i) => (
        <rect key={i} x={i * 80 - 6} y={640} width={22} height={56} rx={4} fill="#E2DCD2" stroke="#BDB5A8" strokeWidth={3} />
      ))}
      <rect x={0} y={630} width={1600} height={16} rx={6} fill="#E9E4DB" stroke="#BDB5A8" strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d={`M ${i * 140} 760 L ${i * 140 + 120} 760 M ${i * 140 + 60} 820 L ${i * 140 + 180} 820`} stroke="#B5AD9F" strokeWidth={4} />
      ))}
    </g>
  );
}

export const village: Background = { back: () => <VillageBack />, front: () => <VillageFront />, overlay: () => <Night /> };
export const riverside: Background = { back: () => <RiverBack />, front: () => <RiverFront />, overlay: () => <Night /> };
