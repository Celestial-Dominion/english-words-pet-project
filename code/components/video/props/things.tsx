"use client";

// Đạo cụ nhóm ĐỒ VẬT (SVG, gốc = giữa đáy, đứng trên mặt bàn / quầy / lan can).
import type { Draw } from "../assets";

// Điện thoại dựng trên giá nhỏ (màn hình sáng — tin nhắn / video).
function Phone() {
  return (
    <g>
      <path d="M -34 0 L 34 0 L 20 -26 L -20 -26 Z" fill="#9AA5B4" />
      <g transform="rotate(-8 0 -80)">
        <rect x={-38} y={-150} width={76} height={136} rx={12} fill="#2F3A4A" />
        <rect x={-31} y={-140} width={62} height={112} rx={6} fill="#9FD3F5" />
        <rect x={-24} y={-130} width={36} height={14} rx={7} fill="#FFFFFF" />
        <rect x={-12} y={-110} width={36} height={14} rx={7} fill="#6CCB8B" />
        <rect x={-24} y={-90} width={30} height={14} rx={7} fill="#FFFFFF" />
        <circle cx={0} cy={-21} r={4} fill="#5B6676" />
      </g>
    </g>
  );
}

// Hộ chiếu đỏ dựng nghiêng, quốc huy vàng.
function Passport() {
  return (
    <g transform="rotate(-10 0 -48)">
      <rect x={-36} y={-100} width={72} height={100} rx={6} fill="#B3262E" />
      <rect x={-36} y={-100} width={10} height={100} rx={4} fill="#8F1C23" />
      <circle cx={4} cy={-58} r={18} fill="none" stroke="#F2C14E" strokeWidth={5} />
      <circle cx={4} cy={-58} r={6} fill="#F2C14E" />
      <rect x={-16} y={-88} width={40} height={6} rx={3} fill="#F2C14E" />
      <rect x={-16} y={-30} width={40} height={6} rx={3} fill="#F2C14E" />
    </g>
  );
}

// Sổ tay gáy xoắn dựng nghiêng.
function Notebook() {
  return (
    <g transform="rotate(6 0 -60)">
      <rect x={-50} y={-122} width={100} height={122} rx={8} fill="#6CB4EE" />
      <rect x={-38} y={-110} width={80} height={100} rx={4} fill="#FFFFFF" />
      {[-90, -70, -50, -30].map((y) => (
        <path key={y} d={`M -28 ${y} L 32 ${y}`} stroke="#CFE0EE" strokeWidth={4} />
      ))}
      {[-110, -90, -70, -50, -30, -12].map((y) => (
        <circle key={y} cx={-50} cy={y} r={6} fill="none" stroke="#5B6676" strokeWidth={4} />
      ))}
    </g>
  );
}

// Sách mở dựng hình chữ V.
function Book() {
  return (
    <g>
      <path d="M 0 -8 L -96 -26 L -96 -110 L 0 -92 Z" fill="#FFFFFF" stroke="#D6CBB8" strokeWidth={3} />
      <path d="M 0 -8 L 96 -26 L 96 -110 L 0 -92 Z" fill="#FFFDF6" stroke="#D6CBB8" strokeWidth={3} />
      <path d="M 0 0 L -104 -20 L -104 -30 L 0 -10 L 104 -30 L 104 -20 Z" fill="#E07B5F" />
      {[-80, -64, -48].map((y) => (
        <g key={y} stroke="#C9C1B2" strokeWidth={4} strokeLinecap="round">
          <path d={`M -80 ${y - 8} L -16 ${y + 4}`} />
          <path d={`M 16 ${y + 4} L 80 ${y - 8}`} />
        </g>
      ))}
    </g>
  );
}

function Basketball() {
  return (
    <g>
      <ellipse cx={0} cy={-2} rx={44} ry={8} fill="#000" opacity={0.12} />
      <circle cx={0} cy={-52} r={50} fill="#F08A2C" />
      <g stroke="#7A3A12" strokeWidth={4} fill="none">
        <path d="M -50 -52 L 50 -52" />
        <path d="M 0 -102 L 0 -2" />
        <path d="M -34 -88 C -12 -64 -12 -40 -34 -16" />
        <path d="M 34 -88 C 12 -64 12 -40 34 -16" />
      </g>
      <circle cx={-18} cy={-78} r={10} fill="#FFFFFF" opacity={0.25} />
    </g>
  );
}

