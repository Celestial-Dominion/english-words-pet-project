"use client";

// Đạo cụ nhóm CÂY / CON VẬT / ĐỒ LỚN (SVG, gốc = giữa đáy). Đồ lớn (xe đạp, giá vẽ, hình trên
// bảng) thường đặt `back` + `y` riêng trong scene.props để đứng sau mép che phía trước.
import type { Draw } from "../assets";

// Bó hoa đỏ gói giấy xanh cắm trong bình.
function Flowers() {
  const bloom = (cx: number, cy: number, k: number) => (
    <g key={k} transform={`translate(${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 12} cy={Math.sin((a * Math.PI) / 180) * 12} r={12} fill="#E5484D" />
      ))}
      <circle r={7} fill="#FFD166" />
    </g>
  );
  return (
    <g>
      <path d="M -44 -150 C -60 -186 -40 -210 -24 -196 L -12 -150 Z" fill="#5DBB63" />
      <path d="M 44 -150 C 62 -186 44 -212 26 -198 L 12 -150 Z" fill="#4FA955" />
      {bloom(-26, -176, 0)}
      {bloom(2, -198, 1)}
      {bloom(28, -174, 2)}
      {bloom(-6, -160, 3)}
      <path d="M -50 -152 L 50 -152 L 16 -40 L -16 -40 Z" fill="#7BC67E" />
      <path d="M -50 -152 L 0 -136 L 50 -152" stroke="#63B067" strokeWidth={4} fill="none" />
      <path d="M -12 -70 l -18 -10 l 4 18 Z M 12 -70 l 18 -10 l -4 18 Z" fill="#F08FB0" />
      <circle cx={0} cy={-70} r={7} fill="#F08FB0" />
      <path d="M -26 0 C -36 -16 -32 -42 -18 -50 L 18 -50 C 32 -42 36 -16 26 0 Z" fill="#FFFFFF" stroke="#D8D2C8" strokeWidth={3} />
    </g>
  );
}

// Nắm hoa dại nhỏ (vàng là chính) trong lọ thuỷ tinh.
function Wildflowers() {
  const f = (x: number, y: number, c: string, k: number) => (
    <g key={k} transform={`translate(${x} ${y})`}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 8} cy={Math.sin((a * Math.PI) / 180) * 8} r={7} fill={c} />
      ))}
      <circle r={5} fill="#F59E0B" />
    </g>
  );
  return (
    <g>
      <g stroke="#5DBB63" strokeWidth={4} fill="none" strokeLinecap="round">
        <path d="M -6 -60 Q -20 -100 -34 -130" />
        <path d="M 0 -60 Q 4 -110 6 -150" />
        <path d="M 6 -60 Q 24 -100 36 -124" />
        <path d="M -2 -60 Q -8 -100 -12 -110" />
        <path d="M 4 -60 Q 14 -90 20 -100" />
      </g>
      {f(-34, -134, "#FFD84D", 0)}
      {f(6, -154, "#FFD84D", 1)}
      {f(36, -128, "#FFD84D", 2)}
      {f(-12, -112, "#FFFFFF", 3)}
      {f(20, -102, "#FFE27A", 4)}
      <path d="M -30 0 L -34 -62 L 34 -62 L 30 0 Z" fill="#DDF1F7" fillOpacity={0.8} stroke="#B9DCE8" strokeWidth={3} />
      <path d="M -31 -30 L 31 -30 L 30 0 L -30 0 Z" fill="#9FD3E8" fillOpacity={0.7} />
    </g>
  );
}

// Bình cá tròn: 3 chú cá cam + rong.
function Fishbowl() {
  const fish = (x: number, y: number, s: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={16} ry={10} fill="#F28C28" />
      <path d="M 14 0 L 26 -9 L 26 9 Z" fill="#F28C28" />
      <circle cx={-7} cy={-2} r={2.5} fill="#2A1D1A" />
    </g>
  );
  return (
    <g>
      <path d="M -60 -150 C -110 -130 -110 -20 -50 0 L 50 0 C 110 -20 110 -130 60 -150 Z" fill="#DDF1F7" fillOpacity={0.9} stroke="#A9D2E0" strokeWidth={4} />
      <path d="M -92 -96 C -96 -40 -76 -10 -50 -2 L 50 -2 C 76 -10 96 -40 92 -96 Z" fill="#8FD0EA" fillOpacity={0.8} />
      <path d="M -30 -4 C -40 -30 -20 -50 -34 -70 M -16 -4 C -10 -26 -24 -40 -12 -58" stroke="#4FA955" strokeWidth={6} fill="none" strokeLinecap="round" />
      {fish(20, -56, 1, 0)}
      {fish(-40, -36, 0.8, 1)}
      {fish(44, -26, 0.7, 2)}
      <ellipse cx={0} cy={-150} rx={62} ry={9} fill="none" stroke="#A9D2E0" strokeWidth={4} />
      <path d="M -70 -120 C -80 -90 -78 -60 -66 -40" stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

// Xe đạp xanh lá (nhìn ngang). Gốc = điểm chạm đất giữa hai bánh.
function Bike() {
  const wheel = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy={-80} r={78} fill="none" stroke="#2F3A4A" strokeWidth={12} />
      <circle cx={cx} cy={-80} r={8} fill="#5B6676" />
      {[0, 45, 90, 135].map((a) => (
        <path
          key={a}
          d={`M ${cx + Math.cos((a * Math.PI) / 180) * 70} ${-80 + Math.sin((a * Math.PI) / 180) * 70} L ${cx - Math.cos((a * Math.PI) / 180) * 70} ${-80 - Math.sin((a * Math.PI) / 180) * 70}`}
          stroke="#9AA5B4"
          strokeWidth={3}
        />
      ))}
    </g>
  );
  return (
    <g>
      {wheel(-120)}
      {wheel(120)}
      <g stroke="#3BB273" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M -120 -80 L -30 -80 L 70 -196 L -50 -196 Z" />
        <path d="M -30 -80 L -64 -214" />
        <path d="M 70 -196 L 120 -80" />
        <path d="M 60 -196 L 70 -236" />
      </g>
      <path d="M 44 -242 L 104 -236" stroke="#2F3A4A" strokeWidth={12} strokeLinecap="round" />
      <path d="M -96 -222 L -34 -222 C -30 -210 -40 -204 -60 -204 C -84 -204 -98 -210 -96 -222 Z" fill="#2F3A4A" />
      <circle cx={-30} cy={-80} r={16} fill="#5B6676" />
    </g>
  );
}

// Chú chó đen nhỏ ướt mưa, quấn áo khoác xanh, ngồi trong hộp giấy.
function Puppy() {
  return (
    <g>
      <path d="M -80 -70 L 80 -70 L 72 0 L -72 0 Z" fill="#C9955E" />
      <path d="M -80 -70 L -100 -96 L -20 -96 L 0 -70 Z M 80 -70 L 100 -96 L 20 -96 L 0 -70 Z" fill="#DDAB72" />
      <path d="M -66 -70 C -70 -120 70 -120 66 -70 Z" fill="#3F6FB6" />
      <g transform="translate(0 -104)">
        <ellipse cx={-44} cy={-18} rx={16} ry={28} fill="#1E1E24" transform="rotate(22 -44 -18)" />
        <ellipse cx={44} cy={-18} rx={16} ry={28} fill="#1E1E24" transform="rotate(-22 44 -18)" />
        <ellipse cx={0} cy={0} rx={44} ry={40} fill="#2B2B33" />
        <ellipse cx={0} cy={16} rx={22} ry={16} fill="#45454F" />
        <circle cx={-16} cy={-6} r={7} fill="#FFFFFF" />
        <circle cx={16} cy={-6} r={7} fill="#FFFFFF" />
        <circle cx={-15} cy={-5} r={4} fill="#111" />
        <circle cx={17} cy={-5} r={4} fill="#111" />
        <ellipse cx={0} cy={10} rx={8} ry={6} fill="#111" />
        <path d="M 0 16 Q -6 24 -12 20 M 0 16 Q 6 24 12 20" stroke="#111" strokeWidth={3} fill="none" />
        <path d="M 40 -40 l -4 12 M 30 -46 l -2 12" stroke="#7CC4F2" strokeWidth={4} strokeLinecap="round" />
      </g>
      <path d="M -66 -70 C -40 -84 40 -84 66 -70 L 60 -60 C 30 -70 -30 -70 -60 -60 Z" fill="#335E9E" />
    </g>
  );
}

// Người tuyết: mắt đen, miệng đỏ (như truyện), mũi cà rốt, khăn quàng.
function Snowman() {
  return (
    <g>
      <ellipse cx={0} cy={-6} rx={96} ry={16} fill="#E8F1F8" />
      <circle cx={0} cy={-86} r={86} fill="#FFFFFF" stroke="#DCE7F0" strokeWidth={4} />
      <circle cx={0} cy={-212} r={58} fill="#FFFFFF" stroke="#DCE7F0" strokeWidth={4} />
      <circle cx={-20} cy={-224} r={8} fill="#2A2A2A" />
      <circle cx={20} cy={-224} r={8} fill="#2A2A2A" />
      <path d="M 0 -210 L 30 -202 L 0 -196 Z" fill="#F28C28" />
      <path d="M -20 -186 Q 0 -174 20 -186" stroke="#E5484D" strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M -54 -160 C -20 -148 20 -148 54 -160 L 56 -142 C 20 -130 -20 -130 -56 -142 Z" fill="#E5484D" />
      <path d="M 30 -146 L 44 -100 L 26 -98 L 18 -144 Z" fill="#D53B40" />
      {[-110, -80, -50].map((y) => (
        <circle key={y} cx={0} cy={y} r={7} fill="#2A2A2A" />
      ))}
      <path d="M -82 -118 L -132 -150 M -120 -142 L -130 -166" stroke="#8A5A3C" strokeWidth={7} strokeLinecap="round" />
    </g>
  );
}

// Tranh trên giá vẽ: bố ngồi dưới ngọn đèn vàng lúc đêm (tranh bé vẽ). Gốc = chân giá.
function Painting() {
  return (
    <g>
      <path d="M -110 0 L -40 -330 M 110 0 L 40 -330 M 0 -320 L 0 0" stroke="#9C6B45" strokeWidth={12} strokeLinecap="round" />
      <rect x={-140} y={-380} width={280} height={220} rx={6} fill="#F6EBD9" stroke="#8A5A3C" strokeWidth={10} />
      <rect x={-128} y={-368} width={256} height={196} fill="#2E3F7A" />
      <path d="M 50 -368 L 90 -368 L 128 -250 L 128 -172 L 0 -172 Z" fill="#FFD76A" opacity={0.55} />
      <path d="M 66 -368 L 76 -340" stroke="#C9C1B2" strokeWidth={4} />
      <path d="M 52 -340 Q 72 -370 92 -340 Z" fill="#FFD76A" />
      <rect x={-90} y={-212} width={200} height={16} fill="#B98A5E" />
      <circle cx={10} cy={-262} r={30} fill="#F6D2B5" />
      <path d="M -20 -272 C -20 -300 40 -300 40 -272 C 30 -284 0 -286 -20 -272 Z" fill="#3A3035" />
      <path d="M -10 -292 q 10 -6 20 0" stroke="#E6E6E6" strokeWidth={4} fill="none" />
      <path d="M -24 -196 C -24 -230 44 -230 44 -196 Z" fill="#5E9E7A" />
      <rect x={-76} y={-232} width={40} height={22} rx={3} fill="#DCEBF8" />
      <path d="M -120 -190 q 20 -30 40 0" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={4} fill="none" />
    </g>
  );
}

// Lưới cá đầy cá trên sạp thuyền.
function FishNet() {
  return (
    <g>
      <path d="M -96 0 C -110 -60 110 -60 96 0 Z" fill="#8E9BA8" opacity={0.35} />
      {[
        [-50, -30, 0],
        [0, -42, 1],
        [48, -28, 2],
        [-20, -18, 3],
        [24, -14, 4],
      ].map(([x, y, k]) => (
        <g key={k} transform={`translate(${x} ${y}) rotate(${(k - 2) * 12})`}>
          <ellipse rx={30} ry={11} fill={k % 2 ? "#A9B8C6" : "#C3CFDA"} />
          <path d="M 26 0 L 42 -10 L 42 10 Z" fill={k % 2 ? "#A9B8C6" : "#C3CFDA"} />
          <circle cx={-18} cy={-2} r={3} fill="#2A1D1A" />
        </g>
      ))}
      <g stroke="#5B6676" strokeWidth={2} opacity={0.6}>
        {[-80, -50, -20, 10, 40, 70].map((x) => (
          <path key={x} d={`M ${x} 0 L ${x + 20} -50`} />
        ))}
        {[-10, -24, -38].map((y) => (
          <path key={y} d={`M -96 ${y} L 96 ${y}`} />
        ))}
      </g>
    </g>
  );
}

// Tranh phấn trên bảng đen: chú chim trên cành như sắp bay (Tiểu Hoàng vẽ).
function BoardBird() {
  return (
    <g stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.92}>
      <path d="M -180 -40 C -100 -60 0 -50 150 -70" stroke="#C9A36A" strokeWidth={10} />
      <path d="M -60 -52 q 20 -30 50 -20 M 60 -62 q 10 -30 40 -30" stroke="#8FD18B" strokeWidth={8} />
      <path d="M -20 -60 C -40 -110 20 -150 60 -120 C 90 -100 80 -70 40 -60 Z" fill="#FFFFFF" fillOpacity={0.2} />
      <path d="M 60 -120 L 90 -112 L 62 -106" />
      <circle cx={46} cy={-118} r={4} fill="#FFFFFF" />
      <path d="M 0 -96 C -60 -170 -130 -170 -170 -150 C -120 -130 -70 -110 -20 -80" fill="#FFE27A" fillOpacity={0.3} stroke="#FFE27A" />
      <path d="M -24 -64 L -60 -40 M -10 -60 L -30 -30" />
      <path d="M 20 -58 L 18 -44 M 34 -60 L 34 -46" />
    </g>
  );
}

const PROPS: Record<string, Draw> = {
  flowers: () => <Flowers />,
  wildflowers: () => <Wildflowers />,
  fishbowl: () => <Fishbowl />,
  bike: () => <Bike />,
  puppy: () => <Puppy />,
  snowman: () => <Snowman />,
  painting: () => <Painting />,
  "fish-net": () => <FishNet />,
  "board-bird": () => <BoardBird />,
};
export default PROPS;
