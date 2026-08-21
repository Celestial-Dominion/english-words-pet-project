// ĐỌC TRƯỚC dữ liệu phiên (như HSK): gọi khi màn hình chờ (Ôn tập / Học từ) đã hiện,
// chạy nền sau ~350ms — người dùng nhìn bảng điều khiển một lúc trước khi bấm nút,
// trong khi toàn bộ chi phí mạng của phiên (words các cấp, shard ví dụ) dồn hết vào
// SAU cú bấm. data.ts cache theo PROMISE → warm xong (hoặc đang dở) là lúc dựng phiên
// dùng lại luôn, không tải trùng. Chỉ ĐỌC, không ghi gì; lỗi bỏ qua (phụ trợ).
import { db, getConfig } from "./db";
import { loadWords, loadExamplesForWords } from "./data";

let warmed = false;
export function warmSession(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
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
        await Promise.all(
          list.map(async (l) => {
            await loadWords(l).catch(() => []);
            const ids = due.filter((r) => r.level === l).map((r) => r.wordId);
            if (ids.length) await loadExamplesForWords(l, ids).catch(() => ({}));
          }),
        );
      } catch {
        /* warm là phụ trợ — lỗi mạng/DB bỏ qua, phiên tự tải như cũ */
      }
    })();
  }, 350);
}
