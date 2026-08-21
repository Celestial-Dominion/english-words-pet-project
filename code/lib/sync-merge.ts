// Logic hợp nhất dữ liệu đồng bộ — HÀM THUẦN, không phụ thuộc Firebase/Dexie/localStorage.
// Tách riêng để unit-test được không cần mock (bài học từ app HSK: sync-merge.ts).
// Mỗi loại dữ liệu một chiến lược hội tụ, tất cả đều giao hoán + idempotent (kiểu CRDT tối giản):
//   reviews  — bản ôn "mới hơn" thắng (nhiều reps hơn, hoặc ôn gần đây hơn)
//   daily    — counter chỉ tăng → MAX từng cột
//   reads    — hành động sau cùng thắng (kể cả bỏ đánh dấu — tombstone)
//   notes    — máy sửa sau thắng ("" = đã xoá)
//   storyPos — máy đọc sau thắng (theo mốc thời gian)
import type { ReviewRecord, DailyStat, ReadRow, NoteRow, GamifyRow, SrsConfig } from "./types";

/** "Phiên bản" của thẻ ôn: ưu tiên số lượt ôn, sau đó tới thời điểm ôn gần nhất. */
export function reviewScore(r: ReviewRecord): number {
  return (r.reps ?? 0) * 1e13 + new Date(r.last_review ?? r.introducedOn ?? 0).getTime();
}

export function mergeReviews(a: ReviewRecord[], b: ReviewRecord[]): ReviewRecord[] {
  const m = new Map<string, ReviewRecord>();
  for (const r of [...a, ...b]) {
    const cur = m.get(r.wordId);
    if (!cur || reviewScore(r) > reviewScore(cur)) m.set(r.wordId, r);
  }
  return [...m.values()];
}

// LƯU Ý (như HSK): MAX từng cột là XẤP XỈ — đúng khi hai máy nối tiếp nhau, nhưng hai máy
// cùng cộng SONG SONG trong một ngày thì chỉ giữ bên lớn hơn (A ôn 5 + B ôn 3 → 5, không phải 8).
// Chấp nhận cho app 1 người dùng; muốn chính xác phải đếm per-device rồi cộng khi đọc.
export function mergeDaily(a: DailyStat[], b: DailyStat[]): DailyStat[] {
  const m = new Map<string, DailyStat>();
  for (const d of [...a, ...b]) {
    const cur = m.get(d.date);
    m.set(
      d.date,
      cur
        ? {
            date: d.date,
            reviews: Math.max(cur.reviews ?? 0, d.reviews ?? 0),
            newCount: Math.max(cur.newCount ?? 0, d.newCount ?? 0),
            again: Math.max(cur.again ?? 0, d.again ?? 0),
          }
        : d,
    );
  }
  return [...m.values()];
}

/** Mốc thời gian của bản ghi đọc: bỏ đánh dấu (removedAt) sau khi đọc thì thắng. */
export const readStamp = (r: ReadRow): string =>
  r.removedAt && r.removedAt > r.readAt ? r.removedAt : r.readAt;

export function mergeReads(a: ReadRow[], b: ReadRow[]): ReadRow[] {
  const m = new Map<string, ReadRow>();
  for (const r of [...a, ...b]) {
    const cur = m.get(r.id);
    if (!cur || readStamp(r) > readStamp(cur)) m.set(r.id, r);
  }
  return [...m.values()];
}

export function mergeNotes(a: NoteRow[], b: NoteRow[]): NoteRow[] {
  const m = new Map<string, NoteRow>();
  for (const n of [...a, ...b]) {
    const cur = m.get(n.wordId);
    if (!cur || (n.at ?? 0) > (cur.at ?? 0)) m.set(n.wordId, n);
  }
  return [...m.values()];
}

/** Hợp (union) cho tập hợp id — đã học/đã mở ở máy nào cũng tính. */
export function mergeIdSet(a: string[], b: string[]): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

export interface StoryPos {
  ch: number;
  at: number;
}

export function mergeStoryPos(
  a: Record<string, StoryPos>,
  b: Record<string, StoryPos>,
): Record<string, StoryPos> {
  const out: Record<string, StoryPos> = { ...(a ?? {}) };
  for (const [id, r] of Object.entries(b ?? {})) {
    if (!r || typeof r.ch !== "number") continue;
    const l = out[id];
    if (!l || (r.at ?? 0) > (l.at ?? 0)) out[id] = { ch: r.ch, at: r.at ?? 0 };
  }
  return out;
}

/** Gộp trạng thái gamify (đóng băng chuỗi + XP) — dùng cả khi merge remote lẫn khi ghi local. */
export function mergeGamify(a: GamifyRow, b: GamifyRow): GamifyRow {
  return {
    ...a,
    xp: Math.max(a.xp ?? 0, b.xp ?? 0),
    freezes: Math.max(a.freezes ?? 0, b.freezes ?? 0),
    frozenDates: mergeIdSet(a.frozenDates ?? [], b.frozenDates ?? []),
    grantStreak: Math.max(a.grantStreak ?? 0, b.grantStreak ?? 0),
    maxCombo: Math.max(a.maxCombo ?? 0, b.maxCombo ?? 0),
    // union: hai máy cùng nhận một nhiệm vụ → một khoá duy nhất (XP thì max-merge nên
    // không cộng dồn kép giữa hai máy)
    questsDone: mergeIdSet(a.questsDone ?? [], b.questsDone ?? []),
  };
}

