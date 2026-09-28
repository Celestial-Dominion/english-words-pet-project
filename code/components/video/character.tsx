"use client";

// Nhân vật SVG dùng chung (rig tham số theo Look = preset + style của bài). React chỉ vẽ lại
// khi đổi BIỂU CẢM / cử chỉ (vài lần mỗi bài); chuyển động từng khung (miệng, mắt, đầu, tay)
// đi thẳng vào thuộc tính SVG qua `apply(pose)` — không re-render 60 lần/giây.
import { useId, useImperativeHandle, useRef, type Ref } from "react";
import type { Expression } from "@/lib/video";
import { shoulderOf, type Look } from "./rig";
import type { CharPose } from "./pose";

export interface CharacterHandle {
  apply(p: CharPose): void;
}

const INK = "#2A1D1A";
const LIP = "#7A2E36";
const TONGUE = "#E46A7B";
const EYES: [number, number][] = [
  [-35, 14],
  [35, 14],
];
const MOUTH_Y = 62;

// Miệng khép theo biểu cảm (toạ độ đầu, tâm miệng ~ (0, 62)).
function ClosedMouth({ e }: { e: Expression }) {
  const line = { stroke: LIP, strokeWidth: 4.5, fill: "none", strokeLinecap: "round" as const };
  switch (e) {
    case "happy":
      return (
        <g>
          <path d="M -22 55 C -18 78 18 78 22 55 Z" fill={LIP} />
          <path d="M -12 69 Q 0 63 12 69 Q 0 76 -12 69 Z" fill={TONGUE} />
        </g>
      );
    case "surprised":
      return <ellipse cx={0} cy={63} rx={8} ry={10} fill={LIP} />;
    case "thinking":
      return <path d="M -12 63 Q 0 61 13 57" {...line} />;
    case "confused":
      return <path d="M -15 63 Q -8 57 -1 62 Q 6 67 14 60" {...line} />;
    case "sad":
      return <path d="M -14 67 Q 0 58 14 67" {...line} />;
    case "tired":
      return <path d="M -12 63 Q 0 65 12 63" {...line} />;
    case "tearful":
      return <path d="M -18 59 Q -9 66 0 61 Q 9 66 18 59" {...line} />;
    case "angry":
      return <path d="M -16 68 Q 0 57 16 68" {...line} strokeWidth={5.5} />;
    case "shy":
      return <path d="M -10 61 Q 0 67 10 61" {...line} />;
    case "worried":
      return <path d="M -13 65 Q -6 60 0 63 Q 6 66 13 61" {...line} />;
    case "sick":
      return <path d="M -12 66 Q 0 61 12 66" {...line} />;
    default:
      return <path d="M -14 59 Q 0 68 14 59" {...line} />;
  }
}

// Lông mày trái (mày phải = lật gương). [đầu ngoài, điểm uốn, đầu trong].
const BROWS: Record<Expression, [string, string]> = {
  neutral: ["M -52 -28 Q -35 -37 -18 -29", "M 18 -29 Q 35 -37 52 -28"],
  happy: ["M -52 -33 Q -35 -44 -18 -34", "M 18 -34 Q 35 -44 52 -33"],
  surprised: ["M -52 -42 Q -35 -56 -18 -45", "M 18 -45 Q 35 -56 52 -42"],
  thinking: ["M -52 -40 Q -35 -50 -18 -40", "M 18 -29 Q 35 -31 52 -28"],
  confused: ["M -52 -28 Q -35 -33 -18 -37", "M 18 -41 Q 35 -48 52 -38"],
  sad: ["M -52 -26 Q -36 -29 -18 -39", "M 18 -39 Q 36 -29 52 -26"],
  tired: ["M -52 -24 Q -35 -28 -18 -25", "M 18 -25 Q 35 -28 52 -24"],
  tearful: ["M -52 -27 Q -36 -31 -18 -40", "M 18 -40 Q 36 -31 52 -27"],
  angry: ["M -52 -38 Q -34 -34 -16 -22", "M 16 -22 Q 34 -34 52 -38"],
  shy: ["M -52 -30 Q -36 -37 -18 -37", "M 18 -37 Q 36 -37 52 -30"],
  worried: ["M -52 -29 Q -36 -33 -18 -43", "M 18 -43 Q 36 -33 52 -29"],
  sick: ["M -52 -25 Q -36 -30 -18 -37", "M 18 -37 Q 36 -30 52 -25"],
};

