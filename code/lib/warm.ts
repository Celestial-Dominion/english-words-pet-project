// ĐỌC TRƯỚC dữ liệu phiên (như HSK): gọi khi màn hình chờ (Ôn tập / Học từ) đã hiện,
// chạy nền sau ~350ms — người dùng nhìn bảng điều khiển một lúc trước khi bấm nút,
// trong khi toàn bộ chi phí mạng của phiên (words các cấp, shard ví dụ) dồn hết vào
// SAU cú bấm. data.ts cache theo PROMISE → warm xong (hoặc đang dở) là lúc dựng phiên
// dùng lại luôn, không tải trùng. Chỉ ĐỌC, không ghi gì; lỗi bỏ qua (phụ trợ). Ngoại lệ duy nhất là
// healLegacyLevels ở cuối file (sửa level của thẻ A1 tạo trước khi tách A1/A2).
import { db, getConfig, healLevels } from "./db";
import { loadWords, loadExamplesForWords, loadLemmaMap, loadWordLevels } from "./data";

let warmed = false;
export function warmSession(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  void healLegacyLevels();
  setTimeout(() => {
    void (async () => {
      try {
        const [cfg, due] = await Promise.all([
          getConfig(),
          db.reviews.where("due").belowOrEqual(new Date()).toArray(),
        ]);
        const levels = new Set<number>(due.map((r) => r.level));
        if (cfg.newLevel > 0) levels.add(cfg.newLevel); // cấp học từ mới cố định (0 = tự động, khó đoán rẻ)
        const list = [...levels].slice(0, 3); // đừng kéo cả 5 cấp một lúc
        await Promise.all([
          loadLemmaMap().catch(() => ({})),
          loadWordLevels().catch(() => ({})),
          ...list.map(async (l) => {
            await loadWords(l).catch(() => []);
            const ids = due.filter((r) => r.level === l).map((r) => r.wordId);
            if (ids.length) await loadExamplesForWords(l, ids).catch(() => ({}));
          }),
        ]);
      } catch {
        /* warm là phụ trợ — lỗi mạng/DB bỏ qua, phiên tự tải như cũ */
      }
    })();
  }, 350);
}

// Thẻ từ A1 tạo trước khi tách A1/A2 còn mang level 0 (bộ nền cũ) → sửa một lần mỗi lần mở app để
// tiến độ từng cấp đúng (db.healLevels). Chỉ tải word-levels.json khi THẬT SỰ có thẻ level 0.
let healed: Promise<number> | null = null;
export function healLegacyLevels(): Promise<number> {
  if (typeof window === "undefined") return Promise.resolve(0);
  healed ??= (async () => {
    if (!(await db.reviews.where("level").equals(0).count())) return 0;
    return healLevels(await loadWordLevels());
  })().catch(() => 0);
  return healed;
}
