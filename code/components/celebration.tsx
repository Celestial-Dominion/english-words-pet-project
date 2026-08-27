"use client";

// PHÁO HOA + NHẠC CHÚC MỪNG cho màn tổng kết phiên học/ôn.
// - Confetti tự vẽ trên canvas toàn màn (không thêm dependency, ~2,5s rồi tự gỡ).
// - Fanfare tổng hợp bằng Web Audio (không cần file mp3 — offline sẵn, không vướng bản quyền).
//   Giai điệu + tiếng "pluck" marimba PORT NGUYÊN từ app HSK (components/celebration.tsx bên đó)
//   theo yêu cầu: hai app kêu giống nhau.
// - Tôn trọng prefers-reduced-motion: chỉ phát nhạc, bỏ hiệu ứng chuyển động.
// - iOS chỉ cho phát âm sau CỬ CHỈ người dùng → primeCelebrationAudio() phải được gọi từ
//   một cú chạm TRONG PHIÊN (resume AudioContext lúc còn gesture); tới màn tổng kết context
//   đã "running" thì phát được, còn suspended thì im lặng bỏ qua.
import { useEffect, useRef } from "react";

let actx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!actx) actx = new AudioContext();
    return actx;
  } catch {
    return null;
  }
}

/** Gọi trong một cú chạm bất kỳ của phiên (mồi quyền phát âm cho iOS). */
export function primeCelebrationAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

// Fanfare ~1,5s như app HSK: tiếng gõ mộc kiểu marimba/chuông đồ chơi, giai điệu tự
// sáng tác Đô trưởng nhịp nảy — câu chạy lên → móc câu láy → rắc lấp lánh → chord kết.
function playFanfare(): void {
  const ctx = getCtx();
  if (!ctx || ctx.state !== "running") return; // chưa được mồi → thôi, không ép
  const t0 = ctx.currentTime + 0.05;
  // To hơn mà không vỡ: master đẩy cao + COMPRESSOR chặn đỉnh khi hợp âm 5 bè cộng dồn.
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.002;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  const pluck = (freq: number, at: number, dur = 0.3, vol = 1) => {
    for (const [mult, kVol, type] of [
      [1, 1, "sine"],
      [2, 0.35, "sine"],
      [3, 0.12, "triangle"],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(vol * kVol, t0 + at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
      o.connect(g).connect(master);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.05);
    }
  };
  const N = { C3: 130.81, G3: 196.0, C4: 261.63, G4: 392.0, A4: 440.0,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
    C6: 1046.5, E6: 1318.5, G6: 1568.0, A6: 1760.0, C7: 2093.0 };
  // câu chạy lấy đà
  pluck(N.C5, 0.0, 0.22, 0.9);
  pluck(N.D5, 0.09, 0.22, 0.85);
  pluck(N.E5, 0.18, 0.22, 0.9);
  pluck(N.G5, 0.27, 0.26, 0.95);
  // móc câu: nhảy lên láy xuống rồi bật lên cao — phần "vui" nhất
  pluck(N.C6, 0.42, 0.3, 1);
  pluck(N.A5, 0.57, 0.24, 0.85);
  pluck(N.C6, 0.69, 0.28, 0.95);
  pluck(N.E6, 0.84, 0.42, 1);
  // rắc lấp lánh chạy vút lên
  pluck(N.G6, 1.06, 0.18, 0.7);
  pluck(N.A6, 1.13, 0.18, 0.7);
  pluck(N.C7, 1.2, 0.5, 0.9);
  // bè trầm nảy như bước nhún
  pluck(N.C3, 0.0, 0.3, 0.9);
  pluck(N.G3, 0.42, 0.3, 0.85);
  pluck(N.C4, 0.84, 0.3, 0.85);
  // hợp âm kết C6/9-thêm-quãng-6 (C E G A) — tươi, ngân vừa phải
  for (const f of [N.C4, N.E5, N.G5, N.A5, N.C6]) pluck(f, 1.32, 1.0, 0.75);
  pluck(N.C3, 1.32, 1.0, 0.9);
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; w: number; h: number;
  color: string; life: number;
}

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7", "#ec4899", "#eab308"];

function burst(parts: Particle[], cx: number, cy: number, n: number, spread: number): void {
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const speed = 7 + Math.random() * 8;
    parts.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 5, h: 8 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    });
  }
}

export default function Celebration({ perfect = false }: { perfect?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return; // StrictMode/remount — chỉ nổ một lần
    firedRef.current = true;
    playFanfare();

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (reduced || !canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx2d.scale(dpr, dpr);

    const parts: Particle[] = [];
    burst(parts, W / 2, H * 0.55, perfect ? 90 : 60, 2.2); // giữa màn
    const t1 = window.setTimeout(() => burst(parts, W * 0.12, H * 0.7, 40, 1.2), 250); // hai cánh
    const t2 = window.setTimeout(() => burst(parts, W * 0.88, H * 0.7, 40, 1.2), 250);
    const t3 = perfect ? window.setTimeout(() => burst(parts, W / 2, H * 0.5, 70, 2.4), 700) : 0;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3); // chuẩn hoá theo 60fps, kẹp khi tab lag
      last = now;
      ctx2d.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.vy += 0.22 * dt; // trọng lực
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= 0.006 * dt;
        if (p.y > H + 20 || p.life <= 0) continue;
        alive++;
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.rot);
        ctx2d.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
        ctx2d.fillStyle = p.color;
        ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot))); // "lật" như giấy rơi
        ctx2d.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
      else canvas.remove(); // hết hạt → gỡ canvas, không che màn
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (t3) window.clearTimeout(t3);
    };
  }, [perfect]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden
    />
  );
}