const CHEEK: Partial<Record<Expression, number>> = {
  happy: 0.6,
  tearful: 0.55,
  surprised: 0.4,
  sad: 0.15,
  tired: 0.12,
  angry: 0.5,
  shy: 0.95,
  worried: 0.2,
  sick: 1,
};

function HairBack({ look }: { look: Look }) {
  const c = look.hairColor;
  switch (look.hair) {
    case "bob":
      return (
        <path
          fill={c}
          d="M -112 -4 C -118 -98 -64 -150 0 -150 C 64 -150 118 -98 112 -4 C 114 40 118 86 116 118 C 114 138 94 146 76 136 C 70 132 64 128 58 122 L -58 122 C -64 128 -70 132 -76 136 C -94 146 -114 138 -116 118 C -118 86 -114 40 -112 -4 Z"
        />
      );
    case "pigtails":
      return (
        <g fill={c}>
          <path d="M -102 -4 C -110 -100 -56 -146 0 -146 C 56 -146 110 -100 102 -4 Z" />
          <ellipse cx={-126} cy={30} rx={30} ry={60} transform="rotate(14 -126 30)" />
          <ellipse cx={126} cy={30} rx={30} ry={60} transform="rotate(-14 126 30)" />
        </g>
      );
    case "bun":
      return (
        <g fill={c}>
          <circle cx={0} cy={-140} r={42} />
          <path d="M -100 -4 C -108 -96 -56 -136 0 -136 C 56 -136 108 -96 100 -4 Z" />
        </g>
      );
    case "grandpa":
      return (
        <g fill={c}>
          <path d="M -99 -2 C -104 -40 -98 -66 -86 -84 L -74 -58 C -80 -40 -82 -22 -82 -2 Z" />
          <path d="M 99 -2 C 104 -40 98 -66 86 -84 L 74 -58 C 80 -40 82 -22 82 -2 Z" />
        </g>
      );
    case "fringe":
      return <path fill={c} d="M -104 -4 C -112 -104 -58 -152 2 -152 C 62 -152 112 -106 104 -8 Z" />;
    case "bald":
      return null;
    case "curly":
      return (
        <g fill={c}>
          <path d="M -102 -2 C -110 -100 -56 -146 0 -146 C 56 -146 110 -100 102 -2 Z" />
          {[-96, -70, -38, 0, 38, 70, 96].map((x, i) => (
            <circle key={i} cx={x} cy={-104 - 34 * Math.cos((x / 110) * 1.35)} r={30} />
          ))}
        </g>
      );
    case "long":
      return (
        <g fill={c}>
          <path d="M -110 -2 C -118 -100 -62 -152 0 -152 C 62 -152 118 -100 110 -2 Z" />
          <path d="M -111 -8 C -118 60 -118 150 -124 228 C -110 240 -86 238 -72 228 C -74 170 -76 110 -72 60 Z" />
          <path d="M 111 -8 C 118 60 118 150 124 228 C 110 240 86 238 72 228 C 74 170 76 110 72 60 Z" />
        </g>
      );
    case "ponytail":
      return (
        <g fill={c}>
          <path d="M -101 -4 C -109 -100 -54 -146 0 -146 C 54 -146 109 -100 101 -4 Z" />
          <path d="M -78 -112 C -152 -122 -176 -40 -156 44 C -146 76 -124 86 -112 74 C -130 22 -124 -48 -86 -82 Z" />
        </g>
      );
    default:
      return <path fill={c} d="M -100 -6 C -108 -100 -56 -142 0 -142 C 56 -142 108 -100 100 -6 Z" />;
  }
}

