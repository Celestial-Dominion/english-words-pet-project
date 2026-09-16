// Phần THUẦN của SRS + chuỗi ngày: không import Dexie/ts-fsrs runtime nên unit-test
// chạy thẳng bằng node (pattern srs-pure.ts của app HSK).
import type { ReviewRecord } from "./types";

// ts-fsrs Rating: 1=Again 2=Hard 3=Good 4=Easy — khai lại số để không phải import runtime.
export const RATING = { again: 1, hard: 2, good: 3, easy: 4 } as const;
export type RatingValue = (typeof RATING)[keyof typeof RATING];

/** Quên ≥4 lần = thẻ "hay quên" (leech) — được ôn lại kỹ bằng thẻ learn trước khi hỏi. */
export const LEECH_LAPSES = 4;
/** Nhớ bền: FSRS stability ≥ 21 ngày. */
export const MATURE_STABILITY = 21;

export const isLeech = (r?: ReviewRecord | null): boolean => !!r && (r.lapses ?? 0) >= LEECH_LAPSES;
export const isMature = (r?: ReviewRecord | null): boolean =>
  !!r && r.stability >= MATURE_STABILITY && !isLeech(r);

// Ngưỡng vào giai đoạn "growing" — lúc BẮT ĐẦU đưa gõ chính tả (sản sinh thật) vào:
// đã gặp ≥3 lần HOẶC đã bền ≥7 ngày. Trước đó (young) chỉ nhận diện + cloze + nghe,
// vì bắt gõ một từ mới thấy 1–2 lần dễ gây nản (sai liên tục), không phải chống chán.
export const GROWING_REPS = 3;
export const GROWING_STABILITY = 7;

/** Giai đoạn của thẻ, dùng để chọn tỉ trọng dạng câu hỏi (ramp nhận diện → sản sinh). */
export type CardStage = "young" | "growing" | "mature";
export function cardStage(r?: ReviewRecord | null): CardStage {
  if (isMature(r)) return "mature";
  if (r && ((r.reps ?? 0) >= GROWING_REPS || r.stability >= GROWING_STABILITY)) return "growing";
  return "young";
}

export type SpeedMode = "meaning" | "reverse" | "cloze" | "listen" | "spell";

// Ngưỡng "chậm" (ms) theo LOẠI câu: chọn phương án chỉ cần đọc + bấm, còn cloze phải đọc
// cả câu, listen phải nghe hết audio, spell phải nghe RỒI GÕ cả từ (chậm nhất).
const SLOW_MS: Record<SpeedMode, number> = {
  meaning: 9000,
  reverse: 9000,
  cloze: 14_000,
  listen: 12_000,
  spell: 20_000,
};
// Chỉ spell mới có ngưỡng "nhanh" — xem vì sao ở comment trong hàm.
const SPELL_FAST_MS = 8000;

/**
 * Suy mức chấm từ kết quả + TỐC ĐỘ trả lời: sai → Lại; quá 45s coi như bị xao nhãng → Được
 * (không phạt Khó); đúng chậm → Khó; còn lại → Được.
 *
 * KHÔNG BAO GIỜ chấm Dễ (Easy) cho câu NHẬN-DIỆN (mọi mode MCQ: meaning/reverse/cloze/listen).
 * Lý do — đừng thêm lại nhánh "đúng nhanh → Easy" (bài học xương máu từ app HSK, lịch ôn bị
 * "lỏng ngầm" dù tham số FSRS đã siết):
 *   1. Trắc nghiệm 4 phương án là NHẬN RA đáp án giữa các lựa chọn, không phải TỰ NHỚ RA —
 *      đúng nhanh không chứng minh nhớ bền.
 *   2. Ở chế độ nhớ-lại-trước (mặc định BẬT), đồng hồ chỉ chạy TỪ LÚC HIỆN phương án
 *      (review-runner đặt mốc trong reveal() để không phạt thời gian đang cố nhớ) → chọn
 *      1 trong 4 hầu như luôn dưới vài giây → gần như MỌI câu đúng đều thành "Dễ".
 *   3. Trong FSRS, Easy có hệ số thưởng riêng làm stability phình rất nhanh; chuỗi Easy
 *      liên tiếp đẩy từ vừa học hôm trước ra xa vài ngày–vài tuần.
 * Riêng SPELL (nghe + nghĩa → gõ cả từ, không có phương án) là TỰ NHỚ RA thật: gõ đúng cả
 * từ trong 8s là bằng chứng nhớ chủ động → vẫn xứng đáng Easy.
 */
