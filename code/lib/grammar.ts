// Ngữ pháp (docs/ENGLISH_GRAMMAR_PLAYBOOK.md): KIỂU dữ liệu bài đã build (public/data/grammar/lessons/{id}.json)
// + hàm THUẦN dùng chung cho player, bảng, luyện tập, tiến độ, đồng bộ và test — không đụng React/DOM/Dexie/alias
// "@/" để node chạy thẳng được (scripts/*.mjs import "../lib/grammar.ts").

export type SectionId =
  | "hook"
  | "meaning"
  | "form"
  | "examples"
  | "real"
  | "dialogue"
  | "contrast"
  | "mistakes"
  | "natural"
  | "pronunciation"
  | "recall"
  | "recap";

export const SECTIONS: Record<SectionId, string> = {
  hook: "Mở đầu",
  meaning: "Ý nghĩa",
  form: "Cấu trúc",
  examples: "Ví dụ",
  real: "Trong đời sống",
  dialogue: "Hội thoại",
  contrast: "Phân biệt",
  mistakes: "Lỗi thường gặp",
  natural: "Tự nhiên hay không?",
  pronunciation: "Phát âm",
  recall: "Thử nhớ lại",
  recap: "Tóm tắt",
};
export const SECTION_IDS = Object.keys(SECTIONS) as SectionId[];

// Vai của một chỗ được nhấn trong câu: dạng đích · chủ ngữ · động từ · trợ động từ · tân ngữ · thời gian/nơi chốn ·
// phủ định · từ hỏi · bổ ngữ/mệnh đề. Màu cố định theo vai (ROLE_CLASS ở components/grammar/en-line.tsx).
export type Role = "k" | "s" | "v" | "a" | "o" | "t" | "n" | "q" | "c";
export const ROLES: Role[] = ["k", "s", "v", "a", "o", "t", "n", "q", "c"];
export const ROLE_LABEL: Record<Role, string> = {
  k: "dạng đang học",
  s: "chủ ngữ",
  v: "động từ",
  a: "trợ động từ",
  o: "tân ngữ",
  t: "thời gian / nơi chốn",
  n: "phủ định",
  q: "từ hỏi",
  c: "bổ ngữ / mệnh đề",
};

export type Span = [from: number, to: number, role: Role]; // chỉ số KÝ TỰ trong câu tiếng Anh

// Một đoạn lời giảng: tiếng Việt (v) HOẶC tiếng Anh chen giữa (e — đọc bằng giọng Anh của cô giáo).
export interface NarrPart {
  v?: string;
  e?: string;
}

interface BeatBase {
  sec: SectionId;
  b: number; // chỉ số bảng trong lesson.boards
  start: number; // giây — build đo trên PCM
  end: number;
}
export interface NarrBeat extends BeatBase {
  k: "n";
  parts: NarrPart[];
  // [mục trên bảng, giây]: lời giảng đọc tới mảnh tiếng Anh trùng một chỗ trên bảng → nhấn chỗ đó.
  cues?: [number, number][];
  hold?: 1; // "thử nhớ lại": phát xong câu này thì tự dừng, chờ người học bấm xem đáp án
}
export interface LineAnn {
  expression?: string;
  gesture?: string;
  react?: Record<string, string>;
  prop?: string;
  bubble?: string;
}
export interface LineBeat extends BeatBase {
  k: "e";
  en: string;
  vi: string;
  ipa?: string[]; // IPA (GA, dạng từ điển) theo từng TỪ của lineTokens(en); "" = không có dữ liệu
  hl?: Span[];
  who?: string; // khoá vai trong lesson.cast (hội thoại); không có = cô giáo đọc
  note?: string;
  bad?: { en: string; hl?: Span[] }; // câu SAI tương ứng (chỉ hiện, không đọc)
  timing?: [number, number][]; // [chỉ số TỪ, giây] — mốc từng từ (karaoke)
  ann?: LineAnn; // biểu cảm / cử chỉ / đạo cụ của vai trong cảnh hội thoại
}
export type Beat = NarrBeat | LineBeat;