// Nhiệt kế điện tử cắm trong cốc, màn hình 38.3.
function Thermometer() {
  return (
    <g>
      <path d="M -30 -60 L 30 -60 L 24 0 L -24 0 Z" fill="#E8F1F8" stroke="#C7D7E4" strokeWidth={3} />
      <g transform="rotate(12 0 -60)">
        <rect x={-12} y={-150} width={24} height={110} rx={12} fill="#FFFFFF" stroke="#C9D1DB" strokeWidth={3} />
        <rect x={-8} y={-134} width={16} height={34} rx={3} fill="#2F3A4A" />
        <text x={0} y={-111} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FF7B7B" fontFamily="monospace">
          38.3
        </text>
        <circle cx={0} cy={-44} r={9} fill="#E5484D" />
      </g>
    </g>
  );
}

// Tờ bảng số liệu kẹp trên bìa — một ô bị khoanh đỏ (số thừa một số 0).
function Report() {
  return (
    <g transform="rotate(-6 0 -80)">
      <rect x={-64} y={-160} width={128} height={160} rx={8} fill="#B98A5E" />
      <rect x={-54} y={-146} width={108} height={138} rx={3} fill="#FFFFFF" />
      <rect x={-20} y={-168} width={40} height={18} rx={4} fill="#9AA5B4" />
      {[0, 1, 2, 3, 4].map((r) => (
        <g key={r}>
          <path d={`M -46 ${-126 + r * 24} L 46 ${-126 + r * 24}`} stroke="#DDE3EA" strokeWidth={3} />
          <rect x={-44} y={-138 + r * 24} width={36} height={8} rx={3} fill="#9AA5B4" />
          <rect x={4} y={-138 + r * 24} width={r === 2 ? 42 : 30} height={8} rx={3} fill={r === 2 ? "#E5484D" : "#6B7686"} />
        </g>
      ))}
      <ellipse cx={24} cy={-86} rx={30} ry={13} fill="none" stroke="#E5484D" strokeWidth={4} />
    </g>
  );
}

function Laptop() {
  return (
    <g>
      <path d="M -120 0 L 120 0 L 100 -16 L -100 -16 Z" fill="#9AA5B4" />
      <rect x={-96} y={-150} width={192} height={134} rx={8} fill="#2F3A4A" />
      <rect x={-86} y={-140} width={172} height={114} rx={4} fill="#DCEBF8" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={-64 + i * 34} y={-40 - [30, 56, 40, 72][i]} width={22} height={[30, 56, 40, 72][i]} fill={i === 3 ? "#5B8DEF" : "#8FB3F2"} />
      ))}
    </g>
  );
}

function Camera() {
  return (
    <g>
      <rect x={-62} y={-84} width={124} height={80} rx={12} fill="#2F3A4A" />
      <rect x={-40} y={-98} width={40} height={18} rx={4} fill="#2F3A4A" />
      <circle cx={6} cy={-44} r={30} fill="#5B6676" />
      <circle cx={6} cy={-44} r={20} fill="#1B2330" />
      <circle cx={-2} cy={-52} r={6} fill="#FFFFFF" opacity={0.5} />
      <rect x={34} y={-76} width={18} height={10} rx={3} fill="#F2C14E" />
      <rect x={-62} y={-30} width={124} height={8} fill="#1F2733" />
    </g>
  );
}

const PROPS: Record<string, Draw> = {
  phone: () => <Phone />,
  passport: () => <Passport />,
  notebook: () => <Notebook />,
  book: () => <Book />,
  basketball: () => <Basketball />,
  thermometer: () => <Thermometer />,
  report: () => <Report />,
  laptop: () => <Laptop />,
  camera: () => <Camera />,
};
export default PROPS;
