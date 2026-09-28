"use client";

// Trên thuyền đánh cá lúc rạng đông. --lit: 0 = trời còn tối (sao, biển sẫm, phủ tối lên người),
// 1 = mặt trời đã lên khỏi biển (trời hồng cam, mặt nước lấp lánh). Chuyển chậm bằng
// `visual: { lights: "on", fade: 5 }` ở câu mặt trời mọc. Phía trước là mạn thuyền gỗ.
import { useId } from "react";
import type { Background } from "../assets";
import { rand } from "./parts";

const LIT = "var(--lit)";
const DARK = `calc(1 - ${LIT})`;

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}day`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FB6E6" />
          <stop offset="0.55" stopColor="#F7B7A3" />
          <stop offset="0.8" stopColor="#FFC76B" />
        </linearGradient>
        <linearGradient id={`${id}night`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1233" />
          <stop offset="0.8" stopColor="#2A3466" />
        </linearGradient>
        <radialGradient id={`${id}sun`}>
          <stop offset="0.35" stopColor="#FFE08A" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FFB45E" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}day)`} />
      {/* mặt trời nhô lên từ biển theo --lit */}
      <g style={{ transform: `translateY(calc(${DARK} * 150px))` }}>
        <circle cx={1000} cy={420} r={220} fill={`url(#${id}sun)`} style={{ opacity: LIT }} />
        <circle cx={1000} cy={430} r={78} fill="#FF8A3D" />
        <circle cx={1000} cy={430} r={66} fill="#FFA24C" />
      </g>
      <rect width={1600} height={900} fill={`url(#${id}night)`} style={{ opacity: DARK }} />
      <g fill="#FFFFFF" style={{ opacity: DARK }}>
        {Array.from({ length: 70 }, (_, i) => (
          <circle key={i} cx={rand(i, 5) * 1600} cy={rand(i, 6) * 380} r={rand(i, 7) > 0.85 ? 3.5 : 2} />
        ))}
      </g>
      {/* bờ xa */}
      <path d="M 0 470 L 120 430 L 260 452 L 380 420 L 520 470 Z" fill="#3E4E6E" />
      {/* biển (sau đường chân trời 470) — sẫm khi tối */}
      <rect y={470} width={1600} height={430} fill="#3F86C2" />
      <path d="M 980 480 L 1020 480 L 1070 700 L 930 700 Z" fill="#FFD27A" style={{ opacity: `calc(${LIT} * 0.55)` }} />
      <g stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" fill="none" style={{ opacity: `calc(0.25 + ${LIT} * 0.45)` }}>
        {Array.from({ length: 18 }, (_, i) => (
          <path key={i} d={`M ${rand(i, 9) * 1560} ${500 + rand(i, 10) * 190} q 20 -10 40 0 t 40 0`} />
        ))}
      </g>
      <rect y={470} width={1600} height={430} fill="#0B1233" style={{ opacity: `calc(${DARK} * 0.6)` }} />
    </g>
  );
}

function Front() {
  return (
    <g>
      <path d="M -20 712 C 400 700 1200 700 1620 712 L 1580 900 L 20 900 Z" fill="#A86B45" />
      <path d="M -20 712 C 400 700 1200 700 1620 712 L 1620 732 C 1200 722 400 722 -20 732 Z" fill="#8A5A3C" />
      {[770, 820, 870].map((y) => (
        <path key={y} d={`M 0 ${y} C 400 ${y - 8} 1200 ${y - 8} 1600 ${y}`} stroke="#935F3D" strokeWidth={4} fill="none" />
      ))}
      <path d="M 1480 700 L 1480 600 M 1480 620 L 1560 640" stroke="#6E452C" strokeWidth={10} strokeLinecap="round" />
    </g>
  );
}

// Trước bình minh: người trên thuyền cũng chìm trong bóng tối xanh.
function Overlay() {
  return <rect width={1600} height={900} fill="#0B1233" style={{ opacity: `calc(${DARK} * 0.55)` }} pointerEvents="none" />;
}

const bg: Background = { back: () => <Back />, front: () => <Front />, overlay: () => <Overlay /> };
export default bg;