export interface Chip {
  x: string;
  en?: 1; // chip tiếng Anh (dạng đích) — tô màu khoá; không có = nhãn tiếng Việt / ký hiệu
}
// Mốc trên trục thời gian: at (−3 … 3; 0 = bây giờ); to = khoảng (việc kéo dài / tới bây giờ); wave = tiếp diễn.
export interface TimeMark {
  at: number;
  to?: number;
  label: string;
  vi?: string;
  now?: 1;
  wave?: 1;
}
export type RankGrade = "best" | "ok" | "odd" | "bad";
export interface RankItem {
  en: string;
  vi?: string;
  g: RankGrade;
  beat?: number; // câu được đọc (best / ok)
}
export interface SoundRow {
  a: string; // dạng viết đầy đủ / từ
  b?: string; // dạng nói (rút gọn, âm yếu) hoặc nhãn âm (/t/)
  ipa: string;
}
export type Board =
  | { type: "title"; sec?: SectionId } // bìa bài; có sec = thẻ mở phần mới
  | { type: "formula"; rows: Chip[][]; cap?: string }
  | { type: "line"; beat: number }
  | { type: "pair"; beats: number[]; labels?: string[] }
  | { type: "fix"; beat: number }
  | { type: "timeline"; marks: TimeMark[] }
  | { type: "move"; from: string[]; to: string[] }
  | { type: "table"; head?: string[]; rows: string[][] }
  | { type: "sound"; rows: SoundRow[] }
  | { type: "rank"; items: RankItem[] }
  | { type: "scene" }
  | { type: "quiz"; q: string; beat?: number }
  | { type: "recap" };
export type BoardType = Board["type"];

export const RANK_LABEL: Record<RankGrade, string> = {
  best: "Tự nhiên nhất",
  ok: "Đúng, ít dùng hơn",
  odd: "Đúng ngữ pháp nhưng lạ",
  bad: "Sai",
};

export type Exercise =
  | {
      k: "fill" | "choice" | "natural" | "fix" | "contrast" | "transform";
      q?: string; // đề / yêu cầu (tiếng Việt)
      stem?: string; // câu có chỗ trống ___ (fill / contrast), câu sai (fix), câu gốc (transform)
      o: string[];
      a: number; // chỉ số đáp án đúng trong o (runtime xáo lại)
      why?: string;
    }
  | {
      k: "type";
      stem: string; // câu có chỗ trống ___ (+ gợi ý trong ngoặc)
      ans: string[]; // mọi đáp án chấp nhận
      why?: string;
    }
  | {
      k: "order";
      parts: string[]; // các khối theo ĐÚNG thứ tự
      alt?: number[][]; // thứ tự khác cũng đúng (chỉ số khối)
      end: string; // dấu câu cuối
      vi: string;
      why?: string;
    }
  | {
      k: "listen";
      beat: number; // câu trong audio bài (không file mới)
      o: string[]; // phương án: câu tiếng Anh nghe được (en) hoặc nghĩa tiếng Việt
      a: number;
      en?: 1; // phương án là câu tiếng Anh (nghe rồi chọn đúng câu vừa nghe)
      why?: string;
    };
export type ExerciseKind = Exercise["k"];

export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  fill: "Điền vào chỗ trống",
  type: "Gõ từ còn thiếu",
  choice: "Chọn đáp án",
  natural: "Câu nào tự nhiên?",
  fix: "Sửa lỗi",
  contrast: "Phân biệt",
  transform: "Viết lại câu",
  order: "Sắp xếp câu",
  listen: "Nghe rồi chọn",
};

export interface LessonRef {
  id: string;
  lv: string;
  t: string;
  en: string;
}

export interface GrammarCast {
  name: { en: string; vi: string };
  look: string;
  style?: Record<string, unknown>;
  x: number;
  from?: number; // câu hội thoại (đếm trong các câu có vai) nhân vật bước vào / câu cuối còn ở lại
  until?: number;
  call?: { bg?: string };
}

export interface LessonWord {
  id: string;
  ipa: string;
  vi: string;
  level: number; // band 0..5 (A1..C2)
}

