"use client";

// Bong bóng CÓ THAM SỐ (dùng lại cho mọi bài): thoughtBubble = "id:tham số".
//   clock:2:30 · number:97% · money:3000 · calendar:15 · person:grandpa · call:mom · photo:grandpa,grandma · message:3
// "Ai" (person/call/photo) = khoá vai trong cast (vẽ đúng trang phục của vai) hoặc id preset (grandpa…).
// Chữ trong bong bóng chỉ là số / ký hiệu quốc tế. Vòng tròn r≈104, tâm (0,0).
import { useId } from "react";
import type { BubbleCtx, BubbleDraw } from "../assets";
import { Character } from "../character";
import type { Look } from "../rig";

const NUM = { fontFamily: "system-ui, sans-serif", fontWeight: 800 } as const;

function Bg({ c }: { c: string }) {
  return <rect x={-112} y={-112} width={224} height={224} fill={c} />;
}

function Head({ look, cx, cy, k, expression = "happy" }: { look: Look; cx: number; cy: number; k: number; expression?: "happy" | "neutral" | "sad" }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k})`}>
      <Character look={look} x={0} baseY={-look.headY * look.scale} facing={1} expression={expression} headOnly />
    </g>
  );
}

// Nửa người (đầu + vai) — cỡ đầu như nhau với mọi preset (trẻ con không bé tí trong khung).
function Bust({ look, cx, cy, k, expression }: { look: Look; cx: number; cy: number; k: number; expression?: "happy" | "neutral" | "sad" }) {
  const s = k / look.scale;
  const sy = (look.shoulderY - look.headY) * look.scale * s;
  return (
    <g>
      <path
        d={`M ${cx - look.shoulderW * s * 1.05} ${cy + sy + 140 * s} C ${cx - look.shoulderW * s} ${cy + sy} ${cx + look.shoulderW * s} ${cy + sy} ${cx + look.shoulderW * s * 1.05} ${cy + sy + 140 * s} Z`}
        fill={look.top}
      />
      <Head look={look} cx={cx} cy={cy} k={s} expression={expression} />
    </g>
  );
}

function Clock({ arg }: { arg: string }) {
  const [h, m] = arg.split(":").map(Number);
  const ah = ((h % 12) + m / 60) * 30;
  const am = m * 6;
  return (
    <g>
      <Bg c="#EAF4FB" />
      <circle r={78} fill="#FFFFFF" stroke="#2F3A4A" strokeWidth={8} />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M 0 -66 L 0 -56" stroke="#9AA5B4" strokeWidth={i % 3 ? 4 : 7} transform={`rotate(${i * 30})`} strokeLinecap="round" />
      ))}
      <path d="M 0 0 L 0 -38" stroke="#2F3A4A" strokeWidth={9} strokeLinecap="round" transform={`rotate(${ah})`} />
      <path d="M 0 0 L 0 -58" stroke="#E5484D" strokeWidth={6} strokeLinecap="round" transform={`rotate(${am})`} />
      <circle r={7} fill="#2F3A4A" />
      <rect x={-40} y={84} width={80} height={24} rx={8} fill="#2F3A4A" />
      <text y={103} textAnchor="middle" fontSize={20} fill="#FFFFFF" {...NUM}>
        {`${h}:${String(m).padStart(2, "0")}`}
      </text>
    </g>
  );
}

// Con số lớn (điểm, phần trăm, số km…): cỡ chữ co theo độ dài.
function BigNumber({ arg }: { arg: string }) {
  const n = [...arg].length;
  const fs = n <= 2 ? 96 : n <= 3 ? 80 : n <= 4 ? 64 : n <= 5 ? 52 : 44;
  return (
    <g>
      <Bg c="#FFF3DA" />
      <circle r={86} fill="#FFFFFF" stroke="#F2C14E" strokeWidth={8} />
      <text y={fs * 0.35} textAnchor="middle" fontSize={fs} fill="#E5484D" {...NUM}>
        {arg}
      </text>
    </g>
  );
}

function Money({ arg }: { arg: string }) {
  const n = [...arg].length;
  return (
    <g>
      <Bg c="#EAF7EE" />
      {[2, 1, 0].map((i) => (
        <g key={i} transform={`translate(${-6 + i * 10} ${-22 + i * 12}) rotate(${-10 + i * 6})`}>
          <rect x={-78} y={-40} width={156} height={80} rx={8} fill={i ? "#C9573F" : "#E06A4E"} stroke="#A8412D" strokeWidth={4} />
          <circle cx={42} cy={0} r={22} fill="#F08C72" />
          <rect x={-64} y={-28} width={128} height={56} rx={4} fill="none" stroke="#F7B8A6" strokeWidth={3} />
        </g>
      ))}
      <rect x={-86} y={50} width={172} height={46} rx={12} fill="#FFFFFF" stroke="#2F3A4A" strokeWidth={4} />
      <text y={84} textAnchor="middle" fontSize={n > 6 ? 28 : 34} fill="#2F3A4A" {...NUM}>
        {`$${arg}`}
      </text>
    </g>
  );
}

// Tờ lịch: dải đỏ + con số lớn (ngày / "5.5" / "30").
function Calendar({ arg }: { arg: string }) {
  const n = [...arg].length;
  return (
    <g>
      <Bg c="#F4F8FB" />
      <rect x={-72} y={-80} width={144} height={164} rx={14} fill="#FFFFFF" stroke="#2F3A4A" strokeWidth={6} />
      <path d="M -72 -46 L -72 -66 Q -72 -80 -58 -80 L 58 -80 Q 72 -80 72 -66 L 72 -46 Z" fill="#E5484D" />
      <circle cx={-36} cy={-86} r={8} fill="#2F3A4A" />
      <circle cx={36} cy={-86} r={8} fill="#2F3A4A" />
      <text y={46} textAnchor="middle" fontSize={n <= 2 ? 84 : n <= 3 ? 62 : 46} fill="#2F3A4A" {...NUM}>
        {arg}
      </text>
    </g>
  );
}

function Person({ look }: { look?: Look }) {
  if (!look) return <Bg c="#F4F8FB" />;
  return (
    <g>
      <Bg c="#FFF1E3" />
      <Bust look={look} cx={0} cy={-6} k={0.66} />
    </g>
  );
}

// Người ở đầu dây: nửa người + điện thoại + sóng âm (mẹ gọi, bà gọi…).
function Call({ look }: { look?: Look }) {
  if (!look) return <Bg c="#F4F8FB" />;
  return (
    <g>
      <Bg c="#EAF4FB" />
      <Bust look={look} cx={-24} cy={-4} k={0.58} />
      <g transform="translate(46 -10) rotate(14)">
        <rect x={-14} y={-32} width={28} height={56} rx={7} fill="#2F3A4A" />
        <rect x={-10} y={-26} width={20} height={40} rx={3} fill="#9FD3F5" />
      </g>
      <g stroke={look.accent} strokeWidth={5} fill="none" strokeLinecap="round">
        <path d="M 70 -32 Q 82 -12 70 8" />
        <path d="M 84 -44 Q 102 -12 84 20" />
      </g>
    </g>
  );
}

// Tấm ảnh chụp chung (ảnh cũ, ảnh cưới…): khung trắng, 1–3 người.
function Photo({ looks }: { looks: (Look | undefined)[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ok = looks.filter(Boolean) as Look[];
  const xs = ok.length === 1 ? [0] : ok.length === 2 ? [-34, 34] : [-50, 0, 50];
  const k = ok.length === 1 ? 0.5 : ok.length === 2 ? 0.4 : 0.32;
  return (
    <g>
      <Bg c="#EFE6D6" />
      <g transform="rotate(-5)">
        <rect x={-88} y={-80} width={176} height={168} rx={4} fill="#FFFFFF" stroke="#D9CDB6" strokeWidth={3} />
        <clipPath id={`${uid}p`}>
          <rect x={-76} y={-68} width={152} height={124} />
        </clipPath>
        <g clipPath={`url(#${uid}p)`}>
          <rect x={-76} y={-68} width={152} height={124} fill="#CFE3EE" />
          <rect x={-76} y={24} width={152} height={40} fill="#B7CFA0" />
          {ok.map((l, i) => (
            <Bust key={i} look={l} cx={xs[i]} cy={-12} k={k} />
          ))}
        </g>
      </g>
    </g>
  );
}

