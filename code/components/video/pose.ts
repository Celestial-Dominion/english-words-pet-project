// Tư thế nhân vật / đạo cụ / bong bóng / đèn tại thời điểm t — HÀM THUẦN của (bài, t).
// Không dùng animation CSS theo giờ thực: tạm dừng là đứng hình đúng khung, tua là ra
// đúng tư thế, và sau này xuất MP4 chỉ cần gọi lại các hàm này theo từng khung.
import {
  castOnStage,
  lightsAt,
  mouthAt,
  speakersOf,
  type CastState,
  type VideoLesson,
  type VideoLine,
} from "@/lib/video";
import { lookOf, PROP_CENTER_H, shoulderOf, STAGES } from "./rig";
import type { BackgroundId } from "@/lib/video-assets";

export interface CharPose {
  bodyX: number; // lệch ngang (toạ độ nhân vật) khi đang bước vào / đi ra khỏi cảnh
  bodyY: number;
  bodyRot: number; // nghiêng thân quanh eo (độ, + = cúi về phía mặt đang hướng) — cúi chào
  headX: number;
  headY: number;
  headRot: number;
  eyeOpen: number; // 1 = mở bình thường, 0 = nhắm
  gazeX: number; // lệch tròng mắt (toạ độ đầu)
  gazeY: number;
  mouth: number; // 0..1 độ mở khi đang nói
  armL: number; // độ xoay tay (0 = buông thẳng)
  armR: number;
  emote: number; // 0..1 cỡ dấu "!" / "?"
  tear: number; // pha giọt nước mắt 0..1, -1 = không khóc
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const backOut = (v: number) => {
  const x = clamp01(v) - 1;
  return 1 + 2.7 * x * x * x + 1.7 * x * x;
};
const REST = 7; // tay buông hơi chếch ra ngoài

// +1 = nhìn sang phải, -1 = trái: quay về phía những người còn lại trong cảnh.
// Người ở đầu dây (cast.call) nhìn vào giữa cảnh; người trong cảnh quay về người trong cảnh (chỉ khi
// không còn ai khác mới quay về phía ô gọi).
export function facingOf(lesson: VideoLesson, id: string): 1 | -1 {
  const me = lesson.cast[id];
  if (me.call) return me.x < 800 ? 1 : -1;
  const rest = Object.entries(lesson.cast).filter(([k]) => k !== id);
  const room = rest.filter(([, c]) => !c.call);
  const others = (room.length ? room : rest).map(([, c]) => c.x);
  const avg = others.reduce((a, b) => a + b, 0) / Math.max(others.length, 1);
  return avg >= me.x ? 1 : -1;
}

// Bước vào / đi ra: lệch ngang (toạ độ cảnh) tại t — trượt từ/ra mép gần nhất trong ~0,55 s.
// Vào: kết thúc ngay trước câu `from` (trong khoảng lặng trước câu); ra: bắt đầu 0,25 s sau câu `until`.
const OFFSTAGE = 1000;
export function stageOffset(lesson: VideoLesson, id: string, t: number): number {
  const c = lesson.cast[id];
  if (c.call) return 0; // ô gọi bật/tắt bằng callScale, không trượt
  const dir = c.x >= 800 ? 1 : -1;
  let out = 0;
  if (c.from !== undefined && lesson.lines[c.from]) {
    const prevEnd = c.from > 0 ? lesson.lines[c.from - 1].end : 0;
    const t0 = Math.max(prevEnd + 0.05, lesson.lines[c.from].start - 0.6);
    out += (1 - ease((t - t0) / 0.55)) * dir * OFFSTAGE;
  }
  if (c.until !== undefined && lesson.lines[c.until]) {
    const t1 = lesson.lines[c.until].end + 0.25;
    out += ease((t - t1) / 0.6) * dir * OFFSTAGE;
  }
  return out;
}

// Hướng nhìn (toạ độ nhân vật, +1 = phía mặt đang hướng) trong câu `idx`:
// người nghe nhìn người nói, người nói nhìn người nghe (chỉ những ai đang có mặt).
function gazeDir(lesson: VideoLesson, idx: number, id: string, facing: number): number {
  if (lesson.cast[id].call) return 1; // người ở đầu dây nhìn vào máy (về phía cảnh)
  const line = lesson.lines[idx];
  const me = lesson.cast[id].x;
  const here = (k: string) => k !== id && castOnStage(lesson.cast[k], idx);
  let xs: number[];
  if (!line) xs = Object.keys(lesson.cast).filter(here).map((k) => lesson.cast[k].x);
  else {
    const sp = speakersOf(line);
    xs = (sp.includes(id)
      ? Object.keys(lesson.cast).filter((k) => !sp.includes(k) && here(k))
      : sp
    ).map((k) => lesson.cast[k].x);
  }
  if (!xs.length) return 1;
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sign(avg - me || 1) * facing;
}

// Nháy mắt tất định theo seed: chu kỳ 3,4–5,2 s, mỗi lần ~0,14 s.
function blink(t: number, seed: number): number {
  const period = 3.4 + (seed % 5) * 0.45;
  const local = (t + seed * 0.83) % period;
  return local < 0.14 ? Math.sin((Math.PI * local) / 0.14) : 0;
}

export function charPose(
  lesson: VideoLesson,
  idx: number,
  t: number,
  states: Record<string, CastState>,
  id: string,
  seed: number,
): CharPose {
  const c = lesson.cast[id];
  const look = lookOf(c);
  const facing = facingOf(lesson, id);
  const line: VideoLine | undefined = lesson.lines[idx];
  const speaking = !!line && speakersOf(line).includes(id);
  const st = states[id] ?? { expression: "neutral", since: -1 };
  const e = st.expression;
  const sinceE = t - st.since;

  const p: CharPose = {
    bodyX: stageOffset(lesson, id, t) / (facing * look.scale),
    bodyY: 0,
    bodyRot: 0,
    headX: 0,
    headY: 0,
    headRot: 0,
    eyeOpen: 1,
    gazeX: 0,
    gazeY: 0,
    mouth: 0,
    armL: REST,
    armR: -REST,
    emote: 0,
    tear: -1,
  };

  // Hướng nhìn: chuyển mượt từ câu trước sang câu này trong 0,35 s.
  const dNow = gazeDir(lesson, idx, id, facing);
  const dPrev = idx > 0 ? gazeDir(lesson, idx - 1, id, facing) : dNow;
  const k = line ? ease((t - line.start) / 0.35) : 1;
  const dir = dPrev + (dNow - dPrev) * k;
  p.gazeX = dir * (speaking ? 3.5 : 5);
  if (!speaking && line) {
    p.headRot = dir * 3;
    p.headX = dir * 2;
  }

  // Miệng theo đường bao âm lượng, chỉ trong câu của mình.
  if (speaking && t >= line.start - 0.02 && t <= line.end + 0.08) {
    p.mouth = mouthAt(lesson.audio, t);
    p.bodyY -= p.mouth * 2;
  }

  // Biểu cảm.
  const eyeBase: Partial<Record<string, number>> = {
    tired: 0.5,
    sad: 0.78,
    happy: 0.9,
    tearful: 0.86,
    surprised: 1.18,
    angry: 0.84,
    shy: 0.8,
    worried: 1.06,
    sick: 0.6,
  };
  p.eyeOpen = eyeBase[e] ?? 1;
  if (e === "thinking") {
    p.gazeX = -3;
    p.gazeY = -6;
    p.headRot += 4;
  }
  if (e === "confused") p.headRot += 8;
  if (e === "sad") p.headY += 4;
  if (e === "tired") {
    p.headY += 5;
    p.headRot -= 3;
  }
  if (e === "shy") {
    p.gazeY = 5;
    p.gazeX *= 0.4;
    p.headY += 4;
    p.headRot -= 4;
  }
  if (e === "worried") p.headRot += 4;
  if (e === "sick") {
    p.headY += 5;
    p.headRot += 5;
  }
  if (e === "angry") p.headY -= 2;
  if (e === "surprised") p.headY -= 12 * Math.sin(Math.PI * clamp01(sinceE / 0.35));
  if ((e === "surprised" || e === "confused") && sinceE >= 0 && sinceE < 2) {
    p.emote = backOut(sinceE / 0.28) * (1 - ease((sinceE - 1.6) / 0.35));
  }
  if (e === "tearful") p.tear = ((sinceE % 1.5) + 1.5) % 1.5 / 1.5;

  // Nháy mắt (không nháy ngay lúc vừa ngạc nhiên).
  if (!(e === "surprised" && sinceE < 0.7)) p.eyeOpen *= 1 - 0.95 * blink(t, seed);

  // Cử chỉ của câu đang nói.
  if (speaking && line.gesture && line.gesture !== "none" && line.gesture !== "talking") {
    const g = line.gesture;
    const q = t - line.start;
    const after = t - line.end;
    const hold = ease(q / 0.3) * (after > 0 ? 1 - ease(after / 0.3) : 1);
    if (g === "nod" && q >= 0 && q < 0.8) p.headY += 7 * Math.max(0, Math.sin((2 * Math.PI * 2 * q) / 0.8));
    if (g === "shake" && q >= 0 && q < 0.9) {
      const w = Math.sin((2 * Math.PI * 3 * q) / 0.9) * (1 - q / 0.9);
      p.headX += 8 * w;
      p.headRot += 5 * w;
    }
    if (g === "cheer") {
      p.armL = REST + (150 - REST) * hold;
      p.armR = -REST + (-150 + REST) * hold;
      if (q >= 0 && q < 1) p.bodyY -= 9 * Math.abs(Math.sin(2 * Math.PI * 1.5 * q));
    }
    if (g === "wave") {
      const a = -150 + 12 * Math.sin(2 * Math.PI * 2.4 * q);
      p.armR = -REST + (a + REST) * hold;
    }
    if (g === "fall") {
      // Trượt ngã: tụt xuống sau mép che rất nhanh, giữ trong câu, đứng dậy ngay sau câu (0,4 s —
      // kịp trước câu kế, kể cả khi cùng người nói tiếp sau 0,45 s).
      const down = ease(q / 0.2) * (after > 0 ? 1 - ease(after / 0.4) : 1);
      p.bodyY += 120 * down;
      p.headRot += 9 * down;
      p.armL = REST + 55 * down;
      p.armR = -REST - 55 * down;
    }
    if (g === "bow") {
      // Cúi chào (xin lỗi / cảm ơn trịnh trọng): cúi trong 0,35 s, giữ, đứng thẳng ngay sau câu.
      const down = ease(q / 0.35) * (after > 0 ? 1 - ease(after / 0.35) : 1);
      p.bodyRot += 16 * down;
      p.headRot += 7 * down;
      p.gazeY = 4 * down;
    }
    if (g === "shrug") {
      // Nhún vai, xoè tay (không biết / đành chịu): hai tay chếch ra, vai nhô, đầu nghiêng.
      const k2 = q >= 0 && q < 0.9 ? Math.sin((Math.PI * q) / 0.9) : 0;
      p.armL = REST + 34 * hold;
      p.armR = -REST - 34 * hold;
      p.headRot += 7 * hold;
      p.headY -= 4 * k2;
      p.bodyY -= 3 * k2;
    }
    if (g === "explain") {
      // Giải thích: tay phía người nghe đưa ra trước, nhịp nhẹ theo lời.
      const a = -58 + 7 * Math.sin(2 * Math.PI * 1.3 * q);
      p.armR = -REST + (a + REST) * hold;
    }
    if (g === "point") {
      const stage = STAGES[lesson.scene.background as BackgroundId];
      const prop = line.prop && lesson.scene.props?.find((x) => x.id === line.prop);
      // Đích trong toạ độ nhân vật (đã tính lật ngang + tỉ lệ).
      const tx = prop ? ((prop.x - c.x) * facing) / look.scale : 260;
      const ty = prop
        ? ((prop.y ?? stage.tableTop) - (PROP_CENTER_H[prop.id] ?? 60) * (prop.scale ?? 1) - stage.baseY) / look.scale
        : look.shoulderY + 60;
      const side: -1 | 1 = tx >= 0 ? 1 : -1;
      const sh = shoulderOf(look, side);
      let ang = (Math.atan2(-(tx - sh.x), ty - sh.y) * 180) / Math.PI;
      const mag = Math.min(120, Math.max(40, Math.abs(ang)));
      ang = Math.sign(ang || -side) * mag;
      if (side === 1) p.armR = -REST + (ang + REST) * hold;
      else p.armL = REST + (ang - REST) * hold;
    }
  }
  return p;
}

// Ô gọi của người ở đầu dây: cỡ 0..1 — bật lên trong khoảng lặng trước câu `from`, tắt 0,25 s sau câu `until`.
export function callScale(lesson: VideoLesson, id: string, t: number): number {
  const c = lesson.cast[id];
  let k = 1;
  if (c.from !== undefined && lesson.lines[c.from]) {
    const prevEnd = c.from > 0 ? lesson.lines[c.from - 1].end : 0;
    const t0 = Math.max(prevEnd + 0.05, lesson.lines[c.from].start - 0.5);
    k *= backOut((t - t0) / 0.32);
  }
  if (c.until !== undefined && lesson.lines[c.until]) k *= 1 - ease((t - lesson.lines[c.until].end - 0.25) / 0.3);
  return Math.max(0, k);
}

// Tay đang chỉ (để vẽ ngón trỏ): -1 trái, 1 phải, 0 không chỉ.
export function pointingSide(lesson: VideoLesson, idx: number, id: string): -1 | 0 | 1 {
  const line = lesson.lines[idx];
  if (!line || line.gesture !== "point" || !speakersOf(line).includes(id)) return 0;
  const prop = line.prop && lesson.scene.props?.find((x) => x.id === line.prop);
  if (!prop) return 1;
  return (prop.x - lesson.cast[id].x) * facingOf(lesson, id) >= 0 ? 1 : -1;
}

// Đèn: 1 = sáng, 0 = tối; chuyển trong `dur` (0,18 s như công tắc, bình minh vài giây).
export function litAt(lesson: VideoLesson, t: number): number {
  const { on, since, dur } = lightsAt(lesson.lines, t);
  if (!Number.isFinite(since)) return on ? 1 : 0;
  const k = ease((t - since) / dur);
  return on ? k : 1 - k;
}

// Đạo cụ được nhắc trong câu (hoặc vừa xuất hiện ở câu này): nảy lên một nhịp (0..1).
export function propPulse(lesson: VideoLesson, idx: number, t: number, prop: string): number {
  const line = lesson.lines[idx];
  const appears = lesson.scene.props?.some((p) => p.id === prop && p.from === idx);
  if (!line || (line.prop !== prop && !appears)) return 0;
  const q = (t - line.start - 0.05) / 0.65;
  return q > 0 && q < 1 ? Math.sin(Math.PI * q) : 0;
}

// Bong bóng minh hoạ: cỡ 0..1 (nảy vào đầu câu, thu lại sau câu ~0,5 s).
export function bubbleScale(lesson: VideoLesson, idx: number, t: number): number {
  const line = lesson.lines[idx];
  if (!line?.thoughtBubble) return 0;
  return backOut((t - line.start + 0.05) / 0.3) * (1 - ease((t - line.end - 0.45) / 0.3));
}