export interface GrammarLesson {
  id: string;
  lv: string; // a1..c2
  n: number; // số thứ tự trong cấp
  cat: string;
  t: string; // tên bài (tiếng Việt)
  en: string; // nhãn mẫu tiếng Anh
  reg?: string;
  kind?: "contrast";
  sum: string;
  forms: { f: string; vi?: string }[];
  pts: { id: string; name: string; vi: string }[];
  cast?: Record<string, GrammarCast>;
  bg?: string; // bối cảnh cảnh hội thoại (id bối cảnh Video)
  props?: { id: string; x: number; y?: number; back?: boolean; scale?: number }[];
  beats: Beat[];
  boards: Board[];
  ex: Exercise[];
  words?: LessonWord[];
  audio: { src: string; v: string; duration: number; fps: number; mouth: string };
}

// Liên kết ngoài bài (tính lúc build trang — không nằm trong JSON bài để bài không phải build lại khi thư viện đổi).
export interface CorpusLink {
  type: "reading" | "story" | "video";
  id: string;
  level: string;
  title: string;
  en: string;
}

// Mục trong public/data/grammar/index.json (chỉ đọc lúc build trang tĩnh — client KHÔNG tải chỉ mục).
export interface GrammarMeta {
  id: string;
  lv: string;
  n: number;
  cat: string;
  t: string;
  en: string;
  reg?: string;
  kind?: "contrast";
  sum: string;
  dur: number;
  ex: number;
  v: string; // hash nội dung JSON → ?v= (cache immutable)
  pre: string[];
  vs: string[];
  rel: string[];
  corpus?: CorpusLink[];
}
export interface GrammarIndex {
  cats: Record<string, string>;
  lessons: GrammarMeta[];
  // học liệu → bài ngữ pháp có mẫu nổi bật trong đó (Reading · Story · Video → Ngữ pháp)
  content: Record<string, string[]>;
}

export const REG_LABEL: Record<string, string> = {
  spoken: "Khẩu ngữ",
  written: "Văn viết",
  formal: "Trang trọng",
  informal: "Thân mật",
  academic: "Học thuật",
  literary: "Văn chương",
};
export function regLabels(reg?: string): string[] {
  return (reg ?? "")
    .split(",")
    .map((r) => REG_LABEL[r.trim()])
    .filter(Boolean);
}

export const GRAMMAR_BASE = "/data/grammar";
export function lessonJsonUrl(id: string, v: string): string {
  return `${GRAMMAR_BASE}/lessons/${encodeURIComponent(id)}.json?v=${v}`;
}
export function audioUrlOf(l: Pick<GrammarLesson, "audio">): string {
  return `${l.audio.src}?v=${l.audio.v}`;
}
export function lessonHref(r: { lv: string; id: string }): string {
  return `/ngu-phap/${r.lv}/${r.id}`;
}

// ---------- Timeline ----------

// Mục đang được nhấn trên bảng tại t trong một câu giảng (-1 = chưa tới cue nào).
export function cueAt(beat: Beat | undefined, t: number): number {
  if (!beat || beat.k !== "n" || !beat.cues?.length || t < beat.start - 0.05 || t > beat.end + 0.6) return -1;
  let c = -1;
  for (const [target, ts] of beat.cues) {
    if (ts <= t) c = target;
    else break;
  }
  return c;
}

// Các khúc transcript theo phần: [{ sec, from, to }] (to = chỉ số sau câu cuối).
export function sectionsOf(beats: readonly Pick<Beat, "sec">[]): { sec: SectionId; from: number; to: number }[] {
  const out: { sec: SectionId; from: number; to: number }[] = [];
  beats.forEach((b, i) => {
    const last = out[out.length - 1];
    if (last && last.sec === b.sec) last.to = i + 1;
    else out.push({ sec: b.sec, from: i, to: i + 1 });
  });
  return out;
}

// Câu "thử nhớ lại" → tự dừng sau câu đó.
export function holdSet(beats: readonly Beat[]): Set<number> {
  const s = new Set<number>();
  beats.forEach((b, i) => {
    if (b.k === "n" && b.hold) s.add(i);
  });
  return s;
}

// Người đang nói ở đoạn i: vai hội thoại, hoặc "teacher" (lời giảng + câu ví dụ).
export function speakerOf(b: Beat | undefined): string {
  if (!b) return "";
  return b.k === "e" && b.who ? b.who : "teacher";
}