// Màn hình tin nhắn: vài bóng chat + huy hiệu số tin (không chữ).
function Message({ arg }: { arg: string }) {
  const n = Math.max(1, Math.min(5, Number(arg) || 3));
  return (
    <g>
      <Bg c="#EAF4FB" />
      <rect x={-54} y={-98} width={108} height={196} rx={16} fill="#2F3A4A" />
      <rect x={-46} y={-86} width={92} height={172} rx={8} fill="#F4F8FB" />
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={i % 2 ? -8 : -38} y={-72 + i * 30} width={46} height={20} rx={10} fill={i % 2 ? "#6CCB8B" : "#FFFFFF"} stroke="#D7DEE6" strokeWidth={2} />
      ))}
      <circle cx={56} cy={-80} r={24} fill="#E5484D" />
      <text x={56} y={-72} textAnchor="middle" fontSize={[...arg].length > 2 ? 16 : 22} fill="#FFFFFF" {...NUM}>
        {arg}
      </text>
    </g>
  );
}

const who = (ctx: BubbleCtx, arg: string) => ctx.look(arg);

const BUBBLES: Record<string, BubbleDraw> = {
  clock: (arg) => <Clock arg={arg} />,
  number: (arg) => <BigNumber arg={arg} />,
  money: (arg) => <Money arg={arg} />,
  calendar: (arg) => <Calendar arg={arg} />,
  person: (arg, ctx) => <Person look={who(ctx, arg)} />,
  call: (arg, ctx) => <Call look={who(ctx, arg)} />,
  photo: (arg, ctx) => <Photo looks={arg.split(",").map((a) => who(ctx, a.trim()))} />,
  message: (arg) => <Message arg={arg} />,
};
export default BUBBLES;
