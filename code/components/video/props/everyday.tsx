"use client";

// Đạo cụ ĐỜI THƯỜNG thêm cho series tiếng Anh (SVG, gốc = giữa đáy, đứng trên mặt bàn / quầy).
// Cỡ ~60–220 đơn vị; tâm để tay chỉ vào khai ở PROP_CENTER_H (rig.ts).
import type { Draw } from "../assets";

// Bánh kem hai tầng có nến.
function Cake() {
  return (
    <g>
      <ellipse cx={0} cy={-4} rx={92} ry={12} fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      <rect x={-72} y={-62} width={144} height={58} rx={10} fill="#F6C1CF" />
      <path d="M -72 -50 C -54 -38 -36 -58 -18 -44 C 0 -32 18 -56 36 -42 C 50 -32 62 -48 72 -44 L 72 -62 L -72 -62 Z" fill="#FFF4F7" />
      <rect x={-46} y={-104} width={92} height={44} rx={8} fill="#F08FB0" />
      <path d="M -46 -94 C -30 -84 -16 -100 0 -90 C 16 -80 30 -98 46 -90 L 46 -104 L -46 -104 Z" fill="#FFF4F7" />
      {[-24, 0, 24].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={-128} width={6} height={24} rx={2} fill={x ? "#7FB3E8" : "#F2C14E"} />
          <path d={`M ${x} -142 C ${x - 6} -134 ${x - 4} -128 ${x} -128 C ${x + 4} -128 ${x + 6} -134 ${x} -142 Z`} fill="#FFB347" />
        </g>
      ))}
      {[-54, -18, 18, 54].map((x) => (
        <circle key={x} cx={x} cy={-30} r={5} fill="#E5484D" />
      ))}
    </g>
  );
}

// Cốc cà phê có tay cầm + hơi nóng.
function Mug() {
  return (
    <g>
      <path d="M 30 -58 C 58 -58 58 -22 30 -24" stroke="#3F7FCB" strokeWidth={9} fill="none" />
      <path d="M -34 -72 L 34 -72 L 30 -4 C 22 2 -22 2 -30 -4 Z" fill="#4F8FD8" />
      <ellipse cx={0} cy={-72} rx={34} ry={7} fill="#6B4A32" />
      <rect x={-20} y={-52} width={40} height={20} rx={10} fill="#FFFFFF" opacity={0.85} />
      <g stroke="#B9C2CE" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8}>
        <path d="M -10 -88 q -9 -11 0 -22 q 9 -11 0 -22" />
        <path d="M 12 -84 q -9 -11 0 -22 q 9 -11 0 -22" />
      </g>
    </g>
  );
}

// Bánh mì kẹp trên đĩa.
function Sandwich() {
  return (
    <g>
      <ellipse cx={0} cy={-6} rx={80} ry={12} fill="#FFFFFF" stroke="#D9DEE8" strokeWidth={3} />
      <path d="M -62 -14 L 62 -14 L 0 -70 Z" fill="#E8C98A" />
      <path d="M -54 -22 L 54 -22 L 44 -30 L -44 -30 Z" fill="#6CBF5B" />
      <path d="M -48 -30 L 48 -30 L 38 -38 L -38 -38 Z" fill="#E5484D" />
      <path d="M -40 -38 L 40 -38 L 30 -46 L -30 -46 Z" fill="#F2C14E" />
      <path d="M -62 -14 L 62 -14 L 0 -70 Z" fill="none" stroke="#C9A15C" strokeWidth={4} strokeLinejoin="round" />
    </g>
  );
}

// Pizza tròn trong hộp mở.
function Pizza() {
  return (
    <g>
      <path d="M -110 0 L 110 0 L 96 -20 L -96 -20 Z" fill="#C9A26B" />
      <ellipse cx={0} cy={-22} rx={92} ry={20} fill="#E8B04F" />
      <ellipse cx={0} cy={-24} rx={80} ry={15} fill="#E0533C" />
      <ellipse cx={0} cy={-25} rx={72} ry={12} fill="#F6D27A" />
      {[
        [-40, -26],
        [10, -30],
        [44, -22],
        [-12, -20],
        [26, -32],
        [-52, -20],
      ].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx={9} ry={4} fill="#C0392B" />
      ))}
      <path d="M -96 -20 L -80 -150 L 80 -150 L 96 -20" fill="none" stroke="#B88E55" strokeWidth={6} />
      <path d="M -80 -150 L 80 -150 L 96 -20 L -96 -20 Z" fill="#D8B27A" opacity={0.35} />
    </g>
  );
}

