// Đã đọc / đã xem của Thư viện (bài đọc · truyện · video "vd-"): bảng reads (lib/db.ts markRead — bỏ đánh dấu để lại
// tombstone nên đồng bộ không "hồi sinh"), rồi xin đồng bộ ngay như Ngữ pháp (lib/grammar-progress.ts). Chạy client.
import { markRead } from "./db";
import { requestSync } from "./sync";

export async function setRead(id: string, read: boolean): Promise<void> {
  await markRead(id, read);
  requestSync();
}