function HairFront({ look }: { look: Look }) {
  const c = look.hairColor;
  const shine = (
    <path d="M -46 -116 Q -6 -136 38 -122" stroke="#fff" strokeOpacity={0.16} strokeWidth={9} fill="none" strokeLinecap="round" />
  );
  switch (look.hair) {
    case "bob":
      return (
        <g>
          <path fill={c} d="M -98 -16 C -104 -96 -52 -132 4 -130 C 62 -128 104 -96 100 -24 C 92 -46 78 -62 58 -70 C 22 -54 -40 -34 -98 -16 Z" />
          {shine}
        </g>
      );
    case "pigtails":
      return (
        <g>
          <path fill={c} d="M -97 -18 C -103 -100 -54 -140 0 -140 C 54 -140 103 -100 97 -18 C 88 -38 72 -48 52 -50 C 22 -44 -22 -44 -52 -50 C -72 -48 -88 -38 -97 -18 Z" />
          <circle cx={-100} cy={-30} r={12} fill="#E5484D" />
          <circle cx={100} cy={-30} r={12} fill="#E5484D" />
          {shine}
        </g>
      );
    case "bun":
      return (
        <g>
          <path fill={c} d="M -98 -14 C -104 -96 -54 -134 0 -134 C 54 -134 104 -96 98 -14 C 92 -58 52 -92 0 -94 C -52 -92 -92 -58 -98 -14 Z" />
          <path d="M 0 -132 L 0 -96" stroke="#AFABB6" strokeWidth={3} />
        </g>
      );
    case "part":
      return (
        <g>
          <path fill={c} d="M -97 -26 C -104 -104 -50 -144 6 -142 C 64 -140 106 -102 98 -30 C 92 -58 70 -74 44 -82 C 20 -88 -6 -90 -30 -84 C -58 -78 -84 -58 -97 -26 Z" />
          <path d="M -28 -86 Q -22 -112 -12 -138" stroke="#000" strokeOpacity={0.18} strokeWidth={4} fill="none" strokeLinecap="round" />
          {shine}
        </g>
      );
    case "grandpa":
      return (
        <g>
          <ellipse cx={-10} cy={-72} rx={46} ry={18} fill="#fff" opacity={0.22} />
          <path fill={c} d="M -95 -10 C -101 -44 -93 -70 -77 -88 C -73 -62 -79 -36 -79 -10 Z" />
          <path fill={c} d="M 95 -10 C 101 -44 93 -70 77 -88 C 73 -62 79 -36 79 -10 Z" />
        </g>
      );
    case "fringe":
      return (
        <g>
          <path fill={c} d="M -100 -20 C -108 -110 -52 -156 8 -152 C 70 -148 110 -108 100 -26 C 94 -52 80 -66 62 -74 C 40 -60 10 -50 -22 -48 C -52 -46 -80 -38 -100 -20 Z" />
          <path d="M 30 -140 Q 64 -118 72 -80 M -10 -146 Q 28 -120 34 -70" stroke="#000" strokeOpacity={0.16} strokeWidth={4} fill="none" strokeLinecap="round" />
          {shine}
        </g>
      );
    case "long":
      return (
        <g>
          <path fill={c} d="M -100 -14 C -106 -104 -52 -146 4 -144 C 62 -142 106 -104 100 -18 C 96 -40 86 -52 72 -58 C 40 -50 -30 -48 -70 -58 C -84 -54 -94 -40 -100 -14 Z" />
          {shine}
        </g>
      );
    case "bald":
      // đầu trọc: chỉ viền tóc mai rất ngắn + bóng sáng trên đỉnh đầu
      return (
        <g>
          <path d="M -93 -6 C -97 -30 -94 -46 -86 -60" stroke={c} strokeOpacity={0.55} strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d="M 93 -6 C 97 -30 94 -46 86 -60" stroke={c} strokeOpacity={0.55} strokeWidth={9} fill="none" strokeLinecap="round" />
          <ellipse cx={-18} cy={-78} rx={34} ry={14} fill="#fff" opacity={0.3} />
        </g>
      );
    case "curly":
      return (
        <g fill={c}>
          <path d="M -98 -22 C -104 -100 -54 -136 0 -136 C 54 -136 104 -100 98 -22 C 90 -52 70 -66 46 -70 C 20 -62 -24 -62 -48 -70 C -72 -66 -90 -50 -98 -22 Z" />
          {[-72, -40, -6, 28, 62].map((x, i) => (
            <circle key={i} cx={x} cy={-72 - (i % 2) * 8} r={20} />
          ))}
        </g>
      );
    case "ponytail":
      return (
        <g>
          <path fill={c} d="M -97 -18 C -103 -100 -54 -140 0 -140 C 54 -140 103 -100 97 -22 C 90 -50 70 -70 40 -76 C 10 -70 -30 -60 -60 -52 C -80 -44 -92 -32 -97 -18 Z" />
          <circle cx={-86} cy={-102} r={11} fill={look.accent} />
          {shine}
        </g>
      );
    default:
      return (
        <g>
          <path fill={c} d="M -98 -28 C -106 -100 -56 -140 2 -140 C 60 -140 106 -100 98 -32 L 86 -46 L 74 -38 L 62 -60 L 44 -50 L 30 -70 L 12 -56 L -6 -72 L -24 -56 L -42 -68 L -58 -50 L -76 -60 L -86 -40 Z" />
          <path d="M 8 -138 Q 22 -166 44 -158" stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" />
          {shine}
        </g>
      );
  }
}

