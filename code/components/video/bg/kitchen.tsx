"use client";

// Bếp gia đình ban ngày: tường ốp gạch, tủ bếp trên, cửa sổ, máy hút mùi + bếp ga có nồi, tủ lạnh
// bên phải; phía trước là bàn bếp (mặt gỗ, cánh tủ xanh xám — không trắng để khỏi lẫn nền trang).
import type { Background } from "../assets";

function Back() {
  return (
    <g>
      <rect width={1600} height={900} fill="#EAF2EE" />
      {Array.from({ length: 9 }, (_, r) => (
        <path key={r} d={`M 0 ${250 + r * 45} L 1600 ${250 + r * 45}`} stroke="#D6E4DD" strokeWidth={3} />
      ))}
      {Array.from({ length: 27 }, (_, c) => (
        <path key={c} d={`M ${c * 60 + (c % 2) * 0} 250 L ${c * 60} 640`} stroke="#D6E4DD" strokeWidth={3} />
      ))}
      <rect y={640} width={1600} height={260} fill="#D9CBB5" />
      {/* tủ bếp trên */}
      <rect x={0} y={60} width={1600} height={170} fill="#F7F3EA" />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <rect x={14 + i * 200} y={72} width={180} height={146} rx={6} fill="#FFFDF7" stroke="#DCD3C2" strokeWidth={4} />
          <rect x={i % 2 ? 30 + i * 200 : 164 + i * 200} y={180} width={8} height={28} rx={4} fill="#B5A58A" />
        </g>
      ))}
      <rect x={0} y={226} width={1600} height={10} fill="#DCD3C2" />
      {/* cửa sổ */}
      <rect x={120} y={280} width={300} height={250} rx={8} fill="#FFFFFF" />
      <rect x={134} y={294} width={272} height={222} rx={4} fill="#BFE4F7" />
      <circle cx={350} cy={340} r={24} fill="#FFE27A" />
      <path d="M 134 470 Q 220 430 300 460 T 406 450 L 406 516 L 134 516 Z" fill="#9FD39A" />
      <rect x={264} y={294} width={10} height={222} fill="#FFFFFF" />
      {/* máy hút mùi + bếp */}
      <path d="M 700 236 L 900 236 L 940 330 L 660 330 Z" fill="#C9D1DB" />
      <rect x={650} y={326} width={300} height={16} rx={6} fill="#AEB8C4" />
      <rect x={780} y={236} width={40} height={20} fill="#AEB8C4" />
      {/* kệ gia vị */}
      <rect x={1000} y={400} width={220} height={12} rx={4} fill="#B98A5E" />
      {[1016, 1060, 1104, 1150, 1190].map((x, i) => (
        <g key={x}>
          <rect x={x} y={352 - (i % 2) * 10} width={30} height={48 + (i % 2) * 10} rx={6} fill={["#E07B5F", "#F2C14E", "#5E9E7A", "#FFFFFF", "#8C7BC2"][i]} />
          <rect x={x + 4} y={344 - (i % 2) * 10} width={22} height={10} rx={3} fill="#6B4E2E" />
        </g>
      ))}
      {/* tủ lạnh */}
      <rect x={1330} y={180} width={230} height={560} rx={18} fill="#F4F7FA" stroke="#CBD3DC" strokeWidth={5} />
      <path d="M 1330 400 L 1560 400" stroke="#CBD3DC" strokeWidth={5} />
      <rect x={1350} y={260} width={10} height={100} rx={5} fill="#AEB8C4" />
      <rect x={1350} y={430} width={10} height={140} rx={5} fill="#AEB8C4" />
      <rect x={1420} y={230} width={70} height={52} rx={4} fill="#FFE9A0" transform="rotate(-5 1455 256)" />
    </g>
  );
}

function Front() {
  return (
    <g>
      <rect x={0} y={696} width={1600} height={30} fill="#C98B57" />
      <rect x={0} y={722} width={1600} height={8} fill="#A8703F" />
      <rect x={0} y={730} width={1600} height={170} fill="#8FB3A6" />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <rect x={16 + i * 200} y={746} width={184} height={150} rx={6} fill="#A6C4B8" stroke="#7FA395" strokeWidth={4} />
          <rect x={88 + i * 200} y={760} width={40} height={8} rx={4} fill="#EDE6D8" />
        </g>
      ))}
    </g>
  );
}

const bg: Background = { back: () => <Back />, front: () => <Front /> };
export default bg;
