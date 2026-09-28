// Gợi ý học liệu sau phiên học + khối "Gặp lại trong ngữ cảnh" ở thẻ từ.
//
// Cả hai chạy trên CHỈ MỤC từ→học liệu (public/data/library/word-refs/{0..7}.json, sinh bằng
// scripts/build-content.mjs) chứ không quét văn bản: bấm-tra một từ chỉ tải đúng một shard nhỏ.
import { loadWordRefs, type ContentRef } from "./library";
import { readIds } from "./db";

export interface ContentSuggestion extends ContentRef {
  count: number; // số từ vừa học xuất hiện trong bài
}
/** @deprecated tên cũ — giữ cho nơi gọi hiện có. */
export type ReadingSuggestion = ContentSuggestion;

const ORDER = ["a1", "a2", "b1", "b2", "c1", "c2"];

/** Bài đọc / truyện CHƯA đọc chứa nhiều từ vừa học nhất (hoà nhau thì lấy cấp thấp hơn, bài đọc trước). */
export async function suggestReading(wordIds: string[]): Promise<ContentSuggestion | null> {
  if (wordIds.length < 2) return null;
  try {
    const [read, refs] = await Promise.all([readIds(), loadWordRefs(wordIds.map((w) => w.toLowerCase()))]);
    const hits = new Map<string, { ref: ContentRef; count: number }>();
    for (const list of refs.values())
      for (const r of list) {
        if (r.kind === "video") continue;
        const h = hits.get(r.id) ?? { ref: r, count: 0 };
        h.count++;
        hits.set(r.id, h);
      }
    let best: ContentSuggestion | null = null;
    for (const { ref, count } of hits.values()) {
      if (count < 2 || read.has(ref.id)) continue;
      const better =
        !best ||
        count > best.count ||
        (count === best.count && (ORDER.indexOf(ref.level) < ORDER.indexOf(best.level) || (ref.level === best.level && ref.kind === "reading" && best.kind !== "reading")));
      if (better) best = { ...ref, count };
    }
    return best;
  } catch {
    return null;
  }
}

export type Occurrence = ContentRef;

/** "Gặp lại trong ngữ cảnh": bài đọc / truyện / video có từ này (tối đa `limit`, đủ loại trước, cấp thấp trước). */
export async function occurrencesOf(wordId: string, limit = 5): Promise<Occurrence[]> {
  try {
    const refs = (await loadWordRefs([wordId.toLowerCase()])).get(wordId.toLowerCase()) ?? [];
    const out: Occurrence[] = [];
    for (const k of ["reading", "story", "video"] as const) {
      const r = refs.find((x) => x.kind === k);
      if (r) out.push(r);
    }
    for (const r of refs) if (out.length < limit && !out.includes(r)) out.push(r);
    return out.sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level)).slice(0, limit);
  } catch {
    return [];
  }
}
