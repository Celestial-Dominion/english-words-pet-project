// Trạng thái LƯU TRỮ IndexedDB (THUẦN, in-memory) — để UI hiện cảnh báo khi ghi
// dữ liệu hỏng (Safari chế độ riêng tư, hết quota, tab cũ sau khi deploy bản mới)
// thay vì nuốt im lặng: người dùng học cả phiên mà không biết là KHÔNG lưu được gì.
// Cùng khuôn với sync-status (useSyncExternalStore). Port từ app HSK.

let lastError: string | null = null;
let lastErrorAt = 0;
const listeners = new Set<() => void>();

export interface StorageStatus {
  lastError: string | null;
  lastErrorAt: number;
}

// Snapshot bất biến cho useSyncExternalStore — rebuild NGAY TRONG emit để không
// bao giờ lệch giữa state và snapshot (tránh bẫy thứ tự listener).
let snapshot: StorageStatus = { lastError, lastErrorAt };

function emit(): void {
  snapshot = { lastError, lastErrorAt };
  for (const fn of listeners) fn();
}

export function noteStorageError(e: unknown): void {
  lastError = e instanceof Error ? e.message : String(e ?? "unknown");
  lastErrorAt = Date.now();
  emit();
}

export function getStorageStatus(): StorageStatus {
  return snapshot;
}

export function subscribeStorageStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