// Cắt chuỗi theo các khoảng nhấn → [{ text, from, role?, span? }] (khoảng chồng nhau: khoảng mở trước thắng).
export function splitSpans(text: string, spans: readonly Span[] | undefined): { text: string; from: number; role?: Role; span?: number }[] {
  const tag: (number | undefined)[] = new Array(text.length).fill(undefined);
  (spans ?? []).forEach(([a, b], k) => {
    for (let i = Math.max(0, a); i < Math.min(text.length, b); i++) if (tag[i] === undefined) tag[i] = k;
  });
  const out: { text: string; from: number; role?: Role; span?: number }[] = [];
  for (let i = 0; i < text.length; ) {
    const k = tag[i];
    let j = i + 1;
    while (j < text.length && tag[j] === k) j++;
    out.push({ text: text.slice(i, j), from: i, ...(k !== undefined ? { role: spans![k][2], span: k } : {}) });
    i = j;
  }
  return out;
}

// ---------- Luyện tập ----------

export const PASS_SCORE = 70; // % đúng để tính "đã học"
export const BLANK = "___"; // chỗ trống trong câu điền từ

// Thứ tự người học xếp (chỉ số khối) có đúng không: đúng thứ tự gốc, một thứ tự thay thế đã khai, hoặc cùng chuỗi chữ.
export function orderCorrect(ex: Extract<Exercise, { k: "order" }>, picked: readonly number[]): boolean {
  const same = (a: readonly number[]) => a.length === picked.length && a.every((x, i) => x === picked[i]);
  if (same(ex.parts.map((_, i) => i))) return true;
  const norm = (arr: readonly string[]) => arr.join(" ").toLowerCase();
  if (picked.length === ex.parts.length && norm(picked.map((i) => ex.parts[i] ?? "")) === norm(ex.parts)) return true;
  return (ex.alt ?? []).some(same);
}

// Chuẩn hoá câu trả lời gõ tay: thường hoá, nháy cong → thẳng, bỏ dấu câu đầu/cuối, gộp khoảng trắng.
export function normAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,!?;:"“”]+|[\s.,!?;:"“”]+$/g, "")
    .trim();
}
export function typeCorrect(ex: Extract<Exercise, { k: "type" }>, answer: string): boolean {
  const a = normAnswer(answer);
  return !!a && ex.ans.some((x) => normAnswer(x) === a);
}

// ---------- Tiến độ & ôn lại (lịch giãn cách RIÊNG của Ngữ pháp, không trộn hàng đợi Ôn tập từ) ----------

export interface GrammarRow {
  id: string;
  doneAt?: string; // ISO — lần đầu đạt (đã học)
  lastAt?: string; // ISO — lần luyện gần nhất
  reps: number; // số lần đạt liên tiếp (quyết định khoảng ôn)
  best: number; // điểm cao nhất (0–100)
  last?: number; // điểm lần gần nhất
  off?: 1; // người học BỎ đánh dấu đã học (bản ghi mới hơn mang cờ này thắng khi hợp nhất)
  man?: 1; // đã học do TÍCH TAY (không luyện) → không xếp lịch ôn; lần luyện tập sau đó mới bắt đầu lịch
}

// Khoảng ôn (ngày) theo số lần đạt liên tiếp — trần 120 ngày.
export const REVIEW_DAYS = [1, 3, 7, 14, 30, 60, 120];

export function isLearned(r: GrammarRow | undefined): boolean {
  return !!r?.doneAt;
}

// Đã học nhờ tích tay, chưa luyện tập lại kể từ đó → KHÔNG có lịch ôn. Dòng tạo trước khi có cờ `man` (markLearned bản
// cũ "như đạt một lần", danh sách đã học kiểu cũ) vẫn nhận ra được: reps ≥ 1 mà chưa từng đạt luyện tập (best < PASS) —
// lần luyện đạt nào cũng đẩy best ≥ PASS. Nhờ vậy cờ có rơi mất (bản app cũ còn mở ghi đè khi đồng bộ) vẫn không sao.
export function isManual(r: GrammarRow | undefined): boolean {
  return !!r?.doneAt && !r.off && (!!r.man || ((r.reps ?? 0) >= 1 && (r.best ?? 0) < PASS_SCORE));
}

