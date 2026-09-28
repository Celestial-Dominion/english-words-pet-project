"use client";

// Phòng khách gia đình (SVG 1600×900) — 3 biến thể dùng chung một bản vẽ: tối (cửa sổ trời
// đêm, đèn thả trần bật/tắt theo --lit), ngày, ngày nhìn ra hồ. `weather: "rain"` = mưa ngoài
// cửa sổ (ẩn trăng sao), `"snow"` = tuyết rơi + tuyết đọng bậu cửa. Cửa ra vào bên phải (người đến/giao hàng đứng ở đó).
import { useId } from "react";
import type { Background, BgOpts } from "../assets";

const LIT = "var(--lit)";
type View = "night" | "day" | "lake";

function Window({ id, view, rain, snow = false }: { id: string; view: View; rain: boolean; snow?: boolean }) {
  const night = view === "night";
  const gray = rain || snow;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          {night ? (
            <>
              <stop offset="0" stopColor={gray ? "#232A45" : "#1B2550"} />
              <stop offset="1" stopColor={gray ? "#3A4260" : "#3D4C84"} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor={gray ? "#9FB0C2" : "#8ECDF4"} />
              <stop offset="1" stopColor={gray ? "#C9D3DD" : "#DDF1FC"} />
            </>
          )}
        </linearGradient>
        <clipPath id={`${id}glass`}>
          <rect x={84} y={134} width={272} height={304} rx={6} />
        </clipPath>
      </defs>
      <rect x={68} y={118} width={304} height={336} rx={12} fill="#FFFFFF" />
      <rect x={84} y={134} width={272} height={304} rx={6} fill={`url(#${id}sky)`} />
      <g clipPath={`url(#${id}glass)`}>
        {night && !gray && (
          <g>
            <circle cx={292} cy={196} r={30} fill="#FFF4C9" />
            <circle cx={306} cy={186} r={26} fill="#27335F" />
            {[
              [130, 180],
              [190, 240],
              [150, 330],
              [250, 300],
              [320, 380],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 2 ? 3 : 4} fill="#FFF4C9" opacity={0.85} />
            ))}
          </g>
        )}
        {view === "day" && !gray && (
          <g>
            <circle cx={296} cy={200} r={34} fill="#FFE27A" />
            <g fill="#FFFFFF" opacity={0.95}>
              <ellipse cx={150} cy={250} rx={48} ry={20} />
              <ellipse cx={186} cy={238} rx={34} ry={22} />
              <ellipse cx={250} cy={340} rx={40} ry={16} />
            </g>
            <path d="M 84 400 Q 160 360 230 392 T 356 380 L 356 438 L 84 438 Z" fill="#9FD39A" />
            <path d="M 84 420 Q 170 392 260 414 T 356 408 L 356 438 L 84 438 Z" fill="#7FC07B" />
          </g>
        )}
        {view === "lake" && (
          <g>
            {!gray && <circle cx={300} cy={190} r={26} fill="#FFE9A0" />}
            <path d="M 84 300 Q 130 262 176 292 Q 222 250 268 286 Q 312 262 356 290 L 356 330 L 84 330 Z" fill="#7FB58A" />
            <rect x={84} y={322} width={272} height={116} fill="#7CC3E6" />
            <path d="M 104 350 h 40 M 200 372 h 56 M 132 402 h 30 M 280 346 h 46 M 250 414 h 60" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={4} strokeLinecap="round" />
            <path d="M 196 356 L 262 356 L 250 372 L 208 372 Z" fill="#B5773F" />
            <path d="M 228 356 L 228 316 L 250 350 Z" fill="#FFFFFF" />
            <path d="M 132 214 q 10 -10 20 0 q 10 -10 20 0 M 180 244 q 8 -8 16 0 q 8 -8 16 0" stroke="#44506A" strokeWidth={3} fill="none" strokeLinecap="round" />
          </g>
        )}
        {snow && (
          <g fill="#FFFFFF" opacity={night ? 0.85 : 0.95}>
            {Array.from({ length: 30 }, (_, i) => (
              <circle key={i} cx={88 + ((i * 61) % 268)} cy={140 + ((i * 89) % 296)} r={3 + (i % 3) * 1.6} />
            ))}
            <path d="M 84 426 Q 150 412 220 424 T 356 418 L 356 438 L 84 438 Z" />
          </g>
        )}
        {rain && (
          <g stroke={night ? "#AFC0E0" : "#FFFFFF"} strokeOpacity={0.75} strokeWidth={3} strokeLinecap="round">
            {Array.from({ length: 34 }, (_, i) => {
              const x = 70 + ((i * 53) % 300);
              const y = 120 + ((i * 97) % 330);
              return <path key={i} d={`M ${x} ${y} l -12 30`} />;
            })}
          </g>
        )}
      </g>
      <rect x={214} y={134} width={12} height={304} fill="#FFFFFF" />
      <rect x={84} y={280} width={272} height={12} fill="#FFFFFF" />
      <rect x={40} y={96} width={362} height={12} rx={6} fill="#9C6B45" />
      <path d="M 44 104 C 84 180 58 330 96 476 L 44 476 Z" fill="#6FA7A0" />
      <path d="M 398 104 C 358 180 384 330 346 476 L 398 476 Z" fill="#5B928B" />
    </g>
  );
}

