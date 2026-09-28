"use client";

// Cổng trường đại học buổi trưa: trời xanh, toà nhà giảng đường, cổng trụ đá, cây hai bên;
// phía trước là bồn hoa xây thấp (mặt bồn = chỗ đặt đồ).
import { useId } from "react";
import type { Background } from "../assets";
import { Cloud, Tree } from "./parts";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7CC4F0" />
          <stop offset="1" stopColor="#D8F0FC" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      <Cloud x={260} y={120} s={1.1} />
      <Cloud x={1180} y={90} s={0.9} />
      <Cloud x={820} y={170} s={0.6} o={0.8} />
      {/* giảng đường */}
      <rect x={430} y={250} width={740} height={320} fill="#E9D8C0" />
      <rect x={430} y={236} width={740} height={22} fill="#C9B394" />
      <path d="M 700 250 L 800 180 L 900 250 Z" fill="#C9B394" />
      <circle cx={800} cy={222} r={20} fill="#F4E9D8" stroke="#B89C78" strokeWidth={5} />
      {[0, 1, 2, 3, 4, 5, 6].map((c) =>
        [0, 1, 2].map((r) => (
          <rect key={`${c}-${r}`} x={470 + c * 100} y={290 + r * 86} width={56} height={52} rx={4} fill="#9CC9E6" />
        )),
      )}
      {/* sân lát + thảm cỏ */}
      <rect y={560} width={1600} height={340} fill="#D9D4CC" />
      <path d="M 0 560 L 1600 560 L 1600 600 L 0 600 Z" fill="#9CCB86" />
      <path d="M 560 600 L 1040 600 L 1180 900 L 420 900 Z" fill="#E8E3DA" />
      <Tree x={330} y={590} s={1.15} />
      <Tree x={1270} y={590} s={1.1} c="#63B363" />
      {/* cổng trụ đá + xà ngang có huy hiệu */}
      <g>
        <rect x={60} y={120} width={120} height={600} fill="#B8B2A8" />
        <rect x={50} y={110} width={140} height={24} fill="#A39C91" />
        <rect x={1420} y={120} width={120} height={600} fill="#B8B2A8" />
        <rect x={1410} y={110} width={140} height={24} fill="#A39C91" />
        <rect x={60} y={40} width={1480} height={62} fill="#8E2F36" />
        <rect x={60} y={96} width={1480} height={10} fill="#6F222A" />
        <circle cx={800} cy={71} r={22} fill="#F2C14E" />
        <path d="M 788 71 L 812 71 M 800 59 L 800 83" stroke="#8E2F36" strokeWidth={5} />
        {[300, 520, 1080, 1300].map((x) => (
          <rect key={x} x={x - 60} y={62} width={120} height={18} rx={9} fill="#F2C14E" opacity={0.85} />
        ))}
      </g>
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={-10} y={708} width={1620} height={200} fill="#B7A896" />
      <rect x={-10} y={700} width={1620} height={18} rx={6} fill="#CFC2B0" />
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={`M ${i * 104 - 20} 740 L ${i * 104 + 70} 740`} stroke="#A7988A" strokeWidth={4} />
      ))}
      <g>
        {[
          [60, "#E5484D"],
          [120, "#FFD166"],
          [1480, "#F08FB0"],
          [1540, "#FFD166"],
        ].map(([x, c]) => (
          <g key={x as number}>
            <ellipse cx={x as number} cy={704} rx={54} ry={30} fill="#5DBB63" />
            <circle cx={(x as number) - 16} cy={690} r={9} fill={c as string} />
            <circle cx={(x as number) + 14} cy={694} r={9} fill={c as string} />
          </g>
        ))}
      </g>
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
