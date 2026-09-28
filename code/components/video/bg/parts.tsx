"use client";

// Chi tiết vẽ dùng chung giữa các bối cảnh (mây, cây, kệ sách, bàn dài…). Module này chỉ được
// các bối cảnh import → nằm trong chunk chung của chúng, không vào chunk trang.

// Số giả ngẫu nhiên tất định (vị trí sao, màu gáy sách…) — cùng đầu vào luôn cùng hình.
export function rand(i: number, k = 1): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function Cloud({ x, y, s = 1, o = 0.95 }: { x: number; y: number; s?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFFFF" opacity={o}>
      <ellipse cx={0} cy={0} rx={70} ry={26} />
      <ellipse cx={-34} cy={-14} rx={36} ry={24} />
      <ellipse cx={22} cy={-22} rx={40} ry={30} />
    </g>
  );
}

// Cây tán tròn; `snow` = phủ tuyết.
export function Tree({ x, y, s = 1, snow = false, c = "#6DBB6A" }: { x: number; y: number; s?: number; snow?: boolean; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-12} y={-120} width={24} height={120} rx={6} fill="#8A5A3C" />
      <circle cx={0} cy={-170} r={80} fill={snow ? "#8FA3A8" : c} />
      <circle cx={-50} cy={-130} r={50} fill={snow ? "#9DB1B6" : c} />
      <circle cx={50} cy={-126} r={52} fill={snow ? "#9DB1B6" : c} />
      {snow ? (
        <g fill="#FFFFFF">
          <path d="M -76 -196 C -60 -240 60 -246 78 -196 C 40 -214 -30 -214 -76 -196 Z" />
          <ellipse cx={-52} cy={-168} rx={36} ry={12} />
          <ellipse cx={52} cy={-164} rx={38} ry={12} />
        </g>
      ) : (
        <circle cx={-24} cy={-196} r={26} fill="#FFFFFF" opacity={0.12} />
      )}
    </g>
  );
}

export function Pine({ x, y, s = 1, c = "#12304A" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
      <rect x={-6} y={-30} width={12} height={30} />
      <path d="M 0 -200 L 50 -110 L 26 -110 L 64 -30 L -64 -30 L -26 -110 L -50 -110 Z" />
    </g>
  );
}

const BOOK_COLORS = ["#E07B5F", "#5E9E7A", "#4F8FD8", "#E9A23B", "#8C7BC2", "#D65A7E", "#3A8E8B", "#C98B57", "#6C7A89"];

// Một hàng gáy sách trên kệ: từ x0 tới x1, đáy ở y, cao ~h.
export function BookRow({ x0, x1, y, h = 70, seed = 1 }: { x0: number; x1: number; y: number; h?: number; seed?: number }) {
  const out = [];
  let x = x0;
  let i = 0;
  while (x < x1 - 14) {
    const w = 16 + Math.floor(rand(i, seed) * 14);
    const hh = h * (0.72 + rand(i, seed + 7) * 0.28);
    const tilt = rand(i, seed + 3) > 0.93;
    out.push(
      <rect
        key={i}
        x={x}
        y={y - hh}
        width={w}
        height={hh}
        rx={2}
        fill={BOOK_COLORS[Math.floor(rand(i, seed + 5) * BOOK_COLORS.length)]}
        transform={tilt ? `rotate(8 ${x + w} ${y})` : undefined}
      />,
    );
    x += w + 3;
    i++;
  }
  return <g>{out}</g>;
}

// Bàn dài phía trước (mép che nửa dưới nhân vật), mặt bàn ở y = top.
export function LongTable({ top = 690, wood = "#C98B57", topColor = "#E7B98B", edge = "#B97C49", legs = "#A8703F" }: { top?: number; wood?: string; topColor?: string; edge?: string; legs?: string }) {
  return (
    <g>
      <rect x={210} y={top + 110} width={34} height={200} fill={legs} />
      <rect x={1356} y={top + 110} width={34} height={200} fill={legs} />
      <path d={`M 230 ${top} L 1370 ${top} L 1430 ${top + 52} L 170 ${top + 52} Z`} fill={topColor} />
      <rect x={170} y={top + 50} width={1260} height={62} rx={6} fill={wood} />
      <rect x={170} y={top + 50} width={1260} height={8} fill={edge} />
    </g>
  );
}