export function grammarDue(r: GrammarRow | undefined): Date | null {
  if (!r?.doneAt || !r.lastAt || isManual(r)) return null;
  const days = REVIEW_DAYS[Math.min(Math.max(r.reps, 1), REVIEW_DAYS.length) - 1];
  return new Date(new Date(r.lastAt).getTime() + days * 86400000);
}

export function isDue(r: GrammarRow | undefined, now: Date): boolean {
  const d = grammarDue(r);
  return !!d && d.getTime() <= now.getTime();
}

// Ghi một lần luyện tập: đạt → reps+1 (lần đầu đạt = đã học); chưa đạt → reps về 0 (ôn lại ngày mai nếu đã học).
// Bài đang tích tay: lần luyện này là mốc ĐẦU của lịch ôn (tích tay không tính là một lần đạt).
export function applyPractice(prev: GrammarRow | undefined, id: string, score: number, now: Date): GrammarRow {
  const iso = now.toISOString();
  const pass = score >= PASS_SCORE;
  const doneAt = prev?.off ? undefined : prev?.doneAt;
  const streak = prev?.off || isManual(prev) ? 0 : (prev?.reps ?? 0);
  return {
    id,
    ...(doneAt || pass ? { doneAt: doneAt ?? iso } : {}),
    lastAt: iso,
    reps: pass ? streak + 1 : 0,
    best: Math.max(prev?.best ?? 0, Math.round(score)),
    last: Math.round(score),
  };
}

// Tích tay "đã học" (không luyện): đã học nhưng KHÔNG xếp lịch ôn (cờ man). reps 1 giữ đúng dạng dòng của bản cũ (bản
// app cũ vẫn đọc là đã học) và để isManual nhận ra kể cả khi cờ rơi. Bài đã học rồi (luyện đạt / tích trước đó) giữ nguyên.
export function markLearned(prev: GrammarRow | undefined, id: string, now: Date): GrammarRow {
  if (prev && isLearned(prev) && !prev.off) return prev;
  const iso = now.toISOString();
  return {
    id,
    doneAt: iso,
    lastAt: iso,
    reps: 1,
    best: prev?.best ?? 0,
    ...(prev?.last !== undefined ? { last: prev.last } : {}),
    man: 1,
  };
}

// Bỏ đánh dấu: giữ điểm cao nhất, bỏ trạng thái đã học; mốc mới hơn nên thắng khi hợp nhất.
export function unmarkLearned(prev: GrammarRow, now: Date): GrammarRow {
  return { id: prev.id, reps: 0, best: prev.best, off: 1, lastAt: now.toISOString(), ...(prev.last !== undefined ? { last: prev.last } : {}) };
}

// Hợp nhất 2 bản của cùng một bài (đồng bộ nhiều máy / khôi phục backup): lịch ôn (và tích tay hay luyện) theo bản
// GẦN hơn, điểm cao nhất lấy max, ngày học lần đầu lấy sớm hơn → giao hoán, idempotent. Trùng mốc + trùng reps: bỏ
// đánh dấu thắng, rồi tới tích tay.
export function mergeGrammarRow(a: GrammarRow, b: GrammarRow): GrammarRow {
  const la = a.lastAt ?? "";
  const lb = b.lastAt ?? "";
  const flag = (r: GrammarRow) => (r.off ? 2 : 0) + (r.man ? 1 : 0);
  const newer = lb > la || (lb === la && ((b.reps ?? 0) > (a.reps ?? 0) || ((b.reps ?? 0) === (a.reps ?? 0) && flag(b) > flag(a)))) ? b : a;
  const done = newer.off ? undefined : [a.doneAt, b.doneAt].filter((x): x is string => !!x).sort()[0];
  return {
    id: a.id,
    ...(done ? { doneAt: done } : {}),
    ...(newer.lastAt ? { lastAt: newer.lastAt } : {}),
    reps: newer.reps ?? 0,
    best: Math.max(a.best ?? 0, b.best ?? 0),
    ...(newer.last !== undefined ? { last: newer.last } : {}),
    ...(newer.off ? { off: 1 as const } : {}),
    ...(newer.man && !newer.off ? { man: 1 as const } : {}),
  };
}

