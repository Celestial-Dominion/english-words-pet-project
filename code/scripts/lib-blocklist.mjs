// Danh sách CHẶN VĨNH VIỄN bài đọc (nội dung người lớn / bạo lực đồ hoạ / vandalism từ nguồn).
// Nguồn dữ liệu: scripts/readings-blocklist.json — mỗi mục { id, url, reason }.
//
// Vì sao cần: prep-reading-batches.mjs sinh lại rd-batches TỪ ĐẦU từ out/readings-raw.json, nên
// chỉ xoá file trong rd-batches/rd-done là không đủ — lần chạy sau bài sẽ quay lại. Chặn theo cả
// `id` lẫn `url` để đổi tiêu đề (→ đổi slug id) cũng không lọt lưới.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dirname, "readings-blocklist.json");
const entries = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];

const ids = new Set(entries.map((e) => e.id).filter(Boolean));
// URL so khớp sau khi bỏ phân biệt hoa-thường và giải mã %XX (nguồn ghi lẫn cả hai kiểu).
const norm = (u) => {
  try {
    return decodeURIComponent(String(u)).toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
};
const urls = new Set(entries.map((e) => e.url).filter(Boolean).map(norm));

export const BLOCKED_COUNT = entries.length;
export const isBlocked = (id, url) => (id != null && ids.has(id)) || (url != null && urls.has(norm(url)));
