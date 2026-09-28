"use client";

// Phố / ngã tư thành phố ban ngày: nhà cao tầng, dãy cửa hàng có mái hiên, lòng đường có vạch
// sang đường, cột đèn giao thông, cây; phía trước là bồn cây xanh ven vỉa hè (người đứng sau bồn).
// Đèn tắt (`visual.lights: "off"`) = trời đêm: phủ xanh thẫm, cửa sổ + cột đèn sáng.
import { useId } from "react";
import type { Background } from "../assets";
import { Cloud, rand, Tree } from "./parts";

const LIT = "var(--lit)";

function Back() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FD0F4" />
          <stop offset="1" stopColor="#E4F5FD" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={`url(#${id}sky)`} />
      <Cloud x={300} y={90} s={0.9} />
      <Cloud x={1180} y={70} s={0.7} />
      {/* nhà cao tầng */}
      {[
        [0, 120, 230, "#C9D3DE"],
        [220, 60, 200, "#B7C4D2"],
        [410, 150, 240, "#D5DCE4"],
        [640, 90, 220, "#C3CDD8"],
        [850, 40, 250, "#AFBCCB"],
        [1090, 130, 230, "#CFD7E0"],
        [1310, 70, 290, "#BCC7D4"],
      ].map(([x, y, w, c], i) => (
        <g key={i}>
          <rect x={x as number} y={y as number} width={w as number} height={420 - (y as number)} fill={c as string} />
          {Array.from({ length: Math.floor((360 - (y as number)) / 46) }, (_, r) =>
            Array.from({ length: Math.floor((w as number) / 52) }, (_, k) => (
              <rect
                key={`${r}-${k}`}
                x={(x as number) + 16 + k * 52}
                y={(y as number) + 20 + r * 46}
                width={30}
                height={26}
                rx={3}
                fill={rand(i * 31 + r * 7 + k, 3) > 0.7 ? "#FFE9A0" : "#EAF3FB"}
                opacity={0.9}
              />
            )),
          )}
        </g>
      ))}
      {/* dãy cửa hàng tầng trệt */}
      <rect x={0} y={400} width={1600} height={170} fill="#EFE3D0" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={20 + i * 320} y={440} width={280} height={130} fill="#F8F4EC" stroke="#D8CBB4" strokeWidth={4} />
          <rect x={40 + i * 320} y={470} width={110} height={100} fill="#BFE0F2" />
          <rect x={170 + i * 320} y={470} width={110} height={100} fill="#BFE0F2" />
          {Array.from({ length: 7 }, (_, k) => (
            <rect key={k} x={20 + i * 320 + k * 40} y={410} width={40} height={36} fill={k % 2 ? "#FFFFFF" : ["#D9534F", "#3E8E6A", "#4F8FD8", "#E9A23B", "#8C7BC2"][i]} />
          ))}
        </g>
      ))}
      {/* vỉa hè + lòng đường + vạch sang đường */}
      <rect y={570} width={1600} height={60} fill="#D8D2C8" />
      <rect y={630} width={1600} height={270} fill="#6E7580" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={560 + i * 56} y={640} width={34} height={200} fill="#F4F4F0" opacity={0.9} />
      ))}
      <path d="M 0 760 L 480 760 M 1100 760 L 1600 760" stroke="#F2C14E" strokeWidth={8} strokeDasharray="60 40" />
      {/* cột đèn giao thông */}
      <rect x={1180} y={250} width={14} height={330} fill="#4A5563" />
      <rect x={1162} y={170} width={50} height={130} rx={10} fill="#2F3A4A" />
      <circle cx={1187} cy={198} r={14} fill="#E5484D" opacity={0.35} />
      <circle cx={1187} cy={236} r={14} fill="#F2C14E" opacity={0.35} />
      <circle cx={1187} cy={274} r={14} fill="#3BB273" />
      <Tree x={120} y={600} s={1.05} />
      <Tree x={1500} y={600} s={1.1} c="#63B363" />
      {/* cột đèn đường (sáng khi tối) */}
      <rect x={380} y={300} width={10} height={290} fill="#4A5563" />
      <path d="M 385 300 Q 385 270 430 270" stroke="#4A5563" strokeWidth={8} fill="none" />
      <ellipse cx={440} cy={276} rx={22} ry={9} fill="#FFF3C4" />
    </g>
  );
}

function Front() {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <path d={`M ${-20 + i * 410} 716 C ${20 + i * 410} 682 ${90 + i * 410} 684 ${130 + i * 410} 706 C ${170 + i * 410} 680 ${250 + i * 410} 682 ${290 + i * 410} 704 C ${330 + i * 410} 684 ${380 + i * 410} 690 ${400 + i * 410} 716 Z`} fill="#5DAA5A" />
          <rect x={-20 + i * 410} y={712} width={420} height={188} fill="#B9B2A6" />
          <rect x={-20 + i * 410} y={712} width={420} height={14} fill="#CFC8BC" />
        </g>
      ))}
      <rect x={0} y={800} width={1600} height={100} fill="#A9A294" />
    </g>
  );
}

// Đêm: phủ xanh thẫm, chừa quầng sáng quanh cột đèn đường và giữa phố.
function Overlay() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g style={{ opacity: `calc((1 - ${LIT}) * 0.72)` }} pointerEvents="none">
      <defs>
        <radialGradient id={`${id}h`} cx="700" cy="420" r="620" gradientUnits="userSpaceOnUse">
          <stop offset="0.2" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id={`${id}m`}>
          <rect width={1600} height={900} fill={`url(#${id}h)`} />
        </mask>
      </defs>
      <rect width={1600} height={900} fill="#0E1838" mask={`url(#${id}m)`} />
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front />, overlay: () => <Overlay /> };
export default bg;
