"use client";

// Sân khấu nhà hát / hội trường: phông nền tối, rèm nhung đỏ hai bên + diềm trên, đèn rọi, sàn gỗ;
// phía trước là hàng ghế khán giả (lưng ghế che nửa dưới diễn viên — nhìn từ dưới khán phòng).
// Đèn tắt = mất điện / tắt đèn sân khấu: phủ tối, chỉ còn quầng mờ giữa sân khấu.
import { useId } from "react";
import type { Background } from "../assets";

const LIT = "var(--lit)";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}bd`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E2A55" />
          <stop offset="1" stopColor="#4B3F78" />
        </linearGradient>
        <linearGradient id={`${id}cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3C4" stopOpacity={0.5} />
          <stop offset="1" stopColor="#FFF3C4" stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}bd)`} />
      {/* sàn gỗ */}
      <path d="M 0 600 L 1600 600 L 1600 900 L 0 900 Z" fill="#B07A4C" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M 0 ${610 + i * 36} L 1600 ${610 + i * 36}`} stroke="#9C6B45" strokeWidth={3} />
      ))}
      {/* đèn rọi */}
      <g style={{ opacity: LIT }}>
        <path d="M 520 0 L 600 0 L 820 640 L 300 640 Z" fill={`url(#${id}cone)`} />
        <path d="M 1000 0 L 1080 0 L 1300 640 L 780 640 Z" fill={`url(#${id}cone)`} />
        <ellipse cx={560} cy={640} rx={260} ry={34} fill="#FFF3C4" opacity={0.25} />
        <ellipse cx={1040} cy={640} rx={260} ry={34} fill="#FFF3C4" opacity={0.25} />
      </g>
      {/* rèm hai bên */}
      {[-1, 1].map((s) => (
        <g key={s} transform={s < 0 ? undefined : "translate(1600 0) scale(-1 1)"}>
          <path d="M 0 0 L 230 0 C 210 200 250 420 200 900 L 0 900 Z" fill="#B3262E" />
          {[40, 90, 140, 190].map((x) => (
            <path key={x} d={`M ${x} 0 C ${x - 14} 300 ${x + 10} 600 ${x - 4} 900`} stroke="#8F1C23" strokeWidth={10} fill="none" />
          ))}
          <path d="M 180 360 q 40 20 50 60" stroke="#F2C14E" strokeWidth={8} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {/* diềm trên */}
      <rect x={0} y={0} width={1600} height={70} fill="#B3262E" />
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={`M ${i * 100} 70 q 50 50 100 0 Z`} fill="#B3262E" />
      ))}
      <path d="M 0 68 L 1600 68" stroke="#F2C14E" strokeWidth={6} />
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={0} y={730} width={1600} height={170} fill="#241B2E" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <path d={`M ${i * 190 - 20} 900 L ${i * 190 - 20} 736 Q ${i * 190 + 65} 700 ${i * 190 + 150} 736 L ${i * 190 + 150} 900 Z`} fill="#7A1E28" />
          <path d={`M ${i * 190 - 8} 742 Q ${i * 190 + 65} 712 ${i * 190 + 138} 742`} stroke="#9C2A36" strokeWidth={8} fill="none" />
        </g>
      ))}
    </g>
  );
}

function Overlay() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g style={{ opacity: `calc((1 - ${LIT}) * 0.85)` }} pointerEvents="none">
      <defs>
        <radialGradient id={`${id}h`} cx="800" cy="460" r="560" gradientUnits="userSpaceOnUse">
          <stop offset="0.15" stopColor="#333" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id={`${id}m`}>
          <rect width={1600} height={900} fill={`url(#${id}h)`} />
        </mask>
      </defs>
      <rect width={1600} height={900} fill="#07081A" mask={`url(#${id}m)`} />
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front />, overlay: () => <Overlay /> };
export default bg;
