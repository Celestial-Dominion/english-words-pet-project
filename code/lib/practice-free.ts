// Nguồn câu cho mục LUYỆN TẬP tự do (/luyen-tap — như HSK): câu ví dụ của các từ
// ĐÃ HỌC, theo phạm vi tự chọn. Luyện chủ động — KHÔNG chấm FSRS, không đổi lịch ôn.
import { db } from "./db";
import { loadExamplesForWords, type ExampleSentence } from "./data";
import { practiceScopeFilter, type PracticeScope } from "./srs-pure";

export type { PracticeScope };

export interface PracticeSentence extends ExampleSentence {
  wordId: string; // từ "chủ" của câu (để lọc câu vừa sức khi ghép câu)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Số TỪ trong từng phạm vi (hiện ở màn chọn để biết phạm vi rộng hẹp). */
export async function practiceCounts(now = new Date()): Promise<{
  all: number;
  hard: number;
  due: number;
  byLevel: Record<number, number>;
}> {
  const recs = await db.reviews.toArray();
  const byLevel: Record<number, number> = {};
  for (const r of recs) byLevel[r.level] = (byLevel[r.level] ?? 0) + 1;
  return {
    all: recs.length,
    hard: practiceScopeFilter(recs, "hard", now).length,
    due: practiceScopeFilter(recs, "due", now).length,
    byLevel,
  };
}

// Gom câu luyện: vòng tròn mỗi lượt 1 câu/từ (phủ NHIỀU TỪ trước — tránh một từ chiếm
// cả phiên bằng đủ 5 câu của nó), từ và câu đều xáo trộn, cắt theo cỡ phiên.
// `usable` là luật "câu dùng được" của TỪNG chế độ (ghép câu cần câu vừa sức, dictation
// tránh câu quá dài/chứa chữ số) — phải lọc TẠI ĐÂY, trong lúc còn bốc tiếp được: lọc
// sau khi đã chốt mẫu nhỏ thì mẫu đầu rơi hết là báo "hết câu" GIẢ dù hàng trăm câu
// đủ điều kiện chưa được bốc. Bốc theo LÔ từ, chỉ dừng khi đủ câu hoặc CẠN từ.
// Mỗi lô chỉ tải shard ví dụ của đúng những từ trong lô (mỗi shard ~vài chục KB).
export async function gatherPracticeSentences(
  scope: PracticeScope,
  limit: number,
  now = new Date(),
  usable: (s: PracticeSentence) => boolean = () => true,
): Promise<PracticeSentence[]> {
  const recs = practiceScopeFilter(await db.reviews.toArray(), scope, now);
  if (recs.length === 0) return [];
  const order = shuffle(recs);
  const out: PracticeSentence[] = [];
  const CHUNK = Math.max(limit, 12);
  for (let start = 0; start < order.length && out.length < limit; start += CHUNK) {
    const chunk = order.slice(start, start + CHUNK);
    const byLevel = new Map<number, string[]>();
    for (const r of chunk) {
      const ids = byLevel.get(r.level) ?? [];
      ids.push(r.wordId);
      byLevel.set(r.level, ids);
    }
    const maps = await Promise.all(
      [...byLevel].map(([lv, ids]) => loadExamplesForWords(lv, ids).catch(() => ({} as Record<string, ExampleSentence[]>))),
    );
    const exByWord = Object.assign({}, ...maps) as Record<string, ExampleSentence[]>;
    const groups = shuffle(
      chunk
        .map((r) => ({
          list: shuffle((exByWord[r.wordId] ?? []).map((s) => ({ ...s, wordId: r.wordId }))).filter(usable),
        }))
        .filter((g) => g.list.length > 0),
    );
    for (let round = 0; out.length < limit; round++) {
      let added = false;
      for (const g of groups) {
        if (round < g.list.length) {
          out.push(g.list[round]);
          added = true;
          if (out.length >= limit) break;
        }
      }
      if (!added) break; // lô này cạn câu → bốc lô kế
    }
  }
  return out;
}