/**
 * Bỏ mọi field có giá trị `undefined` (đệ quy) trước khi ghi lên Firestore.
 * Firestore từ chối `undefined` và làm HỎNG CẢ writeBatch → một field lẻ đủ để chặn toàn bộ
 * đồng bộ. IndexedDB thì chấp nhận, nên lỗi chỉ lộ ra ở phía cloud. Đây là lưới chắn cuối:
 * dữ liệu cũ trên máy người dùng đã lỡ mang key rỗng vẫn sync được, không phải sửa tay.
 */
export function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => pruneUndefined(v)) as unknown as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = pruneUndefined(v);
    }
    return out as T;
  }
  return value;
}

// ---- Dấu vân tay + quyết định đồng bộ (thuần, để test được 2 máy mà không cần Firestore) ----

/** Ảnh chụp toàn bộ tiến độ của MỘT phía (local hoặc remote). */
export interface SyncSnapshot {
  reviews: ReviewRecord[];
  daily: DailyStat[];
  reads: ReadRow[];
  notes: NoteRow[];
  xp: number;
  phonics: string[];
  grammar: string[];
  storyPos: Record<string, StoryPos>;
  gamify: GamifyRow;
}

/**
 * Dấu vân tay tiến độ local: đổi bất kỳ đâu (ôn, học, đọc, XP, mẹo nhớ, khoá, đóng băng
 * chuỗi, cài đặt, vị trí đọc) → fp đổi → mới ghi lên cloud. Không đổi thì sync chỉ tốn 1 getDoc.
 * `cfgStamp`/`storyStamp` truyền từ ngoài vào để hàm này không đụng localStorage.
 */
export interface Fp {
  rc: number; // số review
  mlr: number; // max last_review (ms)
  tr: number; // tổng lượt ôn (daily)
  rd: number; // số bản ghi đọc (kể cả tombstone)
  ra: string; // dấu thời gian đọc/bỏ-đọc mới nhất
  xp: number;
  nt: number; // max thời điểm sửa mẹo nhớ
  co: number; // số bài phát âm + ngữ pháp đã học
  fz: string; // trạng thái đóng băng chuỗi
  cu: string; // thời điểm đổi cài đặt trên máy này
  sp: string; // vị trí đọc truyện
}

export function fingerprint(s: SyncSnapshot, cfgStamp: string, storyStamp: string): Fp {
  let mlr = 0;
  for (const r of s.reviews) {
    const t = r.last_review ? new Date(r.last_review).getTime() : 0;
    if (t > mlr) mlr = t;
  }
  let ra = "";
  for (const r of s.reads) {
    const t = readStamp(r);
    if (t > ra) ra = t;
  }
  let nt = 0;
  for (const n of s.notes) if ((n.at ?? 0) > nt) nt = n.at ?? 0;
  const g = s.gamify;
  return {
    rc: s.reviews.length,
    mlr,
    tr: s.daily.reduce((sum, d) => sum + d.reviews, 0),
    rd: s.reads.length,
    ra,
    xp: s.xp,
    nt,
    co: s.phonics.length + s.grammar.length,
    fz: `${g.freezes ?? 0}|${(g.frozenDates ?? []).length}|${g.grantStreak ?? 0}|${g.maxCombo ?? 0}|${(g.questsDone ?? []).length}`,
    cu: cfgStamp,
    sp: storyStamp,
  };
}

export function fpEq(a: Fp, b: Fp): boolean {
  return (
    a.rc === b.rc && a.mlr === b.mlr && a.tr === b.tr && a.rd === b.rd && a.ra === b.ra &&
    a.xp === b.xp && a.nt === b.nt && a.co === b.co && a.fz === b.fz && a.cu === b.cu && a.sp === b.sp
  );
}

/** Hợp nhất ảnh chụp local với ảnh chụp remote (dùng khi remote đã đổi). */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  return {
    reviews: mergeReviews(local.reviews, remote.reviews),
    daily: mergeDaily(local.daily, remote.daily),
    reads: mergeReads(local.reads, remote.reads),
    notes: mergeNotes(local.notes, remote.notes),
    xp: Math.max(local.xp, remote.xp),
    phonics: mergeIdSet(local.phonics, remote.phonics),
    grammar: mergeIdSet(local.grammar, remote.grammar),
    storyPos: mergeStoryPos(local.storyPos, remote.storyPos),
    gamify: mergeGamify(local.gamify, remote.gamify),
  };
}

