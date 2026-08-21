// Gợi ý bài đọc sau phiên học + khối "Gặp lại trong ngữ cảnh" ở thẻ từ.
//
// Cả hai chạy trên CHỈ MỤC từ→bài (public/data/word-readings/{0..7}.json, sinh bằng
// scripts/build-word-readings.mjs) chứ không quét văn bản: bản cũ gọi loadReadings() cho mọi
// cấp nên chỉ bấm-tra một từ là tải + parse ~4MB JSON.
import { loadReadingsIndex, loadWordReadings, type ReadingMeta } from "./data";
import { readIds } from "./db";

export interface ReadingSuggestion {
  type: "reading";
  id: string;
  level: number;
  title_en: string;
  title_vi: string;
  count: number; // số từ vừa học xuất hiện trong bài
}

const metaToSuggestion = (m: ReadingMeta, count: number): ReadingSuggestion => ({
  type: "reading",
  id: m.id,
  level: m.level,
  title_en: m.title_en,
  title_vi: m.title_vi,
  count,
});

/** Bài CHƯA đọc chứa nhiều từ vừa học nhất (hoà nhau thì lấy cấp thấp hơn). */
export async function suggestReading(wordIds: string[]): Promise<ReadingSuggestion | null> {
  if (wordIds.length < 2) return null;
  try {
    const [index, read, lists] = await Promise.all([
      loadReadingsIndex(),
      readIds(),
      loadWordReadings(wordIds.map((w) => w.toLowerCase())),
    ]);

    const hits = new Map<number, number>(); // vị trí bài → số từ khớp
    for (const positions of lists.values()) {
      for (const p of positions) hits.set(p, (hits.get(p) ?? 0) + 1);
    }

    let best: ReadingSuggestion | null = null;
    for (const [p, count] of hits) {
      if (count < 2) continue;
      const m = index[p];
      if (!m || read.has(m.id)) continue; // chỉ gợi ý bài CHƯA đọc
      if (!best || count > best.count || (count === best.count && m.level < best.level)) {
        best = metaToSuggestion(m, count);
      }
    }
    return best;
  } catch {
    return null;
  }
}

export interface Occurrence {
  type: "reading";
  id: string;
  level: number;
  title_en: string;
  title_vi: string;
}

/** "Gặp lại trong ngữ cảnh": các bài đọc có chứa từ này (tối đa `limit` bài, cấp thấp trước). */
export async function occurrencesOf(wordId: string, limit = 4): Promise<Occurrence[]> {
  try {
    const [index, lists] = await Promise.all([
      loadReadingsIndex(),
      loadWordReadings([wordId.toLowerCase()]),
    ]);
    const positions = lists.get(wordId.toLowerCase()) ?? [];
    return positions
      .map((p) => index[p])
      .filter((m): m is ReadingMeta => !!m)
      .slice(0, limit)
      .map((m) => ({ type: "reading" as const, id: m.id, level: m.level, title_en: m.title_en, title_vi: m.title_vi }));
  } catch {
    return [];
  }
}
