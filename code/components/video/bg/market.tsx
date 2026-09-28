"use client";

// Chợ rau buổi sáng: mái bạt sọc, sạp phía sau chất rau quả, bóng đèn treo; phía trước là SẠP của
// người bán (mặt sạp đầy rau, cà chua, cà rốt) — người bán / khách đứng sau sạp.
import type { Background } from "../assets";
import { rand } from "./parts";

const VEG = ["#5DBB63", "#E5484D", "#F28C28", "#8BC34A", "#F2C14E", "#8C4FB8"];

function Pile({ x, y, n, seed, r = 16 }: { x: number; y: number; n: number; seed: number; r?: number }) {
  const c = VEG[seed % VEG.length];
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const row = i < n * 0.55 ? 0 : i < n * 0.85 ? 1 : 2;
        const k = row === 0 ? i : row === 1 ? i - Math.ceil(n * 0.55) : i - Math.ceil(n * 0.85);
        const w = row === 0 ? Math.ceil(n * 0.55) : row === 1 ? Math.ceil(n * 0.3) : 2;
        const cx = x + (k - (w - 1) / 2) * r * 1.8 + (rand(i, seed) - 0.5) * 4;
        return <circle key={i} cx={cx} cy={y - r - row * r * 1.5} r={r} fill={c} stroke="#00000022" strokeWidth={2} />;
      })}
    </g>
  );
}

function Back() {
  return (
    <g>
      <rect width={1600} height={900} fill="#F3E9DA" />
      <rect y={600} width={1600} height={300} fill="#CFC3AF" />
      {/* mái bạt sọc */}
      {[0, 1, 2, 3].map((k) => (
        <g key={k}>
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={k * 400 + i * 50} y={40} width={50} height={120} fill={i % 2 ? "#FFFFFF" : k % 2 ? "#3E8E6A" : "#D9534F"} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M ${k * 400 + i * 50} 160 q 25 30 50 0 Z`} fill={i % 2 ? "#FFFFFF" : k % 2 ? "#3E8E6A" : "#D9534F"} />
          ))}
        </g>
      ))}
      {[200, 600, 1000, 1400].map((x) => (
        <g key={x}>
          <path d={`M ${x} 190 L ${x} 240`} stroke="#5B5048" strokeWidth={3} />
          <circle cx={x} cy={252} r={14} fill="#FFE9A0" />
        </g>
      ))}
      {/* sạp phía sau */}
      {[0, 1, 2, 3].map((k) => (
        <g key={k}>
          <rect x={30 + k * 400} y={430} width={340} height={170} fill="#B98A5E" />
          <rect x={30 + k * 400} y={420} width={340} height={16} fill="#9C6B45" />
          {[0, 1, 2].map((j) => (
            <rect key={j} x={46 + k * 400 + j * 110} y={360} width={96} height={64} rx={4} fill="#D9B98C" stroke="#9C6B45" strokeWidth={3} />
          ))}
          {[0, 1, 2].map((j) => (
            <Pile key={j} x={94 + k * 400 + j * 110} y={372} n={6} seed={k * 3 + j} r={11} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={0} y={700} width={1600} height={20} fill="#9C6B45" />
      <rect x={0} y={718} width={1600} height={182} fill="#B98A5E" />
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={`M ${i * 100} 718 L ${i * 100} 900`} stroke="#A8784E" strokeWidth={4} />
      ))}
      {/* rau quả trên mặt sạp: để chừa giữa sạp trống cho đạo cụ (cân, túi…) */}
      <Pile x={110} y={706} n={9} seed={0} />
      <Pile x={300} y={706} n={9} seed={1} />
      <Pile x={1300} y={706} n={9} seed={2} />
      <Pile x={1490} y={706} n={9} seed={4} />
      <g transform="translate(1400 640)">
        <rect x={-34} y={-44} width={68} height={50} rx={4} fill="#FFFFFF" stroke="#6B4E2E" strokeWidth={3} />
        <text y={-10} textAnchor="middle" fontSize={26} fontWeight={800} fill="#E5484D" fontFamily="system-ui, sans-serif">
          3.5
        </text>
        <path d="M 0 6 L 0 60" stroke="#6B4E2E" strokeWidth={4} />
      </g>
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