function Hat({ look }: { look: Look }) {
  if (look.hat === "cap")
    return (
      <g>
        <path d="M -98 -58 C -100 -134 -52 -156 0 -156 C 54 -156 100 -134 98 -58 Z" fill={look.topShade} />
        <path d="M 30 -70 C 92 -80 146 -66 156 -50 C 116 -40 62 -42 18 -52 Z" fill={look.topShade} />
        <path d="M -96 -60 Q 0 -74 98 -60" stroke="#000" strokeOpacity={0.15} strokeWidth={6} fill="none" />
        <circle cx={0} cy={-154} r={8} fill={look.top} />
      </g>
    );
  if (look.hat === "police")
    // mũ kê-pi (cảnh sát / bảo vệ / cơ trưởng): chóp xanh đậm, lưỡi trai đen, huy hiệu vàng
    return (
      <g>
        <path d="M -104 -84 C -118 -150 -40 -178 12 -176 C 70 -174 128 -150 108 -84 Z" fill="#26324A" />
        <rect x={-100} y={-96} width={206} height={26} rx={6} fill="#1B2335" />
        <path d="M 6 -74 C 70 -82 130 -70 146 -52 C 106 -46 50 -50 0 -60 Z" fill="#111722" />
        <path d="M -14 -150 l 12 -14 l 12 14 l -12 16 Z" fill="#F2C14E" />
        <rect x={-100} y={-94} width={206} height={6} fill="#F2C14E" opacity={0.85} />
      </g>
    );
  if (look.hat === "helmet")
    // mũ bảo hộ công trường (vàng) có gờ
    return (
      <g>
        <path d="M -108 -70 C -112 -160 -50 -178 0 -178 C 54 -178 114 -160 108 -70 Z" fill="#F2B632" />
        <rect x={-122} y={-78} width={244} height={18} rx={9} fill="#E0A21E" />
        <path d="M -18 -176 L -12 -80 M 18 -176 L 12 -80" stroke="#FFD66B" strokeWidth={10} strokeLinecap="round" />
      </g>
    );
  if (look.hat === "chef")
    return (
      <g fill="#FFFFFF" stroke="#E3E0DA" strokeWidth={3}>
        <circle cx={-52} cy={-168} r={44} />
        <circle cx={52} cy={-168} r={44} />
        <circle cx={0} cy={-196} r={52} />
        <path d="M -84 -80 L 84 -80 L 88 -150 L -88 -150 Z" />
      </g>
    );
  return null;
}

