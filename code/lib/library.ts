// Thư viện học liệu: Reading · Story · Video (docs/ENGLISH_CONTENT_PLAYBOOK.md).
// JSON tĩnh MỘT file mỗi bài + chỉ mục nhẹ theo loại (sinh bằng scripts/build-content.mjs) —
// mở một bài không phải tải cả cấp.
import { exampleShardOf } from "./data";
import type { VideoLesson, VideoMeta } from "./video";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DIR = `${BASE}/data/library`;

// Taxonomy chủ đề (PHẢI khớp scripts/lib/content-spec.mjs).
export const TOPICS: Record<string, string> = {
  "daily-life": "Đời sống",
  family: "Gia đình",
  travel: "Du lịch",
  food: "Ẩm thực",
  education: "Giáo dục",
  work: "Công việc",
  technology: "Công nghệ",
  science: "Khoa học",
  health: "Sức khỏe",
  psychology: "Tâm lý",
  history: "Lịch sử",
  geography: "Địa lý",
  environment: "Môi trường",
  society: "Xã hội",
  economics: "Kinh tế",
  business: "Kinh doanh",
  communication: "Giao tiếp",
  culture: "Văn hóa",
  art: "Nghệ thuật",
  literature: "Văn học",
  philosophy: "Triết học",
  ethics: "Đạo đức",
  media: "Truyền thông",
  cities: "Đô thị",
  nature: "Thiên nhiên",
  innovation: "Đổi mới",
};

export const GENRES: Record<string, string> = {
  description: "Miêu tả",
  narrative: "Tự sự",
  informational: "Thông tin",
  explanation: "Giải thích",
  "how-to": "Hướng dẫn",
  comparison: "So sánh",
  "cause-effect": "Nhân – quả",
  biography: "Tiểu sử",
  news: "Tin tức",
  interview: "Phỏng vấn",
  opinion: "Quan điểm",
  review: "Đánh giá",
  argument: "Lập luận",
  analysis: "Phân tích",
  "case-study": "Tình huống",
  practical: "Văn bản thực dụng",
  letter: "Thư / email",
};

export interface LibSentence {
  en: string;
  vi: string;
}

// Câu hỏi đọc hiểu trắc nghiệm cuối bài đọc / chương truyện (content/quiz → scripts/build-content.mjs).
// a = chỉ số phương án ĐÚNG trong opts (giao diện xáo thứ tự hiển thị); why = giải thích (VI, trích «nguyên văn»).
export interface QuizQuestion {
  q: LibSentence;
  opts: LibSentence[];
  a: number;
  why: string;
}

// Bài phỏng theo nguồn mở: tên gốc, tác giả/tuyển tập, giấy phép (khoá trong LICENSES), đường dẫn GitHub.
export interface ContentSource {
  title: string;
  credit: string;
  license: string;
  url: string;
}

