"use client";

// PHÁO HOA + NHẠC CHÚC MỪNG cho màn tổng kết phiên học/ôn.
// - Confetti tự vẽ trên canvas toàn màn (không thêm dependency, ~2,5s rồi tự gỡ).
// - Fanfare tổng hợp bằng Web Audio (không cần file mp3 — offline sẵn, không vướng bản quyền).
// - Tôn trọng prefers-reduced-motion: chỉ phát nhạc, bỏ hiệu ứng chuyển động.
// - iOS chặn audio ngoài cử chỉ người dùng → phát best-effort, bị chặn thì im lặng bỏ qua
//   (confetti vẫn nổ; thực tế màn tổng kết hiện ngay sau cú chạm cuối nên thường vẫn kêu).
import { useEffect, useRef } from "react";

// Hợp âm rải Đô trưởng đi lên + chord kết — vui tai kiểu chuông thắng trận, ~1,4s.
function playFanfare(big: boolean): void {
  try {
    const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.16; // nhẹ nhàng — âm báo, không phải nhạc nền
    master.connect(ctx.destination);

    const note = (freq: number, at: number, dur: number, vol = 1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + at);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
      osc.connect(gain).connect(master);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + dur + 0.05);
    };

    // C5 → E5 → G5 → C6 rải nhanh, rồi chord C trưởng ngân
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => note(f, i * 0.09, 0.35, 0.9));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 0.42, big ? 1.0 : 0.7, 0.5));
    if (big) [587.33, 880].forEach((f) => note(f, 0.66, 0.9, 0.35)); // phiên hoàn hảo: thêm lớp D5+A5 lấp lánh

    window.setTimeout(() => void ctx.close().catch(() => {}), 2500);
  } catch {
    /* audio là phụ trợ — lỗi/bị chặn thì bỏ qua */
  }
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
    playFanfare(perfect);

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
