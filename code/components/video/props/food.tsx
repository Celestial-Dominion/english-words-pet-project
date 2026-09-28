"use client";

// Đạo cụ nhóm ĐỒ ĂN (SVG, gốc = giữa đáy, đứng trên mặt bàn / quầy).
import type { Draw } from "../assets";

// Tô mì sinh nhật (bát sứ trắng viền xanh, trứng ốp). `heap` > 1 = đầy ụ (cận cảnh "有点儿多").
export function Noodles({ heap = 1, overcooked = false }: { heap?: number; overcooked?: boolean }) {
  const top = -58 - 36 * heap;
  return (
    <g>
      <path d="M 44 -112 L 104 -30" stroke="#B7773A" strokeWidth={7} strokeLinecap="round" />
      <path d="M 58 -118 L 112 -40" stroke="#C98B4E" strokeWidth={7} strokeLinecap="round" />
      <path d={`M -70 -56 C -64 ${top} 64 ${top - 4} 72 -56 Z`} fill="#F4D58D" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M ${-56 + i * 30} -58 q 8 ${-14 * heap} 16 ${-4 * heap} t 16 ${-10 * heap}`}
          stroke="#E2B865"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      <ellipse cx={-6} cy={top + 18} rx={28} ry={17} fill="#FFFDF6" stroke={overcooked ? "#C98A4B" : "#EFE6D3"} strokeWidth={overcooked ? 6 : 3} />
      <circle cx={-6} cy={top + 17} r={10} fill={overcooked ? "#E58F16" : "#F6A21E"} />
      <circle cx={26} cy={top + 26} r={4} fill="#5DBB63" />
      <circle cx={-38} cy={top + 30} r={4} fill="#5DBB63" />
      <path d="M -80 -58 L 80 -58 C 76 -18 46 0 0 0 C -46 0 -76 -18 -80 -58 Z" fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      <path d="M -74 -40 C -40 -30 40 -30 74 -40" stroke="#5B8DEF" strokeWidth={7} fill="none" />
      <rect x={-30} y={-6} width={60} height={8} rx={3} fill="#E6E9F0" />
    </g>
  );
}

// Cái bánh chẻo (hình trăng khuyết có nếp gấp), tâm đáy (0,0).
function Tea() {
  return (
    <g>
      <ellipse cx={0} cy={-6} rx={56} ry={10} fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      <path d="M -36 -66 L 36 -66 L 30 -12 C 20 -4 -20 -4 -30 -12 Z" fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      <ellipse cx={0} cy={-66} rx={36} ry={8} fill="#C9A15C" />
      <path d="M -30 -46 C -10 -40 10 -40 30 -46" stroke="#6FB07A" strokeWidth={6} fill="none" />
      <g stroke="#B9C2CE" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8}>
        <path d="M -12 -84 q -10 -12 0 -24 q 10 -12 0 -24" />
        <path d="M 12 -80 q -10 -12 0 -24 q 10 -12 0 -24" />
      </g>
    </g>
  );
}

function Milk() {
  return (
    <g>
      <path d="M -30 -112 L 30 -112 L 24 -4 C 18 2 -18 2 -24 -4 Z" fill="#EAF4FB" stroke="#C7D7E4" strokeWidth={3} />
      <path d="M -27 -88 L 27 -88 L 24 -6 C 18 -1 -18 -1 -24 -6 Z" fill="#FFFFFF" />
      <ellipse cx={0} cy={-88} rx={27} ry={6} fill="#F7FAFC" stroke="#E3ECF3" strokeWidth={2} />
      <path d="M -16 -80 L -14 -20" stroke="#E3ECF3" strokeWidth={6} strokeLinecap="round" />
    </g>
  );
}

// Lồng hấp tre với 4 cái bánh bao trắng.
function FishDish() {
  return (
    <g>
      <ellipse cx={0} cy={-10} rx={112} ry={22} fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      <path d="M -70 -20 C -40 -52 40 -52 66 -20 C 40 -8 -40 -8 -70 -20 Z" fill="#E08A3C" />
      <path d="M 62 -20 L 98 -44 L 94 -20 L 98 2 Z" fill="#D3782D" />
      <circle cx={-48} cy={-26} r={5} fill="#2A1D1A" />
      <path d="M -20 -40 q 8 10 0 20 M 4 -42 q 8 10 0 20 M 28 -40 q 8 10 0 20" stroke="#C06A28" strokeWidth={4} fill="none" />
      <path d="M -30 -46 l 10 -12 M 10 -48 l 6 -14 M 40 -44 l 10 -10" stroke="#5DBB63" strokeWidth={6} strokeLinecap="round" />
    </g>
  );
}

function FriedEggs() {
  const egg = (x: number) => (
    <g key={x} transform={`translate(${x} -16)`}>
      <path d="M -40 0 C -44 -22 -10 -30 6 -22 C 30 -30 46 -10 38 2 C 30 12 -32 12 -40 0 Z" fill="#FFFFFF" stroke="#EFE6D3" strokeWidth={3} />
      <circle cx={0} cy={-8} r={13} fill="#F6A21E" />
      <circle cx={-4} cy={-12} r={4} fill="#FFD27A" />
    </g>
  );
  return (
    <g>
      <ellipse cx={0} cy={-8} rx={110} ry={20} fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      {egg(-44)}
      {egg(44)}
    </g>
  );
}

// Cân điện tử có rổ trứng (màn hình "2.00" kg — cân nhầm hai cân thành hai ký).
function Scale() {
  return (
    <g>
      <rect x={-86} y={-40} width={172} height={40} rx={10} fill="#E9EDF2" stroke="#C9D1DB" strokeWidth={3} />
      <rect x={-50} y={-32} width={100} height={24} rx={4} fill="#2F3A4A" />
      <text x={0} y={-13} textAnchor="middle" fontSize={20} fontWeight={700} fill="#7CF29A" fontFamily="monospace">
        2.00 kg
      </text>
      <rect x={-70} y={-52} width={140} height={12} rx={4} fill="#C9D1DB" />
      <path d="M -66 -52 L -54 -110 L 54 -110 L 66 -52 Z" fill="#D9A45E" />
      <path d="M -60 -70 L 60 -70 M -57 -90 L 57 -90" stroke="#C48A45" strokeWidth={4} />
      {[-38, -12, 14, 40, -24, 2, 28].map((x, i) => (
        <ellipse key={i} cx={x} cy={i < 4 ? -112 : -130} rx={15} ry={19} fill={i % 2 ? "#F4E3C8" : "#EFD7B3"} stroke="#D9BE96" strokeWidth={2} />
      ))}
    </g>
  );
}

const PROPS: Record<string, Draw> = {
  noodles: () => <Noodles />,
  tea: () => <Tea />,
  milk: () => <Milk />,
  "fish-dish": () => <FishDish />,
  "fried-eggs": () => <FriedEggs />,
  scale: () => <Scale />,
};
export default PROPS;