function HomeBack({ view, weather }: { view: View } & BgOpts) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const night = view === "night";
  return (
    <g>
      <defs>
        <linearGradient id={`${id}hall`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFE9B8" />
          <stop offset="1" stopColor="#FFC76B" />
        </linearGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" stopColor="#FFE7A3" stopOpacity={0.55} />
          <stop offset="1" stopColor="#FFE7A3" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* tường + ốp chân tường + sàn */}
      <rect width={1600} height={900} fill="#F2E2CC" />
      <rect y={560} width={1600} height={340} fill="#E6CDAE" />
      <rect y={556} width={1600} height={10} fill="#D4B38E" />
      <rect y={800} width={1600} height={100} fill="#C9976A" />
      <Window id={id} view={view} rain={weather === "rain"} snow={weather === "snow"} />
      {/* ảnh gia đình */}
      <rect x={560} y={170} width={128} height={104} rx={8} fill="#B98A5E" />
      <rect x={572} y={182} width={104} height={80} rx={4} fill="#CFE8F2" />
      <circle cx={598} cy={228} r={12} fill="#E07B5F" />
      <circle cx={626} cy={236} r={9} fill="#4F8FD8" />
      <circle cx={650} cy={238} r={8} fill="#F08FB0" />
      <rect x={572} y={246} width={104} height={16} fill="#9ACB8E" />
      {/* cửa ra vào hé mở, hành lang sáng */}
      <rect x={1366} y={166} width={214} height={560} rx={6} fill="#8A5A3C" />
      <rect x={1384} y={184} width={178} height={542} fill={`url(#${id}hall)`} />
      <path d="M 1500 184 L 1562 170 L 1562 740 L 1500 726 Z" fill="#A86B45" />
      <circle cx={1516} cy={460} r={7} fill="#F2C14E" />
      {/* đèn thả trần: tối = bật/tắt theo --lit; ban ngày để tắt */}
      <rect x={797} y={0} width={6} height={110} fill="#7A6A5A" />
      <path d="M 736 172 Q 800 84 864 172 Z" fill="#BFA06A" />
      {night && (
        <g>
          <path d="M 736 172 Q 800 84 864 172 Z" fill="#F4BD4F" style={{ opacity: LIT }} />
          <ellipse cx={800} cy={174} rx={18} ry={9} fill="#FFF6D5" style={{ opacity: LIT }} />
          <ellipse cx={800} cy={430} rx={560} ry={380} fill={`url(#${id}glow)`} style={{ opacity: LIT }} />
        </g>
      )}
    </g>
  );
}

function HomeFront() {
  return (
    <g>
      <rect x={210} y={800} width={34} height={100} fill="#A8703F" />
      <rect x={1356} y={800} width={34} height={100} fill="#A8703F" />
      <path d="M 230 690 L 1370 690 L 1430 742 L 170 742 Z" fill="#E7B98B" />
      <rect x={170} y={740} width={1260} height={62} rx={6} fill="#C98B57" />
      <rect x={170} y={740} width={1260} height={8} fill="#B97C49" />
    </g>
  );
}

// Tắt đèn: phủ tối, chừa vùng sáng quanh cửa (hành lang) để vẫn thấy người nói.
function HomeOverlay() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <g style={{ opacity: `calc((1 - ${LIT}) * 0.82)` }} pointerEvents="none">
      <defs>
        <radialGradient id={`${id}hole`} cx="1380" cy="470" r="470" gradientUnits="userSpaceOnUse">
          <stop offset="0.25" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id={`${id}m`}>
          <rect width={1600} height={900} fill={`url(#${id}hole)`} />
        </mask>
      </defs>
      <rect width={1600} height={900} fill="#0B1233" mask={`url(#${id}m)`} />
    </g>
  );
}

const variant = (view: View): Background => ({
  back: (o) => <HomeBack view={view} {...o} />,
  front: () => <HomeFront />,
  overlay: view === "night" ? () => <HomeOverlay /> : undefined,
});

export const homeEvening = variant("night");
export const homeDay = variant("day");
export const homeLake = variant("lake");
