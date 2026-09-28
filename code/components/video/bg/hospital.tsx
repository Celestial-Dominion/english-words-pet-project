"use client";

// Phòng bệnh nhi buổi tối: tường xanh bạc hà, cửa sổ trời đêm có rèm, đèn đầu giường bật, cây
// truyền dịch; phía trước là thành giường + chăn (người nằm/ngồi trên giường và bác sĩ đứng sau).
import type { Background } from "../assets";

function Back() {
  return (
    <g>
      <rect width={1600} height={900} fill="#DCEFE8" />
      <rect y={560} width={1600} height={340} fill="#C8E2D8" />
      <rect y={556} width={1600} height={10} fill="#B4D3C7" />
      {/* cửa sổ đêm + rèm */}
      <rect x={640} y={110} width={320} height={300} rx={10} fill="#FFFFFF" />
      <rect x={656} y={126} width={288} height={268} rx={6} fill="#27335F" />
      <circle cx={880} cy={186} r={26} fill="#FFF4C9" />
      <circle cx={892} cy={178} r={22} fill="#27335F" />
      {[
        [700, 170],
        [760, 300],
        [840, 250],
        [910, 340],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#FFF4C9" />
      ))}
      <path d="M 800 126 L 800 394" stroke="#FFFFFF" strokeWidth={10} />
      <path d="M 610 96 C 650 200 620 330 660 430 L 610 430 Z" fill="#8FC7E8" />
      <path d="M 990 96 C 950 200 980 330 940 430 L 990 430 Z" fill="#7AB8DE" />
      <rect x={600} y={90} width={400} height={12} rx={6} fill="#9AA5B4" />
      {/* đèn đầu giường */}
      {[260, 1340].map((x) => (
        <g key={x}>
          <rect x={x - 70} y={200} width={140} height={20} rx={8} fill="#9AA5B4" />
          <ellipse cx={x} cy={224} rx={60} ry={10} fill="#FFF3C4" />
          <path d={`M ${x - 60} 224 L ${x - 130} 520 L ${x + 130} 520 L ${x + 60} 224 Z`} fill="#FFF3C4" opacity={0.22} />
        </g>
      ))}
      {/* cây truyền dịch */}
      <g transform="translate(1520 0)">
        <rect x={-4} y={140} width={8} height={560} fill="#9AA5B4" />
        <path d="M -40 150 L 40 150" stroke="#9AA5B4" strokeWidth={8} strokeLinecap="round" />
        <rect x={-30} y={160} width={40} height={70} rx={10} fill="#E8F4FB" stroke="#B9CDDA" strokeWidth={3} />
        <path d="M -10 230 C -10 300 -60 340 -80 420" stroke="#B9CDDA" strokeWidth={4} fill="none" />
      </g>
      {/* đầu giường */}
      {[300, 1300].map((x) => (
        <rect key={x} x={x - 170} y={430} width={340} height={200} rx={20} fill="#B7C7D4" />
      ))}
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={-10} y={700} width={1620} height={210} fill="#BFDDF2" />
      <path d="M -10 700 C 200 686 400 710 600 696 C 800 684 1000 708 1200 694 C 1380 684 1500 700 1610 692 L 1610 760 L -10 760 Z" fill="#D9ECF8" />
      <path d="M -10 760 L 1610 760" stroke="#9CC6E4" strokeWidth={6} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M ${i * 200 + 30} 790 L ${i * 200 + 120} 790`} stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" opacity={0.8} />
      ))}
      <rect x={-10} y={820} width={1620} height={12} fill="#9AA5B4" />
      {[20, 780, 1580].map((x) => (
        <rect key={x} x={x - 8} y={700} width={16} height={200} fill="#9AA5B4" />
      ))}
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
