"use client";

// Sảnh dịch vụ công / ngân hàng / quầy giao dịch: dãy ô cửa đánh số, bảng số thứ tự đèn đỏ,
// vách kính, cây xanh; phía trước là quầy giao dịch (nhân viên đứng sau quầy, khách đứng phía trước —
// cũng sau mép quầy). Số ô cửa chỉ là chữ số.
import type { Background } from "../assets";

const NUM = { fontFamily: "system-ui, sans-serif", fontWeight: 800 } as const;

function Back() {
  return (
    <g>
      <rect width={1600} height={900} fill="#EEF2F6" />
      <rect y={580} width={1600} height={320} fill="#D9E0E8" />
      <rect x={0} y={40} width={1600} height={60} fill="#2F62B0" />
      <rect x={0} y={96} width={1600} height={8} fill="#244F92" />
      {/* bảng số thứ tự */}
      <rect x={640} y={130} width={320} height={110} rx={10} fill="#1F2430" />
      <text x={720} y={210} textAnchor="middle" fontSize={64} fill="#FF5A4F" {...NUM}>
        A
      </text>
      <text x={850} y={210} textAnchor="middle" fontSize={64} fill="#FF5A4F" {...NUM}>
        027
      </text>
      {/* ô cửa */}
      {[0, 1, 2, 3].map((i) => {
        const x = 90 + i * 380 + (i >= 2 ? 40 : 0);
        return (
          <g key={i}>
            <rect x={x} y={280} width={300} height={300} rx={8} fill="#FFFFFF" stroke="#C9D1DB" strokeWidth={5} />
            <rect x={x + 16} y={330} width={268} height={250} fill="#E3EEF7" opacity={0.8} />
            <path d={`M ${x + 30} 350 L ${x + 90} 350 M ${x + 30} 372 L ${x + 70} 372`} stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
            <circle cx={x + 150} cy={306} r={20} fill="#2F62B0" />
            <text x={x + 150} y={316} textAnchor="middle" fontSize={26} fill="#FFFFFF" {...NUM}>
              {i + 1}
            </text>
          </g>
        );
      })}
      <g transform="translate(800 580)">
        <path d="M -36 0 L 36 0 L 28 -56 L -28 -56 Z" fill="#E9EEF3" stroke="#B5BDC7" strokeWidth={4} />
        <path d="M 0 -56 C -46 -90 -54 -160 -30 -200 C -14 -150 -6 -110 0 -56 Z" fill="#4FA955" />
        <path d="M 0 -56 C 46 -96 60 -160 40 -210 C 24 -150 10 -110 0 -56 Z" fill="#5DBB63" />
      </g>
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={0} y={690} width={1600} height={30} rx={4} fill="#F4F6F8" stroke="#C3CBD4" strokeWidth={4} />
      <rect x={0} y={718} width={1600} height={182} fill="#D6C2A8" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={i * 200 + 12} y={736} width={176} height={164} rx={6} fill="#E3D2BC" />
      ))}
      <g transform="translate(470 690)">
        <path d="M -40 0 L 40 0 L 30 -40 L -30 -40 Z" fill="#2F62B0" />
        <rect x={-30} y={-44} width={60} height={8} fill="#244F92" />
      </g>
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
