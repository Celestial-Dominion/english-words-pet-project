"use client";

// Toa tàu hoả (ghế ngồi): cửa sổ lớn nhìn ra đồng ruộng, đồi, cột điện; giá hành lý phía trên,
// rèm cửa, lưng ghế xanh; phía trước là bàn nhỏ cạnh cửa sổ + hàng lưng ghế phía gần (người ngồi hai bên bàn).
// Đèn tắt = tàu chạy đêm (ngoài cửa sổ tối, đèn trần mờ). `weather: "snow"` = đồng tuyết + tuyết rơi,
// `"rain"` = trời xám + mưa hắt ngoài kính.
import { useId } from "react";
import type { Background, BgOpts } from "../assets";

const LIT = "var(--lit)";

function Back({ weather }: BgOpts) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const snow = weather === "snow";
  const rain = weather === "rain";
  const gray = snow || rain;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={gray ? "#A9B6C4" : "#8ECDF4"} />
          <stop offset="1" stopColor={gray ? "#D7DEE5" : "#E3F4FC"} />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="#E8E4DA" />
      <rect y={600} width={1600} height={300} fill="#B9B2A6" />
      {/* giá hành lý */}
      <rect x={0} y={60} width={1600} height={16} fill="#AEB8C4" />
      <rect x={0} y={100} width={1600} height={8} fill="#AEB8C4" />
      {[90, 420, 760, 1100, 1440].map((x) => (
        <rect key={x} x={x} y={36} width={140 + (x % 3) * 20} height={26} rx={6} fill={["#E07B5F", "#4F8FD8", "#E9A23B", "#5E9E7A", "#8C7BC2"][(x / 10) % 5 | 0]} />
      ))}
      {/* cửa sổ */}
      {[60, 590, 1120].map((x) => (
        <g key={x}>
          <rect x={x} y={150} width={420} height={260} rx={30} fill="#D5D0C4" />
          <rect x={x + 14} y={164} width={392} height={232} rx={22} fill={`url(#${id}sky)`} />
          <clipPath id={`${id}w${x}`}>
            <rect x={x + 14} y={164} width={392} height={232} rx={22} />
          </clipPath>
          <g clipPath={`url(#${id}w${x})`}>
            <path d={`M ${x} 330 Q ${x + 100} 270 ${x + 210} 310 Q ${x + 320} 260 ${x + 440} 300 L ${x + 440} 420 L ${x} 420 Z`} fill={snow ? "#E9EEF3" : rain ? "#8FB27E" : "#9CCB86"} />
            <rect x={x} y={340} width={440} height={80} fill={snow ? "#F8FAFC" : rain ? "#B5C98A" : "#C9DE8B"} />
            {[0, 1, 2, 3].map((k) => (
              <path key={k} d={`M ${x} ${352 + k * 14} L ${x + 440} ${346 + k * 14}`} stroke={snow ? "#DCE4EC" : "#B4CC72"} strokeWidth={3} />
            ))}
            <rect x={x + 300} y={200} width={6} height={150} fill="#7A6A5A" />
            <path d={`M ${x + 280} 214 L ${x + 326} 214`} stroke="#7A6A5A" strokeWidth={5} />
            <path d={`M ${x} 222 Q ${x + 150} 236 ${x + 303} 214 Q ${x + 380} 206 ${x + 440} 218`} stroke="#5B5048" strokeWidth={2} fill="none" />
            {snow && (
              <g fill="#FFFFFF" opacity={0.95}>
                {Array.from({ length: 22 }, (_, i) => (
                  <circle key={i} cx={x + 20 + ((i * 67 + x) % 380)} cy={172 + ((i * 83) % 220)} r={3 + (i % 3) * 1.5} />
                ))}
              </g>
            )}
            {rain && (
              <g stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round">
                {Array.from({ length: 24 }, (_, i) => (
                  <path key={i} d={`M ${x + 20 + ((i * 59 + x) % 380)} ${168 + ((i * 97) % 210)} l -14 28`} />
                ))}
              </g>
            )}
            <rect x={x} y={164} width={440} height={260} fill="#0D1530" style={{ opacity: `calc((1 - ${LIT}) * 0.85)` }} />
          </g>
          <path d={`M ${x - 10} 150 L ${x + 60} 150 L ${x + 40} 420 L ${x - 10} 420 Z`} fill="#6FA7A0" />
          <path d={`M ${x + 430} 150 L ${x + 360} 150 L ${x + 380} 420 L ${x + 430} 420 Z`} fill="#6FA7A0" />
        </g>
      ))}
      {/* lưng ghế */}
      {[140, 470, 800, 1130, 1460].map((x) => (
        <g key={x}>
          <rect x={x - 110} y={440} width={220} height={260} rx={40} fill="#3F6FB5" />
          <rect x={x - 80} y={452} width={160} height={60} rx={14} fill="#FFFFFF" opacity={0.9} />
        </g>
      ))}
    </g>
  );
}

function Front() {
  return (
    <g>
      <path d="M 300 690 L 1300 690 L 1340 730 L 260 730 Z" fill="#F4F6F8" />
      <rect x={260} y={728} width={1080} height={26} rx={6} fill="#C3CBD4" />
      {/* hàng ghế phía gần (lưng ghế xanh) che nửa dưới người ngồi */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 190 - 30} y={756} width={176} height={170} rx={34} fill="#3A66A8" stroke="#2F568F" strokeWidth={5} />
      ))}
    </g>
  );
}

function Overlay() {
  return <rect width={1600} height={900} fill="#0B1233" style={{ opacity: `calc((1 - ${LIT}) * 0.35)` }} pointerEvents="none" />;
}

const bg: Background = { back: (o) => <Back {...o} />, front: () => <Front />, overlay: () => <Overlay /> };
export default bg;
