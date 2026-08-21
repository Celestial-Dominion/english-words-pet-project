// Tiến độ nhỏ lưu localStorage — được đưa vào sync cloud + sao lưu:
//  - khóa học phụ (phát âm, ngữ pháp) — hiện chưa có nội dung, giữ khung cho sau
//  - VỊ TRÍ ĐỌC TRUYỆN: chương đang đọc của từng truyện (S2 — trước đây chỉ nằm trên máy)

const KEYS = {
  phonics: "en.phonicsDone",
  grammar: "en.grammarDone",
} as const;
export type CourseKey = keyof typeof KEYS;

export function getCourseDone(course: CourseKey): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEYS[course]) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function setCourseDone(course: CourseKey, done: Set<string>): void {
  try {
    localStorage.setItem(KEYS[course], JSON.stringify([...done]));
  } catch {
    /* bỏ qua */
  }
}

export function markCourseDone(course: CourseKey, id: string, v: boolean): Set<string> {
  const s = getCourseDone(course);
  if (v) s.add(id);
  else s.delete(id);
  setCourseDone(course, s);
  return s;
}

/** Hợp nhất tiến độ từ cloud (union — đã học ở máy nào cũng tính). */
export function mergeCourseDone(course: CourseKey, remote: string[]): string[] {
  const s = getCourseDone(course);
  for (const id of remote) s.add(id);
  setCourseDone(course, s);
  return [...s];
}

// ---- Vị trí đọc truyện (đồng bộ được) ----
// Lưu 1 key duy nhất thay vì mỗi truyện một key → gói gọn để đẩy lên cloud.
// { [storyId]: { ch: số chương, at: ms } } — merge theo `at`, máy đọc sau thắng.

export interface StoryPos {
  ch: number;
  at: number;
}
export type StoryPosMap = Record<string, StoryPos>;

const STORY_KEY = "en.storyPos";

export function getStoryPositions(): StoryPosMap {
  try {
    return JSON.parse(localStorage.getItem(STORY_KEY) ?? "{}") as StoryPosMap;
  } catch {
    return {};
  }
}

export function getStoryChapter(id: string): number {
  return getStoryPositions()[id]?.ch ?? 0;
}

export function setStoryChapter(id: string, ch: number, now = Date.now()): void {
  try {
    const all = getStoryPositions();
    all[id] = { ch, at: now };
    localStorage.setItem(STORY_KEY, JSON.stringify(all));
  } catch {
    /* bỏ qua */
  }
}

/** Hợp nhất vị trí đọc từ cloud: mỗi truyện lấy bản có `at` mới hơn. */
export function mergeStoryPositions(remote: StoryPosMap): StoryPosMap {
  const local = getStoryPositions();
  const out: StoryPosMap = { ...local };
  for (const [id, r] of Object.entries(remote ?? {})) {
    if (!r || typeof r.ch !== "number") continue;
    const l = out[id];
    if (!l || (r.at ?? 0) > (l.at ?? 0)) out[id] = { ch: r.ch, at: r.at ?? 0 };
  }
  try {
    localStorage.setItem(STORY_KEY, JSON.stringify(out));
  } catch {
    /* bỏ qua */
  }
  return out;
}

/** Dấu vân tay vị trí đọc để biết local có đổi không (dùng trong fingerprint sync). */
export function storyPosStamp(): string {
  const all = getStoryPositions();
  const ids = Object.keys(all).sort();
  const last = ids.reduce((m, id) => Math.max(m, all[id].at ?? 0), 0);
  return `${ids.length}|${last}`;
}