export function mergeGrammarRows(a: readonly GrammarRow[], b: readonly GrammarRow[]): GrammarRow[] {
  const m = new Map<string, GrammarRow>();
  for (const r of [...a, ...b]) m.set(r.id, m.has(r.id) ? mergeGrammarRow(m.get(r.id)!, r) : r);
  return [...m.values()];
}

// ---- Mã hoá dòng tiến độ thành CHUỖI để đi qua trường `grammar: string[]` sẵn có của doc đồng bộ và tệp sao lưu
// (không đổi Firestore rules; bản app cũ gộp mảng chuỗi kiểu hợp tập hợp nên vẫn giữ nguyên dữ liệu).
// "id~doneAt~lastAt~reps~best~last~off~man" — mốc thời gian = ms epoch hệ 36; trống = không có (đuôi trống bị cắt → dòng
// không tích tay mã hoá y như trước khi có cờ man; bản app cũ đọc chuỗi mới thì bỏ qua phần thừa).
const SEP = "~";
const t36 = (iso?: string) => (iso ? new Date(iso).getTime().toString(36) : "");
const fromT36 = (s: string) => (s ? new Date(parseInt(s, 36)).toISOString() : undefined);
export function encodeGrammarRow(r: GrammarRow): string {
  return [r.id, t36(r.doneAt), t36(r.lastAt), r.reps || 0, r.best || 0, r.last ?? "", r.off ? 1 : "", r.man ? 1 : ""].join(SEP).replace(/~+$/, "");
}
export function decodeGrammarRow(s: string): GrammarRow | null {
  if (typeof s !== "string" || !s) return null;
  const p = s.split(SEP);
  const id = p[0];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return null;
  // chuỗi chỉ có id = dạng cũ (danh sách bài đã học của khung khoá phụ) → coi như đã học từ lâu
  if (p.length === 1) return { id, doneAt: new Date(0).toISOString(), lastAt: new Date(0).toISOString(), reps: 1, best: 0 };
  const num = (x: string | undefined) => (x && Number.isFinite(Number(x)) ? Number(x) : undefined);
  const doneAt = fromT36(p[1] ?? "");
  const lastAt = fromT36(p[2] ?? "");
  if ((doneAt && Number.isNaN(Date.parse(doneAt))) || (lastAt && Number.isNaN(Date.parse(lastAt)))) return null;
  const last = num(p[5]);
  return {
    id,
    ...(doneAt ? { doneAt } : {}),
    ...(lastAt ? { lastAt } : {}),
    reps: Math.max(0, Math.min(99, num(p[3]) ?? 0)),
    best: Math.max(0, Math.min(100, num(p[4]) ?? 0)),
    ...(last !== undefined ? { last: Math.max(0, Math.min(100, last)) } : {}),
    ...(p[6] === "1" ? { off: 1 as const } : {}),
    ...(p[7] === "1" ? { man: 1 as const } : {}),
  };
}
export function decodeGrammarRows(list: readonly string[]): GrammarRow[] {
  const rows: GrammarRow[] = [];
  for (const s of list ?? []) {
    const r = decodeGrammarRow(s);
    if (r) rows.push(r);
  }
  return mergeGrammarRows([], rows);
}
// Hợp nhất hai danh sách đã mã hoá (local ⇄ cloud) → danh sách mã hoá, mỗi bài đúng một chuỗi, sắp theo id.
export function mergeGrammarCodes(a: readonly string[], b: readonly string[]): string[] {
  return decodeGrammarRows([...(a ?? []), ...(b ?? [])])
    .sort((x, y) => (x.id < y.id ? -1 : 1))
    .map(encodeGrammarRow);
}
// Dấu vân tay tiến độ ngữ pháp (đổi bất kỳ dòng nào → đổi).
export function grammarStamp(codes: readonly string[]): string {
  let h = 2166136261;
  for (const c of [...codes].sort().join("|")) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${codes.length}|${h.toString(36)}`;
}
