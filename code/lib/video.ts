// Video = bài hội thoại hoạt hình tương tác luyện NGHE & NÓI (docs/ENGLISH_VIDEO_PLAYBOOK.md).
// File này: KIỂU dữ liệu bài + hàm THUẦN dùng chung cho player, transcript, script build/kiểm và test —
// không đụng React/DOM/alias "@/" để node chạy thẳng được (node scripts/*.mjs import "../lib/video.ts").

export type Expression =
  | "neutral"
  | "happy"
  | "surprised"
  | "thinking"
  | "confused"
  | "sad"
  | "tired"
  | "tearful"
  | "angry"
  | "shy"
  | "worried"
  | "sick";
export type Gesture = "none" | "talking" | "nod" | "shake" | "point" | "wave" | "cheer" | "fall" | "bow" | "shrug" | "explain";

export const EXPRESSIONS: Expression[] = [
  "neutral",
  "happy",
  "surprised",
  "thinking",
  "confused",
  "sad",
  "tired",
  "tearful",
  "angry",
  "shy",
  "worried",
  "sick",
];
export const GESTURES: Gesture[] = ["none", "talking", "nod", "shake", "point", "wave", "cheer", "fall", "bow", "shrug", "explain"];

export interface VideoName {
  en: string;
  vi: string;
}

// Biến thể trang phục của một nhân vật trên nền preset (áo, kính, mũ, màu da…) — không cần preset mới
// cho từng vai. Khoá hợp lệ: STYLE_KEYS (script kiểm bài chặn khoá lạ).
export interface CastStyle {
  top?: string;
  topShade?: string;
  collar?: string;
  accent?: string; // màu nhãn người nói trong transcript
  hairColor?: string;
  outfit?: string;
  hat?: string;
  scarf?: string;
  glasses?: boolean;
  hair?: string;
  sleeve?: number; // 0..1
  scale?: number;
  skin?: string;
  skinShade?: string;
  iris?: string;
}
export const STYLE_KEYS = ["top", "topShade", "collar", "accent", "hairColor", "outfit", "hat", "scarf", "glasses", "hair", "sleeve", "scale", "skin", "skinShade", "iris"];

export interface CastMember {
  name: VideoName;
  look: string; // preset ngoại hình (components/video/rig.ts)
  style?: CastStyle;
  x: number; // vị trí đứng (viewBox 1600×900)
  // Vào / rời cảnh: `from` = chỉ số câu nhân vật bước vào; `until` = câu cuối còn ở lại.
  from?: number;
  until?: number;
  // Người ở ĐẦU DÂY (gọi điện / gọi video): hiện trong ô gọi ở góc trên; `bg` = bối cảnh sau lưng họ.
  call?: { bg?: string };
  voice?: string; // chỉ dùng lúc build audio
  rate?: string;
  pitch?: string;
}

export interface SceneProp {
  id: string;
  x: number;
  y?: number;
  back?: boolean;
  scale?: number;
  from?: number;
  until?: number;
}

export interface VideoLine {
  speaker: string | string[]; // khoá trong cast; mảng = nói đồng thanh
  en: string;
  vi: string;
  ipa?: string[]; // IPA (GA, dạng từ điển) theo TỪNG từ của lineTokens(en); "" = không có dữ liệu
  start: number; // giây — build đo trên PCM
  end: number;
  expression?: Expression;
  gesture?: Gesture;
  react?: Record<string, Expression>;
  prop?: string;
  // Bong bóng minh hoạ trên đầu người nói; có tham số viết "id:tham số" (clock:7:30 · money:25 …).
  thoughtBubble?: string;
  visual?: { lights?: "on" | "off"; fade?: number };
  timing?: [number, number][]; // [chỉ số TỪ trong câu, giây] — mốc từng từ (WordBoundary)
}

export interface VideoWord {
  id?: string; // lemma trong bộ từ (có → mở thẻ từ / "Học từ này"); cụm tự do thì không có
  en: string;
  ipa: string;
  vi: string;
  level?: number; // band học liệu 0..5 (A1..C2)
  note?: string;
}

// Trọng tâm NÓI của bài (chức năng giao tiếp): mẫu câu + giải thích + câu minh hoạ trong bài.
export interface VideoFocus {
  title: string; // tiếng Việt: "Nhờ giúp đỡ lịch sự"
  pattern: string; // "Could you…? · Would you mind + V-ing…?"
  explain: string;
  keys: string[]; // cụm cần tô trong câu ví dụ (không phân biệt hoa/thường)
  lines: number[];
  note?: string;
}

export interface VideoLesson {
  id: string;
  level: string; // a1..c2
  n: number;
  title: VideoName;
  summary: string;
  source?: { type: "story"; id: string; level: string; title?: VideoName };
  scene: { background: string; props?: SceneProp[]; weather?: "rain" | "snow" };
  cast: Record<string, CastMember>;
  lines: VideoLine[];
  words: VideoWord[];
  focus?: VideoFocus;
  audio: {
    src: string;
    v: string; // hash nội dung → ?v= (mp3 cache immutable)
    duration: number;
    fps: number; // tần số đường bao miệng
    mouth: string; // mỗi ký tự 0–9 = độ mở miệng tại khung i
  };
}

// Mục trong public/data/library/videos-index.json.
export interface VideoMeta {
  id: string;
  level: string;
  n: number;
  title: VideoName;
  summary: string;
  duration: number;
  lines: number;
  cast: number;
  story?: string; // id truyện nguồn
  focus?: string; // tiêu đề trọng tâm nói
}