// PHẢI khớp scripts/lib/content-spec.mjs LICENSES.
export const LICENSES: Record<string, { label: string; url: string }> = {
  "public domain": { label: "Phạm vi công cộng", url: "https://creativecommons.org/publicdomain/mark/1.0/deed.vi" },
  "CC0 1.0": { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/deed.vi" },
  "CC BY 3.0": { label: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/deed.vi" },
  "CC BY 4.0": { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.vi" },
};

// 1 track audio cho cả bài/chương; starts/ends = mốc từng câu (giây).
export interface PassageAudio {
  src: string;
  v: string;
  duration: number;
  starts: number[];
  ends: number[];
}

// Từ trọng tâm của bài: từ ĐÚNG cấp bài có trong bài (nối Reading ↔ Từ vựng/SRS).
export interface FocusWord {
  id: string;
  ipa: string;
  vi: string;
}

export interface ReadingMeta {
  id: string;
  level: string;
  n: number;
  title_en: string;
  title_vi: string;
  topic: string;
  genre: string;
  words: number;
  min: number;
  series?: string;
  src?: 1; // phỏng theo nguồn mở
}

export interface SeriesLink {
  id: string;
  level: string;
  title_en: string;
}

export interface ReadingDoc {
  id: string;
  level: string;
  n: number;
  title: LibSentence;
  topic: string;
  genre: string;
  words: number;
  min: number;
  paras: number[]; // chỉ số câu mở đầu mỗi đoạn
  sentences: LibSentence[];
  focus: FocusWord[];
  series?: { id: string; order: number; count: number; prev?: SeriesLink; next?: SeriesLink };
  audio?: PassageAudio;
  quiz?: QuizQuestion[];
  source?: ContentSource;
}

export interface StoryMeta {
  id: string;
  level: string;
  n: number;
  title_en: string;
  title_vi: string;
  topic: string;
  summary: string;
  chapters: number;
  words: number;
  min: number;
  video?: string;
  series?: string; // truyện dài chia nhiều phần: id chuỗi + phần thứ part/parts
  part?: number;
  parts?: number;
  src?: 1;
}

export interface StoryChapter {
  title: LibSentence;
  paras: number[];
  sentences: LibSentence[];
  audio?: PassageAudio;
  quiz?: QuizQuestion[];
}

export interface StoryDoc {
  id: string;
  level: string;
  n: number;
  title: LibSentence;
  topic: string;
  summary: string;
  words: number;
  min: number;
  chapters: StoryChapter[];
  focus: FocusWord[];
  video?: { id: string; title: LibSentence };
  series?: { id: string; order: number; count: number; prev?: SeriesLink; next?: SeriesLink };
  source?: ContentSource;
}

export type LibraryKind = "readings" | "stories" | "videos";

// ---- tải + cache theo promise (mở lại không tải lại; lỗi mạng thì cho thử lại) ----
const cache = new Map<string, Promise<unknown>>();
function load<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export const loadReadingsIndex = () => load<ReadingMeta[]>(`${DIR}/readings-index.json`);
export const loadStoriesIndex = () => load<StoryMeta[]>(`${DIR}/stories-index.json`);
export const loadVideosIndex = () => load<VideoMeta[]>(`${DIR}/videos-index.json`);
export const loadReading = (id: string) => load<ReadingDoc>(`${DIR}/readings/${encodeURIComponent(id)}.json`);
export const loadStory = (id: string) => load<StoryDoc>(`${DIR}/stories/${encodeURIComponent(id)}.json`);
export const loadVideo = (id: string) => load<VideoLesson>(`${DIR}/videos/${encodeURIComponent(id)}.json`);

export function passageAudioUrl(a: PassageAudio): string {
  return `${BASE}${a.src}?v=${a.v}`;
}

// ---- Chỉ mục từ → học liệu ("Gặp lại trong ngữ cảnh", gợi ý sau phiên học) ----
// Shard theo exampleShardOf(lemma); mỗi shard mang `n` = [số reading, story, video] lúc build — lệch
// với chỉ mục hiện tại = shard cũ hơn dữ liệu → bỏ qua (thà không gợi ý còn hơn trỏ nhầm bài).
export interface ContentRef {
  kind: "reading" | "story" | "video";
  id: string;
  level: string;
  title_en: string;
  title_vi: string;
}
type RefShard = { n: [number, number, number]; w: Record<string, string> };

export async function loadWordRefs(lemmas: string[]): Promise<Map<string, ContentRef[]>> {
  const out = new Map<string, ContentRef[]>();
  if (!lemmas.length) return out;
  const [ri, si, vi] = await Promise.all([loadReadingsIndex(), loadStoriesIndex(), loadVideosIndex()]);
  const shards = [...new Set(lemmas.map(exampleShardOf))];
  const loaded = await Promise.all(shards.map((n) => load<RefShard>(`${DIR}/word-refs/${n}.json`).catch(() => null)));
  const byShard = new Map(shards.map((n, i) => [n, loaded[i]]));
  for (const id of lemmas) {
    const sh = byShard.get(exampleShardOf(id));
    if (!sh || sh.n[0] !== ri.length || sh.n[1] !== si.length || sh.n[2] !== vi.length) continue;
    const refs: ContentRef[] = [];
    for (const r of (sh.w[id] ?? "").split(" ").filter(Boolean)) {
      const k = r[0];
      const i = Number(r.slice(1));
      if (k === "r" && ri[i]) refs.push({ kind: "reading", id: ri[i].id, level: ri[i].level, title_en: ri[i].title_en, title_vi: ri[i].title_vi });
      else if (k === "s" && si[i]) refs.push({ kind: "story", id: si[i].id, level: si[i].level, title_en: si[i].title_en, title_vi: si[i].title_vi });
      else if (k === "v" && vi[i]) refs.push({ kind: "video", id: vi[i].id, level: vi[i].level, title_en: vi[i].title.en, title_vi: vi[i].title.vi });
    }
    if (refs.length) out.set(id, refs);
  }
  return out;
}

export function refHref(r: Pick<ContentRef, "kind" | "id" | "level">): string {
  const base = r.kind === "reading" ? "/bai-doc" : r.kind === "story" ? "/truyen" : "/video";
  return `${base}/${r.level}/${r.id}`;
}

/** Ước lượng phút đọc (hiển thị) — khớp scripts/lib/content-spec.mjs. */
export function fmtMinutes(min: number): string {
  return `${Math.max(1, Math.round(min))} phút`;
}
