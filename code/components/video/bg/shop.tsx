"use client";

// Cửa hàng có quầy phía trước (mặt quầy = chỗ đặt cân, lồng hấp…) — 2 biến thể:
// siêu thị (kệ hàng nhiều màu, đèn trần dài) và tiệm bánh bao (tường gạch men, lồng hấp chồng,
// đèn lồng đỏ, bảng giá bằng hình).
import type { Background } from "../assets";
import { rand } from "./parts";

const GOODS = ["#E5484D", "#4F8FD8", "#F2C14E", "#5DBB63", "#F08FB0", "#FFFFFF", "#E9A23B", "#8C7BC2"];

function SupermarketBack() {
  return (
    <g>
      <rect width={1600} height={900} fill="#F1F4F7" />
      {[160, 560, 960, 1360].map((x) => (
        <rect key={x} x={x - 120} y={20} width={240} height={18} rx={9} fill="#FFFFFF" stroke="#DDE3EA" strokeWidth={3} />
      ))}
      <rect x={0} y={70} width={1600} height={40} fill="#3E8E6A" />
      <g fill="#FFFFFF">
        <path d="M 780 80 L 800 80 L 810 100 L 836 100 L 842 86 L 806 86" stroke="#FFFFFF" strokeWidth={4} fill="none" />
        <circle cx={812} cy={104} r={4} />
        <circle cx={832} cy={104} r={4} />
      </g>
      {/* kệ hàng 3 tầng */}
      {[0, 1, 2].map((r) => {
        const y = 200 + r * 130;
        return (
          <g key={r}>
            <rect x={30} y={y + 90} width={1540} height={14} fill="#B5BDC7" />
            {Array.from({ length: 34 }, (_, i) => {
              const x = 44 + i * 45;
              const kind = rand(i, r + 1);
              const c = GOODS[Math.floor(rand(i, r + 9) * GOODS.length)];
              if (kind < 0.35)
                return (
                  <g key={i}>
                    <rect x={x + 8} y={y + 26} width={22} height={64} rx={6} fill={c} />
                    <rect x={x + 13} y={y + 12} width={12} height={16} rx={3} fill={c} />
                  </g>
                );
              if (kind < 0.7) return <rect key={i} x={x + 2} y={y + 30} width={36} height={60} rx={3} fill={c} />;
              return <rect key={i} x={x + 4} y={y + 50} width={34} height={40} rx={4} fill={c} />;
            })}
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x={70 + i * 130} y={y + 92} width={30} height={10} fill="#F2C14E" />
            ))}
          </g>
        );
      })}
      <rect y={600} width={1600} height={300} fill="#DDE3EA" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M ${i * 200} 600 L ${i * 200 - 60} 900`} stroke="#CBD3DC" strokeWidth={3} />
      ))}
    </g>
  );
}

function Counter({ top = 700, face = "#C3CCD6", stripe = "#3E8E6A", edge = "#EEF1F4" }: { top?: number; face?: string; stripe?: string; edge?: string }) {
  return (
    <g>
      <rect x={-10} y={top} width={1620} height={210} fill={face} />
      <rect x={-10} y={top - 8} width={1620} height={22} rx={6} fill={edge} />
      <rect x={-10} y={top + 40} width={1620} height={18} fill={stripe} />
      <rect x={-10} y={top + 12} width={1620} height={6} fill="#000" opacity={0.08} />
    </g>
  );
}

export const supermarket: Background = { back: () => <SupermarketBack />, front: () => <Counter /> };
