// Truy cập dữ liệu tĩnh trong public/data.
import type { Word } from "./types";
import { levelSlug } from "./levels";

// Base path để fetch chạy cả khi deploy dưới sub-path. Rỗng ở local.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Tải danh sách từ của một cấp (1..4; 0 = bộ nền). Trả [] nếu file chưa có (các cấp làm dần).
// Cache theo PROMISE: file cấp nặng 1,3–1,7MB mà mở phiên học, mở phiên ôn và bấm kết quả tìm
// kiếm đều gọi — không cache thì mỗi lần lại tải + parse lại từ đầu.
const wordsCache = new Map<number, Promise<Word[]>>();
export function loadWords(level: number): Promise<Word[]> {
  let p = wordsCache.get(level);
  if (!p) {
    p = fetch(`${BASE}/data/words/${levelSlug(level)}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Word[]>) : []))
      .catch((e) => {
        wordsCache.delete(level); // lỗi mạng → cho phép thử lại lần sau
        throw e;
      });
    wordsCache.set(level, p);
  }
  return p;
}

// Câu ví dụ theo cấp: map wordId -> [{ en, vi }]. File mỗi cấp được TÁCH 8 SHARD
// (examples/{cefr}-{0..7}.json, chia theo hash wordId) → màn ôn/tra từ chỉ tải shard
// chứa đúng các từ cần, không phải nguyên file cấp. Hash PHẢI khớp
// scripts/shard-examples.mjs.
export type ExampleSentence = { en: string; vi: string };
export const EXAMPLE_SHARDS = 8;
export function exampleShardOf(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return h % EXAMPLE_SHARDS;
}
const exShardCache = new Map<string, Record<string, ExampleSentence[]>>();
async function loadExampleShard(level: number, n: number): Promise<Record<string, ExampleSentence[]>> {
  const key = `${levelSlug(level)}-${n}`;
  const cached = exShardCache.get(key);
  if (cached) return cached;
  const res = await fetch(`${BASE}/data/examples/${key}.json`);
  const data = res.ok ? ((await res.json()) as Record<string, ExampleSentence[]>) : {};
  exShardCache.set(key, data);
  return data;
}
/** Toàn bộ ví dụ một cấp (tải đủ 8 shard — dùng khi thật sự cần cả cấp). */
export async function loadExamples(level: number): Promise<Record<string, ExampleSentence[]>> {
  const parts = await Promise.all(Array.from({ length: EXAMPLE_SHARDS }, (_, n) => loadExampleShard(level, n)));
  return Object.assign({}, ...parts);
}
/** Ví dụ cho ĐÚNG các từ cần (chỉ tải shard chứa chúng — nhẹ hơn nhiều). */
export async function loadExamplesForWords(
  level: number,
  ids: string[],
): Promise<Record<string, ExampleSentence[]>> {
  const shards = [...new Set(ids.map(exampleShardOf))];
  const parts = await Promise.all(shards.map((n) => loadExampleShard(level, n)));
  return Object.assign({}, ...parts);
}

// ---- Nhãn chủ đề (business…): danh sách id, tải LƯỜI khi người dùng thật sự lọc ----
// Để riêng file thay vì nhét vào từng Word: 16KB tải một lần, ai không dùng thì không tốn gì.
const topicCache = new Map<string, Set<string>>();
export async function loadTopicIds(topic: string): Promise<Set<string>> {
  const cached = topicCache.get(topic);
  if (cached) return cached;
  const res = await fetch(`${BASE}/data/topics/${topic}.json`);
  const data = res.ok ? ((await res.json()) as { ids?: string[] }) : {};
  const set = new Set(data.ids ?? []);
  topicCache.set(topic, set);
  return set;
}

// ---- Bài đọc & tra ngược lemma ----
let lemmaMapCache: Record<string, string> | null = null;
export async function loadLemmaMap(): Promise<Record<string, string>> {
  if (lemmaMapCache) return lemmaMapCache;
  const res = await fetch(`${BASE}/data/lemma-map.json`);
  lemmaMapCache = res.ok ? ((await res.json()) as Record<string, string>) : {};
  return lemmaMapCache;
}

let levelsCache: Record<string, number> | null = null;
export async function loadWordLevels(): Promise<Record<string, number>> {
  if (levelsCache) return levelsCache;
  const res = await fetch(`${BASE}/data/word-levels.json`);
  levelsCache = res.ok ? ((await res.json()) as Record<string, number>) : {};
  return levelsCache;
}

const wordsByLevelCache = new Map<number, Promise<Map<string, Word>>>();
function wordsMap(level: number): Promise<Map<string, Word>> {
  let m = wordsByLevelCache.get(level);
  if (!m) {
    m = loadWords(level).then((ws) => new Map(ws.map((w) => [w.id, w])));
    wordsByLevelCache.set(level, m);
  }
  return m;
}

// Chuẩn hoá dạng mặt chữ khi bấm-tra: bỏ dấu câu 2 đầu, thường hoá, giữ ' và - bên trong
// (don't, well-known).
export function normSurface(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^a-z'’-]+/u, "")
    .replace(/[^a-z'’-]+$/u, "")
    .replace(/’/g, "'");
}

/** Tra một dạng mặt chữ → Word (qua lemma-map + word-levels). null nếu không tìm được. */
export async function lookupWord(raw: string): Promise<Word | null> {
  const surface = normSurface(raw);
  if (!surface) return null;
  const [lemmaMap, levels] = await Promise.all([loadLemmaMap(), loadWordLevels()]);
  // thử: nguyên mặt chữ → lemma-map; possessive/contraction (word's, don't) → phần trước dấu ';
  // cuối cùng: chính mặt chữ đã là lemma trong bộ từ.
  const base = surface.split("'")[0] || surface;
  const lemma =
    lemmaMap[surface] ??
    (levels[surface] !== undefined ? surface : undefined) ??
    lemmaMap[base] ??
    (levels[base] !== undefined ? base : undefined);
  if (lemma === undefined) return null;
  const lv = levels[lemma];
  if (lv === undefined) return null;
  return (await wordsMap(lv)).get(lemma) ?? null;
}

// ---- Bài đọc theo cấp ----
export interface ReadingSentence {
  en: string;
  vi: string;
  sp?: number; // hội thoại: chỉ số vai nói (0/1) — bài đọc thường không có
}
export interface ReadingDoc {
  id: string;
  level: number;
  title_en: string;
  title_vi: string;
  sentences: ReadingSentence[];
  topic?: string; // "business" — module Tiếng Anh công việc
  speakers?: string[]; // có mặt = đây là HỘI THOẠI, mảng tên 2 vai
  src?: string;
  url?: string;
  date?: string; // "YYYY-MM-DD" — ngày đăng tin gốc (Wikinews), trích từ dateline lúc build
}
export interface ReadingMeta {
  id: string;
  level: number;
  title_en: string;
  title_vi: string;
  n: number;
  topic?: string;
  dialogue?: boolean;
}

let readingsIndexCache: ReadingMeta[] | null = null;
export async function loadReadingsIndex(): Promise<ReadingMeta[]> {
  if (readingsIndexCache) return readingsIndexCache;
  const res = await fetch(`${BASE}/data/readings-index.json`);
  readingsIndexCache = res.ok ? ((await res.json()) as ReadingMeta[]) : [];
  return readingsIndexCache;
}

// ---- Chỉ mục từ → bài đọc (sinh bằng scripts/build-word-readings.mjs) ----
// Giá trị là VỊ TRÍ bài trong readings-index.json (gọn hơn nhiều so với lưu id chuỗi). Mỗi
// shard mang theo `n` = số bài lúc build; lệch với index hiện tại nghĩa là chỉ mục cũ hơn dữ
// liệu bài đọc → bỏ qua, thà không gợi ý còn hơn trỏ nhầm bài.
type WordReadingShard = { n: number; w: Record<string, number[]> };
const wrShardCache = new Map<number, Promise<WordReadingShard | null>>();
function loadWordReadingShard(n: number): Promise<WordReadingShard | null> {
  let p = wrShardCache.get(n);
  if (!p) {
    p = fetch(`${BASE}/data/word-readings/${n}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<WordReadingShard>) : null))
      .catch(() => null);
    wrShardCache.set(n, p);
  }
  return p;
}

/** wordId → vị trí các bài đọc chứa từ đó. Chỉ tải shard chứa đúng những từ được hỏi. */
export async function loadWordReadings(wordIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!wordIds.length) return out;
  const index = await loadReadingsIndex();
  const shards = [...new Set(wordIds.map(exampleShardOf))];
  const loaded = await Promise.all(shards.map(loadWordReadingShard));
  const byShard = new Map(shards.map((n, i) => [n, loaded[i]]));
  for (const id of wordIds) {
    const shard = byShard.get(exampleShardOf(id));
    if (!shard || shard.n !== index.length) continue; // chỉ mục lỗi thời → bỏ qua
    const positions = shard.w[id];
    if (positions?.length) out.set(id, positions);
  }
  return out;
}

const readingsByLevel = new Map<number, ReadingDoc[]>();
export async function loadReadings(level: number): Promise<ReadingDoc[]> {
  let r = readingsByLevel.get(level);
  if (!r) {
    const res = await fetch(`${BASE}/data/readings/${levelSlug(level)}.json`);
    r = res.ok ? ((await res.json()) as ReadingDoc[]) : [];
    readingsByLevel.set(level, r);
  }
  return r;
}
