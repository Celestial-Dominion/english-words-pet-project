"use client";

// Quán ăn nhỏ — 2 biến thể:
//  restaurant: quán cơm/mì bình dân — bảng thực đơn bằng hình + giá, đèn lồng, ô cửa bếp, TV treo tường
//              (đang chiếu bóng đá — dùng cho xem bóng đá chung); phía trước là bàn gỗ có ống đũa.
//  cafe: quán trà sữa / cà phê — tường sáng, bảng menu hình cốc + giá, đèn thả, kệ cốc và cây;
//        phía trước là QUẦY (người bán đứng sau quầy, khách đứng trước… cũng sau mép quầy).
import type { Background } from "../assets";
import { LongTable } from "./parts";

const NUM = { fontFamily: "system-ui, sans-serif", fontWeight: 800 } as const;

function Bowl({ x, y, c = "#E07B5F" }: { x: number; y: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -22 -8 L 22 -8 Q 20 14 0 16 Q -20 14 -22 -8 Z" fill={c} />
      <path d="M -14 -10 Q 0 -22 14 -10" stroke="#F2C14E" strokeWidth={4} fill="none" />
    </g>
  );
}

function RestaurantBack() {
  return (
    <g>
      <rect width={1600} height={900} fill="#F6E7CF" />
      <rect y={520} width={1600} height={380} fill="#B98552" />
      <rect y={516} width={1600} height={12} fill="#8A5A3C" />
      {Array.from({ length: 17 }, (_, i) => (
        <path key={i} d={`M ${i * 100} 528 L ${i * 100} 900`} stroke="#A8743F" strokeWidth={4} />
      ))}
      {/* bảng thực đơn */}
      <rect x={440} y={70} width={720} height={250} rx={10} fill="#3B2F2A" stroke="#8A5A3C" strokeWidth={10} />
      {[0, 1, 2].map((r) =>
        [0, 1].map((c) => (
          <g key={`${r}${c}`}>
            <Bowl x={500 + c * 340} y={126 + r * 70} c={["#E07B5F", "#F2C14E", "#5E9E7A"][(r + c) % 3]} />
            <path d={`M ${540 + c * 340} ${122 + r * 70} L ${700 + c * 340} ${122 + r * 70}`} stroke="#6B5A4E" strokeWidth={3} strokeDasharray="6 8" />
            <text x={760 + c * 340} y={134 + r * 70} textAnchor="end" fontSize={30} fill="#FFE27A" {...NUM}>
              {[12, 15, 18, 10, 22, 8][r * 2 + c]}
            </text>
          </g>
        )),
      )}
      {/* đèn lồng */}
      {[260, 1340].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={0} width={6} height={90} fill="#6B4E2E" />
          <ellipse cx={x} cy={140} rx={46} ry={50} fill="#E5484D" />
          <rect x={x - 28} y={88} width={56} height={10} rx={4} fill="#F2C14E" />
          <rect x={x - 28} y={182} width={56} height={10} rx={4} fill="#F2C14E" />
        </g>
      ))}
      {/* ô cửa bếp */}
      <rect x={60} y={260} width={300} height={200} rx={6} fill="#8A5A3C" />
      <rect x={76} y={276} width={268} height={168} fill="#FFE3B0" />
      <path d="M 76 276 L 344 276 L 344 310 Q 210 330 76 310 Z" fill="#D9534F" />
      <rect x={120} y={380} width={60} height={50} rx={6} fill="#9AA5B4" />
      <path d="M 130 370 q 6 -20 0 -40 M 160 370 q 6 -20 0 -40" stroke="#FFFFFF" strokeWidth={5} fill="none" opacity={0.8} />
      {/* TV treo tường: sân bóng */}
      <rect x={1230} y={250} width={320} height={200} rx={10} fill="#1F2430" />
      <rect x={1244} y={264} width={292} height={172} fill="#3E9A48" />
      <path d="M 1390 264 L 1390 436 M 1244 350 L 1536 350" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} />
      <circle cx={1390} cy={350} r={30} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} />
      <rect x={1244} y={306} width={20} height={88} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} />
      <rect x={1516} y={306} width={20} height={88} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={3} />
      <circle cx={1440} cy={330} r={7} fill="#FFFFFF" />
      <rect x={1380} y={446} width={20} height={30} fill="#1F2430" />
    </g>
  );
}

