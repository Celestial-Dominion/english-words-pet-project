"use client";

// Bong bóng CẬN CẢNH đồ vật / sơ đồ (để hiểu đúng điều đang nói). Vòng tròn r≈104, tâm (0,0).
// Chữ trong bong bóng chỉ là số / ký hiệu quốc tế / một từ tiếng Anh đang được nói tới.
import type { Draw } from "../assets";

const NUM = { fontFamily: "system-ui, sans-serif", fontWeight: 800 } as const;

function Bg({ c }: { c: string }) {
  return <rect x={-112} y={-112} width={224} height={224} fill={c} />;
}

// Màn hình điện thoại đầy tin nhắn.
function PhoneChat() {
  return (
    <g>
      <Bg c="#EAF4FB" />
      <rect x={-52} y={-100} width={104} height={200} rx={16} fill="#2F3A4A" />
      <rect x={-44} y={-88} width={88} height={176} rx={8} fill="#F4F8FB" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={i % 2 ? -8 : -36} y={-74 + i * 26} width={44} height={18} rx={9} fill={i % 2 ? "#6CCB8B" : "#C9D6E3"} />
      ))}
      <circle cx={56} cy={-78} r={22} fill="#E5484D" />
      <text x={56} y={-70} textAnchor="middle" fontSize={22} fill="#FFFFFF" {...NUM}>
        9
      </text>
    </g>
  );
}

// Video có rất nhiều lượt xem.
function VideoViews() {
  return (
    <g>
      <Bg c="#EEF0FA" />
      <rect x={-86} y={-78} width={172} height={110} rx={12} fill="#2F3A4A" />
      <rect x={-78} y={-70} width={156} height={94} rx={6} fill="#F6C98A" />
      <circle cx={0} cy={-24} r={24} fill="#FFFFFF" opacity={0.9} />
      <path d="M -8 -36 L 14 -24 L -8 -12 Z" fill="#E5484D" />
      <ellipse cx={-56} cy={62} rx={20} ry={12} fill="none" stroke="#2F3A4A" strokeWidth={5} />
      <circle cx={-56} cy={62} r={6} fill="#2F3A4A" />
      <text x={22} y={76} textAnchor="middle" fontSize={34} fill="#E5484D" {...NUM}>
        100K
      </text>
    </g>
  );
}

// Sơ đồ tuyến: đi tuyến đỏ rồi đổi sang tuyến xanh.
function MetroMap() {
  return (
    <g>
      <Bg c="#F4F8FB" />
      <path d="M -92 -44 L 8 -44" stroke="#E5484D" strokeWidth={12} strokeLinecap="round" />
      <path d="M 8 -44 L 8 30 Q 8 60 38 60 L 92 60" stroke="#3F7FCB" strokeWidth={12} fill="none" strokeLinecap="round" />
      {[-92, -72, -52, -32, -12].map((x) => (
        <circle key={x} cx={x} cy={-44} r={7} fill="#FFFFFF" stroke="#E5484D" strokeWidth={4} />
      ))}
      <circle cx={8} cy={-44} r={13} fill="#FFFFFF" stroke="#2F3A4A" strokeWidth={5} />
      {[8, 30].map((y) => (
        <circle key={y} cx={8} cy={y} r={7} fill="#FFFFFF" stroke="#3F7FCB" strokeWidth={4} />
      ))}
      <circle cx={52} cy={60} r={7} fill="#FFFFFF" stroke="#3F7FCB" strokeWidth={4} />
      <circle cx={92} cy={60} r={12} fill="#FFD166" stroke="#2F3A4A" strokeWidth={4} />
    </g>
  );
}

// Máy bay cất cánh.
function Airplane() {
  return (
    <g>
      <Bg c="#DCEFFC" />
      <rect x={-112} y={70} width={224} height={42} fill="#9AA5B4" />
      <path d="M -100 90 L 100 90" stroke="#FFFFFF" strokeWidth={4} strokeDasharray="16 12" />
      <g transform="translate(-6 10) rotate(-18)">
        <path d="M -80 0 C -80 -12 60 -14 80 -4 C 88 0 80 8 70 8 L -76 8 C -80 8 -82 4 -80 0 Z" fill="#FFFFFF" stroke="#9AA5B4" strokeWidth={3} />
        <path d="M -10 -2 L -40 -44 L -24 -44 L 20 -2 Z M -4 6 L -30 40 L -16 40 L 16 6 Z" fill="#5B8DEF" />
        <path d="M -76 0 L -92 -26 L -80 -26 L -60 -2 Z" fill="#5B8DEF" />
        {[-40, -26, -12, 2, 16, 30, 44].map((x) => (
          <circle key={x} cx={x} cy={-3} r={3} fill="#9AA5B4" />
        ))}
      </g>
    </g>
  );
}

const BUBBLES: Record<string, Draw> = {
  "phone-chat": () => <PhoneChat />,
  "video-views": () => <VideoViews />,
  "metro-map": () => <MetroMap />,
  airplane: () => <Airplane />,
};
export default BUBBLES;