export function ratingValueFromSpeed(correct: boolean, ms: number, mode?: SpeedMode): RatingValue {
  if (!correct) return RATING.again;
  if (ms > 45_000) return RATING.good; // rời máy/xao nhãng, không phạt Khó
  const m = mode ?? "meaning";
  if (m === "spell" && ms <= SPELL_FAST_MS) return RATING.easy;
  if (ms >= SLOW_MS[m]) return RATING.hard;
  return RATING.good;
}

// ---- Xáo trộn TẤT ĐỊNH theo seed (fnv-1a + xorshift) — như app HSK ----
// Dùng cho "xoay vòng ngữ cảnh": chọn câu ví dụ theo seed (từ + số lần ôn) để trong
// một phiên thứ tự ổn định khi rebuild, còn mỗi LẦN ÔN sau gặp bộ câu KHÁC —
// gặp từ trong ngữ cảnh mới cách quãng nhớ lâu hơn gặp mãi 2 câu đầu danh sách.
export function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  let h = 2166136261;
  for (let k = 0; k < seedStr.length; k++) {
    h ^= seedStr.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const s = [...arr];
  for (let k = s.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [s[k], s[j]] = [s[j], s[k]];
  }
  return s;
}

// ---- Xáo trộn (interleave): giãn các đợt CÙNG TỪ ----
// Trộn ngẫu nhiên thuần vẫn có thể để bài chính của A nằm ngay trước bài
// điền A. Greedy lấy đợt sớm nhất mà word.id không nằm trong `gap` đợt
// vừa xếp; cuối phiên hết ứng viên thì chấp nhận xếp sát, không làm mất đợt.
// Giữ thứ tự tương đối của cùng từ nên bất biến learn đứng trước vẫn đúng.
export function spreadSameWord<T extends { word: { id: string } }>(steps: T[], gap: number): T[] {
  if (gap <= 0 || steps.length < 3) return steps;
  const queue = [...steps];
  const out: T[] = [];
  while (queue.length) {
    const recent = new Set(out.slice(-gap).map((s) => s.word.id));
    let idx = queue.findIndex((s) => !recent.has(s.word.id));
    if (idx === -1) idx = 0;
    out.push(queue[idx]);
    queue.splice(idx, 1);
  }
  return out;
}

/** Tỉ lệ token đã biết; targetTokens luôn được tính là biết cho từ mới. */
export function knownRatio(
  tokens: readonly string[],
  learned: ReadonlySet<string>,
  targetTokens: ReadonlySet<string>,
  foundation: ReadonlySet<string> = new Set<string>(),
): number {
  if (tokens.length === 0) return 0;
  let known = 0;
  for (const token of tokens)
    if (targetTokens.has(token) || learned.has(token) || foundation.has(token)) known++;
  return known / tokens.length;
}

/**
 * Câu đạt ngưỡng giữ nguyên thứ tự đầu vào; câu chưa đạt đứng sau theo
 * tỉ lệ giảm dần. Nhóm sau là đường dự phòng để không âm thầm xoá đợt
 * điền/ghép khi hồ sơ học trong app chưa phản ánh hết vốn từ thật.
 */
export function rankByKnown<T>(items: readonly T[], ratioOf: (item: T) => number, min: number): T[] {
  if (min <= 0) return [...items];
  const pass: T[] = [];
  const rest: { item: T; ratio: number; index: number }[] = [];
  items.forEach((item, index) => {
    const ratio = ratioOf(item);
    if (ratio + 1e-9 >= min) pass.push(item);
    else rest.push({ item, ratio, index });
  });
  rest.sort((a, b) => b.ratio - a.ratio || a.index - b.index);
  return [...pass, ...rest.map((x) => x.item)];
}

/** Chọn hai nhóm bài luyện từ cùng một quỹ câu. Nhóm sau ưu tiên câu chưa
 * dùng ở nhóm trước, rồi mới tái dùng nếu không còn đủ dữ liệu. */
export function selectDistinctExercises<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  canCloze: (item: T) => boolean,
  canArrange: (item: T) => boolean,
  clozeCount: number,
  arrangeCount: number,
): { clozeItems: T[]; arrangeItems: T[] } {
  const clozeItems: T[] = [];
  const used = new Set<string>();
  for (const item of items) {
    if (clozeItems.length >= clozeCount) break;
    const key = keyOf(item);
    if (used.has(key) || !canCloze(item)) continue;
    clozeItems.push(item);
    used.add(key);
  }
  const usable = items.filter(canArrange);
  const arrangeItems = [
    ...usable.filter((item) => !used.has(keyOf(item))),
    ...usable.filter((item) => used.has(keyOf(item))),
  ].slice(0, arrangeCount);
  return { clozeItems, arrangeItems };
}

