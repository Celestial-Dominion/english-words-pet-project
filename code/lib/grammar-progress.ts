// Tiến độ bài Ngữ pháp: IndexedDB (bảng grammar, Dexie v5) — đi qua đồng bộ / sao lưu dưới dạng chuỗi mã hoá
// (lib/grammar.ts encodeGrammarRow). Chạy client.
import { addXp, db, recordPractice } from "./db";
import { XP } from "./gamify";
import { requestSync } from "./sync";
import { applyPractice, markLearned, unmarkLearned, type GrammarRow } from "./grammar";

export async function grammarRows(): Promise<Map<string, GrammarRow>> {
  const rows = await db.grammar.toArray();
  return new Map(rows.map((r) => [r.id, r]));
}

export async function grammarRow(id: string): Promise<GrammarRow | undefined> {
  return db.grammar.get(id);
}

// Một câu luyện tập vừa trả lời: tính vào thống kê ngày (chuỗi ngày, nhiệm vụ) như Luyện tập tự do + XP khi đúng.
export async function recordGrammarAnswer(correct: boolean): Promise<void> {
  await recordPractice(correct).catch(() => {});
  if (correct) await addXp(XP.practice).catch(() => {});
}

// Ghi kết quả một lần luyện tập (điểm 0–100) → cập nhật đã học / lịch ôn, rồi xin đồng bộ.
export async function recordGrammarPractice(id: string, score: number, now = new Date()): Promise<GrammarRow> {
  const row = await db.transaction("rw", db.grammar, async () => {
    const next = applyPractice(await db.grammar.get(id), id, score, now);
    await db.grammar.put(next);
    return next;
  });
  requestSync();
  return row;
}

// Đánh dấu đã học bằng tay / bỏ đánh dấu (giữ điểm cao nhất, mốc mới hơn thắng khi đồng bộ).
export async function setGrammarLearned(id: string, learned: boolean, now = new Date()): Promise<void> {
  await db.transaction("rw", db.grammar, async () => {
    const cur = await db.grammar.get(id);
    if (learned) await db.grammar.put(markLearned(cur, id, now));
    else if (cur) await db.grammar.put(unmarkLearned(cur, now));
  });
  requestSync();
}