// ---------- Tách từ một câu thoại ----------
// Đoạn chữ của câu: từ (có ' hoặc - bên trong, số, $3,500, 7:30) hoặc phần xen giữa (khoảng trắng,
// dấu câu). `w` = chỉ số từ (0..) hoặc -1. Build (mốc từ, IPA) và transcript DÙNG CHUNG hàm này.
export interface LineToken {
  t: string;
  w: number;
}
const WORD_RE = /(?:[A-Za-z]\.){2,}|[$£€]?\d+(?:[.,:]\d+)*(?:%|st|nd|rd|th|s|am|pm)?|[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ]+(?:['’][A-Za-z]+)*(?:-[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ]+(?:['’][A-Za-z]+)*)*/g;
export function lineTokens(text: string): LineToken[] {
  const out: LineToken[] = [];
  let last = 0;
  let w = 0;
  for (const m of text.matchAll(WORD_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), w: -1 });
    out.push({ t: m[0], w: w++ });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), w: -1 });
  return out;
}
export function wordCount(text: string): number {
  return lineTokens(text).filter((x) => x.w >= 0).length;
}

// "clock:7:30" → { id: "clock", arg: "7:30" }; bong bóng thường → arg rỗng.
export function parseBubble(b: string): { id: string; arg: string } {
  const k = b.indexOf(":");
  return k < 0 ? { id: b, arg: "" } : { id: b.slice(0, k), arg: b.slice(k + 1) };
}

export function speakersOf(line: Pick<VideoLine, "speaker">): string[] {
  return Array.isArray(line.speaker) ? line.speaker : [line.speaker];
}

export function audioUrl(lesson: VideoLesson): string {
  return `${lesson.audio.src}?v=${lesson.audio.v}`;
}

// ---------- Timeline ----------

// Câu "đang hoạt động" tại t = câu cuối cùng đã bắt đầu (giữ qua khoảng lặng giữa hai câu).
export function lineIndexAt(lines: readonly Pick<VideoLine, "start">[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

// Độ mở miệng 0..1 tại t (đường bao âm lượng tính lúc build).
export function mouthAt(audio: VideoLesson["audio"], t: number): number {
  const i = Math.floor(t * audio.fps);
  if (i < 0 || i >= audio.mouth.length) return 0;
  return (audio.mouth.charCodeAt(i) - 48) / 9;
}

// Chỉ số TỪ đang được đọc trong câu (theo mốc từng từ); -1 nếu chưa tới / không có mốc.
export function wordAt(line: Pick<VideoLine, "timing" | "end">, t: number): number {
  const m = line.timing;
  if (!m?.length || t < m[0][1] || t > line.end + 0.05) return -1;
  let c = -1;
  for (const [wi, ts] of m) {
    if (ts <= t) c = wi;
    else break;
  }
  return c;
}

export interface CastState {
  expression: Expression;
  since: number;
}

// Trạng thái RỜI RẠC của cảnh sau câu `idx` (tích luỹ từ đầu bài): biểu cảm giữ tới khi đổi.
export function sceneAt(lesson: Pick<VideoLesson, "cast" | "lines">, idx: number): Record<string, CastState> {
  const out: Record<string, CastState> = {};
  for (const id of Object.keys(lesson.cast)) out[id] = { expression: "neutral", since: -1 };
  for (let i = 0; i <= idx && i < lesson.lines.length; i++) {
    const l = lesson.lines[i];
    if (l.expression) for (const sp of speakersOf(l)) out[sp] = { expression: l.expression, since: l.start };
    if (l.react)
      for (const [id, e] of Object.entries(l.react)) if (out[id]) out[id] = { expression: e, since: l.start };
  }
  return out;
}

// Mốc đổi đèn: đèn bật/tắt SỚM hơn câu một chút (LEAD) để hình đi trước tiếng như phim.
export const LIGHTS_LEAD = 0.25;
export const LIGHTS_FADE = 0.18;
export function lightsAt(lines: Pick<VideoLine, "visual" | "start">[], t: number): { on: boolean; since: number; dur: number } {
  let on = lines[0]?.visual?.lights !== "off";
  let since = -Infinity;
  let dur = LIGHTS_FADE;
  for (const l of lines) {
    const v = l.visual?.lights;
    if (!v) continue;
    const at = l.start - LIGHTS_LEAD;
    if (at > t) break;
    if ((v === "on") !== on) {
      since = at;
      dur = l.visual?.fade ?? LIGHTS_FADE;
    }
    on = v === "on";
  }
  return { on, since, dur };
}

// Nhân vật có trên sân khấu ở câu `idx` không (gắn sớm 1 câu trước `from`, giữ thêm 1 câu sau `until`).
export function castOnStage(c: Pick<CastMember, "from" | "until">, idx: number): boolean {
  if (c.from !== undefined && idx < c.from - 1) return false;
  if (c.until !== undefined && idx > c.until + 1) return false;
  return true;
}

// Đạo cụ có đang hiện ở câu `idx` không.
export function propVisible(p: SceneProp, idx: number): boolean {
  if (p.from !== undefined && idx < p.from) return false;
  if (p.until !== undefined && idx > p.until) return false;
  return true;
}

// Câu có chứa cụm khoá (không phân biệt hoa/thường, khớp theo ranh giới từ).
export function keyRanges(text: string, keys: string[]): [number, number][] {
  const out: [number, number][] = [];
  const low = text.toLowerCase().replace(/’/g, "'");
  for (const k of keys) {
    const kk = k.toLowerCase().replace(/’/g, "'").trim();
    if (!kk) continue;
    let from = 0;
    for (;;) {
      const i = low.indexOf(kk, from);
      if (i < 0) break;
      const before = i === 0 || !/[a-z0-9']/.test(low[i - 1]);
      const after = i + kk.length >= low.length || !/[a-z0-9']/.test(low[i + kk.length]) || /[^a-z0-9]$/.test(kk);
      if (before && after) out.push([i, i + kk.length]);
      from = i + kk.length;
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