// Áo + cổ áo theo kiểu trang phục.
function Torso({ look, uid }: { look: Look; uid: string }) {
  const { shoulderY: sy, shoulderW: sw, waistW: ww } = look;
  const d = `M ${-ww} 90 L ${-sw + 6} ${sy + 50} C ${-sw + 2} ${sy + 18} ${-sw + 20} ${sy} ${-sw + 46} ${sy} L ${sw - 46} ${sy} C ${sw - 20} ${sy} ${sw - 2} ${sy + 18} ${sw - 6} ${sy + 50} L ${ww} 90 Z`;
  const btn = (y: number) => <circle key={y} cx={0} cy={y} r={5} fill={look.topShade} />;
  const shirtCollar = (
    <g fill={look.collar} stroke={look.topShade} strokeWidth={3}>
      <path d={`M -42 ${sy - 2} L -4 ${sy + 36} L -30 ${sy + 50} Z`} />
      <path d={`M 42 ${sy - 2} L 4 ${sy + 36} L 30 ${sy + 50} Z`} />
    </g>
  );
  let detail = null;
  switch (look.outfit) {
    case "blouse":
      detail = (
        <g>
          <path d={`M -34 ${sy} L 0 ${sy + 62} L 34 ${sy} Z`} fill={look.collar} />
          <path d={`M -34 ${sy} L 0 ${sy + 62} L 0 90 M 34 ${sy} L 0 ${sy + 62}`} stroke={look.topShade} strokeWidth={5} fill="none" />
          <circle cx={-10} cy={sy + 100} r={5} fill={look.topShade} />
          <circle cx={-10} cy={sy + 140} r={5} fill={look.topShade} />
        </g>
      );
      break;
    case "tee":
      detail = (
        <g>
          <path d={`M -32 ${sy} Q 0 ${sy + 30} 32 ${sy}`} stroke={look.collar} strokeWidth={11} fill="none" strokeLinecap="round" />
          <path d={`M 0 ${sy + 70} l 9 18 l 20 3 l -15 14 l 4 20 l -18 -10 l -18 10 l 4 -20 l -15 -14 l 20 -3 Z`} fill="#FFD166" />
        </g>
      );
      break;
    case "dress":
      detail = (
        <g fill={look.collar}>
          <path d={`M -2 ${sy + 2} C -8 ${sy + 34} -44 ${sy + 34} -46 ${sy + 2} Z`} />
          <path d={`M 2 ${sy + 2} C 8 ${sy + 34} 44 ${sy + 34} 46 ${sy + 2} Z`} />
        </g>
      );
      break;
    case "cardigan":
      detail = (
        <g>
          <path d={`M -36 ${sy} Q 0 ${sy + 36} 36 ${sy} Z`} fill={look.collar} />
          <path d={`M 0 ${sy + 30} L 0 90`} stroke={look.topShade} strokeWidth={4} />
          {[sy + 60, sy + 100, sy + 140].map(btn)}
        </g>
      );
      break;
    case "shirt":
      detail = (
        <g>
          <path d={`M 0 ${sy + 36} L 0 90`} stroke={look.topShade} strokeWidth={4} />
          {[sy + 70, sy + 110, sy + 150].map(btn)}
          {shirtCollar}
        </g>
      );
      break;
    case "tie":
      detail = (
        <g>
          <path d={`M -40 ${sy} L 0 ${sy + 40} L 40 ${sy} Z`} fill={look.collar} />
          <path d={`M -8 ${sy + 30} L 8 ${sy + 30} L 15 ${sy + 124} L 0 ${sy + 142} L -15 ${sy + 124} Z`} fill={look.accent} />
          {shirtCollar}
        </g>
      );
      break;
    case "coat":
      detail = (
        <g>
          <path d={`M -38 ${sy} L 0 ${sy + 104} L 38 ${sy} Z`} fill={look.collar} />
          <path d={`M -38 ${sy} L 0 ${sy + 104} L 0 90 M 38 ${sy} L 0 ${sy + 104}`} stroke="#D7DCE3" strokeWidth={5} fill="none" />
          <rect x={-ww + 26} y={sy + 120} width={46} height={34} rx={4} fill="none" stroke="#D7DCE3" strokeWidth={4} />
          <path d={`M -30 ${sy + 8} C -44 ${sy + 70} -30 ${sy + 120} -6 ${sy + 128}`} stroke="#6B7686" strokeWidth={6} fill="none" strokeLinecap="round" />
          <circle cx={-4} cy={sy + 132} r={9} fill="#9AA5B4" />
        </g>
      );
      break;
    case "uniform":
      detail = (
        <g>
          <path d={`M -30 ${sy} Q 0 ${sy + 22} 30 ${sy}`} stroke={look.collar} strokeWidth={12} fill="none" strokeLinecap="round" />
          <path d={`M 0 ${sy + 12} L 0 90`} stroke={look.collar} strokeWidth={5} />
          <path d={`M ${-sw + 20} ${sy + 20} L -44 ${sy + 14} M ${sw - 20} ${sy + 20} L 44 ${sy + 14}`} stroke={look.collar} strokeWidth={9} strokeLinecap="round" />
        </g>
      );
      break;
    case "jacket":
      detail = (
        <g>
          <path d={`M -40 ${sy - 4} L 40 ${sy - 4} L 34 ${sy + 20} L -34 ${sy + 20} Z`} fill={look.topShade} />
          <path d={`M 0 ${sy + 18} L 0 90`} stroke={look.topShade} strokeWidth={5} />
          {/* sọc phản quang cho áo làm việc (giao hàng, ngư dân — có mũ lưỡi trai); áo khoác thường: sọc tối */}
          <rect x={-ww + 8} y={sy + 96} width={2 * ww - 16} height={look.hat === "cap" ? 16 : 10} fill={look.hat === "cap" ? "#EEF1F4" : look.topShade} opacity={0.85} />
        </g>
      );
      break;
    case "suit":
      // vest: sơ mi (collar) + cà vạt (accent) + ve áo (topShade)
      detail = (
        <g>
          <path d={`M -34 ${sy} L 0 ${sy + 70} L 34 ${sy} Z`} fill={look.collar} />
          <path d={`M -7 ${sy + 26} L 7 ${sy + 26} L 13 ${sy + 112} L 0 ${sy + 128} L -13 ${sy + 112} Z`} fill={look.accent} />
          <path d={`M -44 ${sy - 2} L -6 ${sy + 104} L -30 ${sy + 70} L -62 ${sy + 30} Z`} fill={look.topShade} />
          <path d={`M 44 ${sy - 2} L 6 ${sy + 104} L 30 ${sy + 70} L 62 ${sy + 30} Z`} fill={look.topShade} />
          <circle cx={-2} cy={sy + 150} r={6} fill={look.topShade} />
          <rect x={ww - 58} y={sy + 44} width={30} height={7} rx={3} fill={look.topShade} />
        </g>
      );
      break;
    case "apron":
      detail = (
        <g>
          <path d={`M -32 ${sy} Q 0 ${sy + 26} 32 ${sy}`} stroke={look.topShade} strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d={`M -56 ${sy + 64} L 56 ${sy + 64} L ${ww - 10} 90 L ${-ww + 10} 90 Z`} fill="#FFFFFF" />
          <path d={`M -50 ${sy + 66} L -34 ${sy + 4} M 50 ${sy + 66} L 34 ${sy + 4}`} stroke="#FFFFFF" strokeWidth={9} />
          <rect x={-26} y={sy + 96} width={52} height={30} rx={5} fill="none" stroke="#E4E0D8" strokeWidth={4} />
        </g>
      );
      break;
    case "patient":
      detail = (
        <g>
          <clipPath id={`${uid}t`}>
            <path d={d} />
          </clipPath>
          <g clipPath={`url(#${uid}t)`}>
            {[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((k) => (
              <rect key={k} x={k * 26 - 6} y={sy - 10} width={12} height={130 - sy} fill={look.topShade} opacity={0.55} />
            ))}
          </g>
          <path d={`M -34 ${sy} L 0 ${sy + 48} L 34 ${sy}`} stroke="#FFFFFF" strokeWidth={8} fill="none" />
        </g>
      );
      break;
    default:
      detail = <path d={`M -30 ${sy} Q 0 ${sy + 24} 30 ${sy}`} stroke={look.topShade} strokeWidth={8} fill="none" strokeLinecap="round" />;
  }
  return (
    <g>
      <path d={d} fill={look.top} />
      {detail}
      {look.scarf && (
        <g>
          <path d={`M -48 ${sy - 12} C -30 ${sy + 18} 30 ${sy + 18} 48 ${sy - 12} L 52 ${sy + 12} C 30 ${sy + 44} -30 ${sy + 44} -52 ${sy + 12} Z`} fill={look.scarf} />
          <path d={`M 12 ${sy + 24} L 46 ${sy + 118} L 20 ${sy + 126} L -2 ${sy + 30} Z`} fill={look.scarf} />
          <path d={`M 36 ${sy + 92} L 20 ${sy + 98} M 42 ${sy + 108} L 24 ${sy + 114}`} stroke="#fff" strokeOpacity={0.5} strokeWidth={4} />
        </g>
      )}
    </g>
  );
}

function Arm({ look, side, pointing, armRef }: { look: Look; side: -1 | 1; pointing: boolean; armRef: Ref<SVGGElement> }) {
  const { x, y } = shoulderOf(look, side);
  const w = look.armW;
  const L = look.armLen;
  const sl = L * look.sleeve;
  return (
    <g ref={armRef} transform={`rotate(${side * -7} ${x} ${y})`}>
      {look.sleeve < 1 && <rect x={x - w / 2 + 3} y={y + sl - 14} width={w - 6} height={L - sl + 14} rx={(w - 6) / 2} fill={look.skin} />}
      <rect x={x - w / 2} y={y - 12} width={w} height={sl + 12} rx={w / 2} fill={look.top} />
      {look.outfit === "uniform" && <rect x={x - 3} y={y} width={6} height={sl - 10} rx={3} fill={look.collar} />}
      {look.outfit === "coat" && <rect x={x - w / 2} y={y + sl - 18} width={w} height={8} fill="#E4E8EE" />}
      {pointing && <rect x={x - 5} y={y + L} width={10} height={30} rx={5} fill={look.skin} />}
      <circle cx={x} cy={y + L} r={w * 0.56} fill={look.skin} />
    </g>
  );
}

export function Character({
  look,
  x,
  baseY,
  facing,
  expression,
  pointing = 0,
  headOnly = false,
  ref,
}: {
  look: Look;
  x: number;
  baseY: number;
  facing: 1 | -1;
  expression: Expression;
  pointing?: -1 | 0 | 1;
  headOnly?: boolean;
  ref?: Ref<CharacterHandle>;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const body = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const eyes = useRef<(SVGGElement | null)[]>([]);
  const irises = useRef<(SVGGElement | null)[]>([]);
  const mouthOpen = useRef<SVGGElement>(null);
  const mouthClosed = useRef<SVGGElement>(null);
  const armL = useRef<SVGGElement>(null);
  const armR = useRef<SVGGElement>(null);
  const emote = useRef<SVGGElement>(null);
  const tears = useRef<SVGGElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      apply(p) {
        body.current?.setAttribute(
          "transform",
          `translate(${p.bodyX.toFixed(1)} ${p.bodyY.toFixed(2)})${p.bodyRot ? ` rotate(${p.bodyRot.toFixed(2)})` : ""}`,
        );
        head.current?.setAttribute(
          "transform",
          `translate(${p.headX.toFixed(2)} ${p.headY.toFixed(2)}) rotate(${p.headRot.toFixed(2)} 0 ${look.headY + 92})`,
        );
        const open = Math.max(0.06, p.eyeOpen);
        eyes.current.forEach((el, i) =>
          el?.setAttribute("transform", `translate(0 ${(EYES[i][1] * (1 - open)).toFixed(2)}) scale(1 ${open.toFixed(3)})`),
        );
        irises.current.forEach((el) => el?.setAttribute("transform", `translate(${p.gazeX.toFixed(2)} ${p.gazeY.toFixed(2)})`));
        const m = Math.max(0.001, p.mouth);
        mouthOpen.current?.setAttribute("transform", `translate(0 ${(MOUTH_Y * (1 - m)).toFixed(2)}) scale(1 ${m.toFixed(3)})`);
        mouthClosed.current?.setAttribute("opacity", Math.max(0, 1 - p.mouth * 4).toFixed(2));
        const sl = shoulderOf(look, -1);
        const sr = shoulderOf(look, 1);
        armL.current?.setAttribute("transform", `rotate(${p.armL.toFixed(2)} ${sl.x} ${sl.y})`);
        armR.current?.setAttribute("transform", `rotate(${p.armR.toFixed(2)} ${sr.x} ${sr.y})`);
        emote.current?.setAttribute("transform", `translate(84 -122) scale(${p.emote.toFixed(3)})`);
        if (tears.current) {
          const on = p.tear >= 0;
          tears.current.setAttribute("opacity", on ? (p.tear < 0.75 ? 1 : (1 - p.tear) / 0.25).toFixed(2) : "0");
          tears.current.setAttribute("transform", `translate(0 ${on ? (p.tear * 38).toFixed(2) : 0})`);
        }
      },
    }),
    [look],
  );

  const e = expression;
  const [browL, browR] = BROWS[e];
  const emoteChar = e === "surprised" ? "!" : e === "confused" ? "?" : "";

  const headG = (
    <g ref={head}>
      <g transform={`translate(0 ${look.headY})`}>
        <HairBack look={look} />
        <circle cx={-88} cy={14} r={17} fill={look.skin} />
        <circle cx={92} cy={14} r={15} fill={look.skinShade} />
        <ellipse cx={0} cy={0} rx={92} ry={100} fill={look.skin} />
        {/* Nét mặt lệch nhẹ về phía đang nhìn → dáng 3/4 */}
        <g transform="translate(7 0)">
          <ellipse cx={-54} cy={42} rx={15} ry={9} fill="#F39A95" opacity={CHEEK[e] ?? 0.28} />
          <ellipse cx={58} cy={42} rx={14} ry={9} fill="#F39A95" opacity={CHEEK[e] ?? 0.28} />
          {EYES.map(([cx, cy], i) => (
            <g key={i} ref={(el) => void (eyes.current[i] = el)}>
              <clipPath id={`${uid}e${i}`}>
                <ellipse cx={cx} cy={cy} rx={16.5} ry={20} />
              </clipPath>
              <ellipse cx={cx} cy={cy} rx={16.5} ry={20} fill="#fff" />
              <g clipPath={`url(#${uid}e${i})`}>
                <g ref={(el) => void (irises.current[i] = el)}>
                  <circle cx={cx} cy={cy + 1.5} r={13} fill={look.iris} />
                  <circle cx={cx} cy={cy + 1.5} r={7.2} fill="#1B1414" />
                  <circle cx={cx + 4.5} cy={cy - 4.5} r={e === "tearful" ? 5.6 : 4.3} fill="#fff" />
                  <circle cx={cx - 4.5} cy={cy + 7} r={2} fill="#fff" opacity={0.85} />
                </g>
              </g>
              <path d={`M ${cx - 18.5} ${cy - 8} Q ${cx} ${cy - 28} ${cx + 18.5} ${cy - 8}`} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
              {e === "tearful" && <path d={`M ${cx - 12} ${cy + 17} Q ${cx} ${cy + 22} ${cx + 12} ${cy + 17}`} stroke="#7CC4F2" strokeWidth={3} fill="none" />}
            </g>
          ))}
          <path d={browL} stroke={look.hairColor} strokeWidth={6.5} fill="none" strokeLinecap="round" />
          <path d={browR} stroke={look.hairColor} strokeWidth={6.5} fill="none" strokeLinecap="round" />
          <path d="M -3 34 Q 2 41 7 34" stroke={look.skinShade} strokeWidth={4} fill="none" strokeLinecap="round" />
          <g ref={mouthClosed}>
            <ClosedMouth e={e} />
          </g>
          <g ref={mouthOpen} transform={`translate(0 ${MOUTH_Y}) scale(1 0.001)`}>
            <ellipse cx={0} cy={MOUTH_Y} rx={e === "happy" ? 19 : 15} ry={13} fill={LIP} />
            <ellipse cx={0} cy={MOUTH_Y + 7} rx={9} ry={5} fill={TONGUE} />
          </g>
          {e === "tearful" && (
            <g ref={tears} opacity={0}>
              <path d="M -38 30 q -6 10 0 14 q 6 -4 0 -14 Z" fill="#7CC4F2" />
              <path d="M 40 30 q -6 10 0 14 q 6 -4 0 -14 Z" fill="#7CC4F2" />
            </g>
          )}
          {e === "angry" && <path d="M 62 -70 l 8 14 l 14 -8 M 70 -56 l -6 16" stroke="#E5484D" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />}
          {e === "sick" && (
            <g>
              <ellipse cx={-54} cy={40} rx={22} ry={13} fill="#EF6F6C" opacity={0.55} />
              <ellipse cx={58} cy={40} rx={20} ry={13} fill="#EF6F6C" opacity={0.55} />
              <path d="M 70 -52 q -8 12 0 18 q 8 -6 0 -18 Z" fill="#7CC4F2" />
            </g>
          )}
          {look.glasses && (
            <g stroke="#6B5B55" strokeWidth={4} fill="#fff" fillOpacity={0.12}>
              <circle cx={-35} cy={14} r={25} />
              <circle cx={35} cy={14} r={25} />
              <path d="M -11 10 Q 0 4 11 10" fill="none" />
            </g>
          )}
        </g>
        <HairFront look={look} />
        <Hat look={look} />
        {emoteChar && (
          <g ref={emote} transform="translate(84 -122) scale(0)">
            <g transform={`scale(${facing} 1)`}>
              <circle r={27} fill="#fff" stroke="#2A2A2A" strokeWidth={4} />
              <text y={12} textAnchor="middle" fontSize={36} fontWeight={800} fill={e === "surprised" ? "#E5484D" : "#3F7FCB"}>
                {emoteChar}
              </text>
            </g>
          </g>
        )}
      </g>
    </g>
  );

  if (headOnly)
    return (
      <g transform={`translate(${x} ${baseY}) scale(${facing * look.scale} ${look.scale})`}>
        <g ref={body}>{headG}</g>
      </g>
    );

  return (
    <g transform={`translate(${x} ${baseY}) scale(${facing * look.scale} ${look.scale})`}>
      <g ref={body}>
        <rect x={-21} y={look.headY + 70} width={42} height={look.shoulderY - look.headY - 52} rx={14} fill={look.skinShade} />
        <Torso look={look} uid={uid} />
        <Arm look={look} side={-1} pointing={pointing === -1} armRef={armL} />
        <Arm look={look} side={1} pointing={pointing === 1} armRef={armR} />
        {headG}
      </g>
    </g>
  );
}