// ---- Độ "trùng nghĩa" giữa hai nghĩa tiếng Việt (cho phương án trắc nghiệm) ----
// Hai nghĩa na ná nhau ("yêu; thích" cạnh "sở thích; yêu thích") làm câu hỏi mập mờ:
// chọn đúng/sai do đoán chứ không do nhớ. Chặn bằng cách so TỪNG NÉT NGHĨA (tách bởi
// ; , /): hai nét coi là trùng khi ≥50% số từ (đã bỏ từ chức năng) của nét NGẮN hơn
// có mặt ở nét kia. (Port nguyên xi từ app HSK — cùng là nghĩa tiếng Việt.)
const VI_GENERIC = new Set([
  "một", "cái", "sự", "việc", "có", "là", "và", "của", "được", "làm", "cho", "bị", "rất", "thì", "để",
]);

// "yêu; thích (ai đó)" → [["yêu"], ["thích"]] — bỏ phần trong ngoặc và dấu câu.
function viSenses(meaning: string): string[][] {
  return meaning
    .toLowerCase()
    .split(/[;,/]/)
    .map((s) =>
      s
        .replace(/\([^)]*\)/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .trim(),
    )
    .filter(Boolean)
    .map((s) => s.split(/\s+/).filter((t) => t && !VI_GENERIC.has(t)))
    .filter((toks) => toks.length > 0);
}

export function meaningTooSimilar(a: string, b: string): boolean {
  const A = viSenses(a);
  const B = viSenses(b);
  for (const x of A) {
    const sx = new Set(x);
    for (const y of B) {
      const sy = new Set(y);
      let shared = 0;
      for (const t of sx) if (sy.has(t)) shared++;
      const shorter = Math.min(sx.size, sy.size);
      if (shorter > 0 && shared / shorter >= 0.5) return true;
    }
  }
  return false;
}

// ---- Mục LUYỆN TẬP tự do (/luyen-tap) — như app HSK ----
// Phạm vi chọn từ để luyện: "all" (mọi từ đã học) · "hard" (hay quên) ·
// "due" (đến hạn hôm nay) · số (một cấp cụ thể). KHÔNG chấm FSRS.
export type PracticeScope = "all" | "hard" | "due" | number;

// "Hay quên" ở đây KHÔNG cần đến hạn (khác getHardReviews): luyện tự do lúc nào cũng
// được. lapses ≥ 2 và stability < 21 (chưa nhớ bền thì mới còn tính là hay quên).
export function practiceScopeFilter<
  T extends { due: Date | string; level: number; lapses: number; stability?: number },
>(recs: T[], scope: PracticeScope, now = new Date()): T[] {
  if (scope === "all") return recs;
  if (scope === "hard") return recs.filter((r) => r.lapses >= 2 && (r.stability ?? 0) < MATURE_STABILITY);
  if (scope === "due") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return recs.filter((r) => new Date(r.due) <= end);
  }
  return recs.filter((r) => r.level === scope);
}

/** "YYYY-MM-DD" theo giờ ĐỊA PHƯƠNG (không dùng toISOString — lệch múi giờ). */
export function todayStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Chuỗi ngày liên tiếp DÀI NHẤT từng đạt (kỷ lục — KHÔNG mất khi đứt chuỗi hiện tại;
 *  giảm cú sốc "đứt streak là mất hết" vốn là đỉnh bỏ cuộc của app học). So sánh bằng
 *  "ngày kế tiếp" chứ không phải hiệu 86.400.000ms: múi giờ có DST làm ngày 23h/25h
 *  đứt kỷ lục vô lý. (Chuyển từ trang Tiến độ về đây để dùng chung với huy hiệu.) */
export function longestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  const nextDay = (s: string): string => {
    const d = new Date(s + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return todayStr(d);
  };
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const s of sorted) {
    cur = prev && nextDay(prev) === s ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = s;
  }
  return best;
}

/** Quãng NGHỈ dài nhất (số ngày trống) giữa hai ngày có học — tức người học ĐÃ quay lại
 *  sau chừng đó ngày bỏ. Nguyên liệu cho huy hiệu "tái xuất": thưởng việc QUAY LẠI thay
 *  vì chỉ phạt việc đứt chuỗi. 0 = chưa từng nghỉ quá một ngày liền. */
export function maxComebackGap(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const cur = new Date(sorted[i] + "T00:00:00");
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86_400_000) - 1;
    if (gap > best) best = gap;
  }
  return best;
}

/** Chuỗi ngày liên tiếp có hoạt động (kết thúc hôm nay hoặc hôm qua). */
export function computeStreak(dates: string[], today = todayStr()): number {
  const set = new Set(dates);
  // ngày bắt đầu đếm: hôm nay nếu có hoạt động, ngược lại hôm qua (cho phép "chưa học hôm nay")
  const d = new Date(today + "T00:00:00");
  if (!set.has(todayStr(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(todayStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