// Bóng đá.
function SoccerBall() {
  return (
    <g transform="translate(0 -52)">
      <circle r={52} fill="#FFFFFF" stroke="#2F3A4A" strokeWidth={5} />
      <path d="M 0 -18 L 17 -6 L 11 15 L -11 15 L -17 -6 Z" fill="#2F3A4A" />
      <path d="M 0 -18 L 0 -46 M 17 -6 L 44 -16 M 11 15 L 28 40 M -11 15 L -28 40 M -17 -6 L -44 -16" stroke="#2F3A4A" strokeWidth={4} />
      <path d="M -14 -50 L 14 -50 L 0 -40 Z M 44 -30 L 50 -4 L 40 -12 Z M -44 -30 L -50 -4 L -40 -12 Z" fill="#2F3A4A" />
    </g>
  );
}

// Micro trên chân đứng (sân khấu, phỏng vấn).
function Microphone() {
  return (
    <g>
      <ellipse cx={0} cy={-5} rx={46} ry={8} fill="#3A3F4A" />
      <rect x={-4} y={-190} width={8} height={186} fill="#5B6676" />
      <rect x={-13} y={-236} width={26} height={52} rx={13} fill="#2F3A4A" />
      <rect x={-13} y={-236} width={26} height={30} rx={13} fill="#9AA5B4" />
      <path d="M -9 -226 L 9 -226 M -9 -218 L 9 -218" stroke="#5B6676" strokeWidth={2} />
    </g>
  );
}

// Hộp quà thắt nơ.
function GiftBox() {
  return (
    <g>
      <rect x={-56} y={-86} width={112} height={86} rx={6} fill="#5DBB63" />
      <rect x={-62} y={-104} width={124} height={24} rx={6} fill="#4AA350" />
      <rect x={-9} y={-104} width={18} height={104} fill="#F2C14E" />
      <path d="M 0 -104 C -30 -140 -52 -116 -30 -106 Z M 0 -104 C 30 -140 52 -116 30 -106 Z" fill="#F2C14E" stroke="#D9A933" strokeWidth={3} />
    </g>
  );
}

// Người máy đồ chơi làm bằng hộp giấy.
function Robot() {
  return (
    <g>
      <rect x={-34} y={-22} width={24} height={22} rx={4} fill="#9AA5B4" />
      <rect x={10} y={-22} width={24} height={22} rx={4} fill="#9AA5B4" />
      <rect x={-48} y={-104} width={96} height={84} rx={10} fill="#C9A26B" stroke="#A8844E" strokeWidth={4} />
      <circle cx={0} cy={-62} r={14} fill="#F2C14E" />
      <rect x={-72} y={-96} width={22} height={52} rx={8} fill="#B88E55" />
      <rect x={50} y={-96} width={22} height={52} rx={8} fill="#B88E55" />
      <rect x={-36} y={-168} width={72} height={60} rx={10} fill="#D8B27A" stroke="#A8844E" strokeWidth={4} />
      <circle cx={-15} cy={-140} r={9} fill="#2F3A4A" />
      <circle cx={15} cy={-140} r={9} fill="#2F3A4A" />
      <rect x={-14} y={-124} width={28} height={6} rx={3} fill="#2F3A4A" />
      <path d="M 0 -168 L 0 -188" stroke="#5B6676" strokeWidth={4} />
      <circle cx={0} cy={-192} r={7} fill="#E5484D" />
    </g>
  );
}

// Chậu cây xanh.
function PlantPot() {
  return (
    <g>
      <path d="M -40 -60 L 40 -60 L 30 0 L -30 0 Z" fill="#D9774B" />
      <rect x={-46} y={-70} width={92} height={14} rx={4} fill="#C4633A" />
      <g fill="#5DBB63">
        <ellipse cx={-26} cy={-118} rx={16} ry={44} transform="rotate(-28 -26 -118)" />
        <ellipse cx={26} cy={-118} rx={16} ry={44} transform="rotate(28 26 -118)" />
        <ellipse cx={0} cy={-132} rx={16} ry={52} />
      </g>
      <path d="M 0 -70 L 0 -170 M 0 -96 L -30 -140 M 0 -96 L 30 -140" stroke="#3E8E4A" strokeWidth={4} fill="none" />
    </g>
  );
}

// Chai nước.
function WaterBottle() {
  return (
    <g>
      <rect x={-22} y={-132} width={44} height={132} rx={14} fill="#9FD3F5" opacity={0.9} />
      <rect x={-22} y={-86} width={44} height={40} fill="#3F7FCB" opacity={0.85} />
      <rect x={-12} y={-150} width={24} height={20} rx={4} fill="#2F3A4A" />
      <rect x={-14} y={-120} width={8} height={90} rx={4} fill="#FFFFFF" opacity={0.5} />
    </g>
  );
}

const PROPS: Record<string, Draw> = {
  cake: () => <Cake />,
  mug: () => <Mug />,
  sandwich: () => <Sandwich />,
  pizza: () => <Pizza />,
  "soccer-ball": () => <SoccerBall />,
  microphone: () => <Microphone />,
  "gift-box": () => <GiftBox />,
  robot: () => <Robot />,
  "plant-pot": () => <PlantPot />,
  "water-bottle": () => <WaterBottle />,
};
export default PROPS;