function RestaurantFront() {
  return (
    <g>
      <LongTable wood="#9C6B45" topColor="#C98B57" edge="#8A5A3C" legs="#7A4E30" />
      <g transform="translate(1250 690)">
        <rect x={-22} y={-70} width={44} height={70} rx={6} fill="#6B4E2E" />
        {[-12, -4, 4, 12].map((x, i) => (
          <rect key={x} x={x - 2} y={-96 + (i % 2) * 6} width={4} height={40} fill="#E9D3A8" />
        ))}
      </g>
    </g>
  );
}

function CafeBack() {
  return (
    <g>
      <rect width={1600} height={900} fill="#FBEFE9" />
      <rect y={560} width={1600} height={340} fill="#E9D6C8" />
      {/* bảng menu */}
      <rect x={470} y={90} width={660} height={230} rx={14} fill="#2F4A43" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${550 + i * 160} 170)`}>
          <path d="M -26 -40 L 26 -40 L 20 30 L -20 30 Z" fill={["#F5D6B3", "#E9A0B8", "#C8E6C9", "#D7B899"][i]} />
          <rect x={-30} y={-48} width={60} height={10} rx={4} fill="#FFFFFF" />
          <path d="M 8 -48 L 20 -70" stroke="#E5484D" strokeWidth={5} strokeLinecap="round" />
          {i % 2 === 0 && [-10, 0, 10].map((x) => <circle key={x} cx={x} cy={18} r={5} fill="#3B2F2A" />)}
          <text y={100} textAnchor="middle" fontSize={32} fill="#FFFFFF" {...NUM}>
            {[12, 15, 10, 18][i]}
          </text>
        </g>
      ))}
      {/* đèn thả */}
      {[330, 1270].map((x) => (
        <g key={x}>
          <rect x={x - 2} y={0} width={4} height={120} fill="#6B5A4E" />
          <path d={`M ${x - 44} 170 Q ${x} 90 ${x + 44} 170 Z`} fill="#F2C14E" />
          <ellipse cx={x} cy={172} rx={14} ry={6} fill="#FFF6D5" />
        </g>
      ))}
      {/* kệ cốc + cây */}
      {[380, 470].map((y) => (
        <g key={y}>
          <rect x={60} y={y} width={300} height={12} rx={4} fill="#B98A5E" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={80 + i * 56} y={y - 44} width={36} height={44} rx={6} fill={["#FFFFFF", "#F08FB0", "#FFFFFF", "#9FD3F5", "#FFFFFF"][i]} stroke="#E0D2C6" strokeWidth={3} />
          ))}
        </g>
      ))}
      <g transform="translate(1440 560)">
        <path d="M -40 0 L 40 0 L 30 -60 L -30 -60 Z" fill="#E07B5F" />
        <path d="M 0 -60 C -50 -100 -60 -180 -30 -230 C -14 -170 -6 -120 0 -60 Z" fill="#4FA955" />
        <path d="M 0 -60 C 50 -110 70 -180 44 -240 C 26 -170 10 -120 0 -60 Z" fill="#5DBB63" />
      </g>
    </g>
  );
}

function CafeFront() {
  return (
    <g>
      <rect x={0} y={690} width={1600} height={26} rx={4} fill="#D9B98C" />
      <rect x={0} y={714} width={1600} height={186} fill="#B97C49" />
      {Array.from({ length: 32 }, (_, i) => (
        <rect key={i} x={i * 50 + 6} y={730} width={38} height={170} rx={4} fill="#C98B57" />
      ))}
      <g transform="translate(1330 690)">
        <rect x={-60} y={-60} width={120} height={60} rx={8} fill="#5B6676" />
        <rect x={-46} y={-50} width={60} height={30} rx={4} fill="#9FD3F5" />
        <rect x={24} y={-48} width={24} height={36} rx={4} fill="#3B4452" />
      </g>
    </g>
  );
}

export const restaurant: Background = { back: () => <RestaurantBack />, front: () => <RestaurantFront /> };
export const cafe: Background = { back: () => <CafeBack />, front: () => <CafeFront /> };