// ---- Lọc dữ liệu kéo từ Firestore ----
// Doc trên cloud có thể lệch schema (bản app cũ ghi, hoặc bị sửa tay khi tài khoản bị chiếm).
// Không lọc thì một bản ghi hỏng đủ làm cả transaction Dexie abort → đồng bộ chết vĩnh viễn
// cho tới khi sửa doc. Ở đây bỏ bản ghi hỏng, giữ phần còn lại.

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
/** Chặn key làm ô nhiễm prototype khi dữ liệu remote được dùng làm key của object. */
const safeKey = (k: string): boolean => k !== "__proto__" && k !== "constructor" && k !== "prototype";

const asDate = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v !== "string" && typeof v !== "number") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function sanitizeReviews(raw: unknown): ReviewRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewRecord[] = [];
  for (const r of raw) {
    if (!isObj(r)) continue;
    const wordId = str(r.wordId);
    const due = asDate(r.due);
    if (!wordId || !safeKey(wordId) || !due) continue; // thiếu key hoặc hạn ôn hỏng → bỏ
    const last = asDate(r.last_review);
    out.push({
      wordId,
      level: num(r.level),
      due,
      stability: num(r.stability),
      difficulty: num(r.difficulty),
      elapsed_days: num(r.elapsed_days),
      scheduled_days: num(r.scheduled_days),
      reps: num(r.reps),
      lapses: num(r.lapses),
      learning_steps: num(r.learning_steps),
      state: num(r.state),
      ...(last ? { last_review: last } : {}),
      introducedOn: str(r.introducedOn),
    });
  }
  return out;
}

export function sanitizeDaily(raw: unknown): DailyStat[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    if (!isObj(d)) return [];
    const date = str(d.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    return [{ date, reviews: num(d.reviews), newCount: num(d.newCount), again: num(d.again) }];
  });
}

export function sanitizeReads(raw: unknown): ReadRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    if (!isObj(r)) return [];
    const id = str(r.id);
    const readAt = str(r.readAt);
    if (!id || !safeKey(id) || !readAt) return [];
    const removedAt = str(r.removedAt);
    return [{ id, readAt, ...(removedAt ? { removedAt } : {}) }];
  });
}

export function sanitizeNotes(raw: unknown): NoteRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((n) => {
    if (!isObj(n)) return [];
    const wordId = str(n.wordId);
    if (!wordId || !safeKey(wordId)) return [];
    return [{ wordId, text: str(n.text).slice(0, 2000), at: num(n.at) }];
  });
}

export function sanitizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && !!x);
}

export function sanitizeStoryPos(raw: unknown): Record<string, StoryPos> {
  if (!isObj(raw)) return {};
  const out: Record<string, StoryPos> = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!id || !safeKey(id) || !isObj(v) || typeof v.ch !== "number") continue;
    out[id] = { ch: v.ch, at: num(v.at) };
  }
  return out;
}

/**
 * Cài đặt phiên học kéo từ cloud: chỉ nhận field đúng kiểu, số nằm trong khoảng hợp lý.
 * Giá trị lạ (newPerDay = "nhiều", direction = "xyz") sẽ chảy thẳng qua getConfig() vì hàm đó
 * chỉ spread lên mặc định — đủ để phiên học dựng ra 0 câu hoặc NaN.
 */
export function sanitizeConfig(raw: unknown, base: SrsConfig): SrsConfig {
  if (!isObj(raw)) return base;
  const int = (v: unknown, d: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;
  const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
  return {
    newPerDay: int(raw.newPerDay, base.newPerDay, 0, 200),
    reviewPerSession: int(raw.reviewPerSession, base.reviewPerSession, 0, 500),
    direction: raw.direction === "vi2en" || raw.direction === "en2vi" ? raw.direction : base.direction,
    newLevel: int(raw.newLevel, base.newLevel, 0, 4),
    arrangePerWord: int(raw.arrangePerWord, base.arrangePerWord, 0, 5),
    recallFirst: bool(raw.recallFirst, base.recallFirst),
    spelling: bool(raw.spelling, base.spelling),
    listenEnabled: bool(raw.listenEnabled, base.listenEnabled),
    clozeEnabled: bool(raw.clozeEnabled, base.clozeEnabled),
    autoAdvance: bool(raw.autoAdvance, base.autoAdvance),
  };
}

/** Ảnh chụp remote đã lọc sạch — dùng thẳng cho mergeSnapshots. */
export function sanitizeRemote(remote: Record<string, unknown>): SyncSnapshot {
  const freeze = isObj(remote.freeze) ? remote.freeze : {};
  const xp = num(remote.xp);
  return {
    reviews: [], // chunks nạp riêng (sanitizeReviews) vì nằm ở subcollection
    daily: sanitizeDaily(remote.daily),
    reads: sanitizeReads(remote.reads),
    notes: sanitizeNotes(remote.notes),
    xp,
    phonics: sanitizeIdList(remote.phonics),
    grammar: sanitizeIdList(remote.grammar),
    storyPos: sanitizeStoryPos(remote.storyPos),
    gamify: {
      key: "state",
      xp,
      freezes: num(freeze.freezes),
      frozenDates: sanitizeIdList(freeze.frozenDates),
      grantStreak: num(freeze.grantStreak),
      maxCombo: num(freeze.maxCombo),
      questsDone: sanitizeIdList(freeze.questsDone),
    },
  };
}
