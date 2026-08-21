// Trạng thái đồng bộ để UI báo cho người dùng khi sync hỏng âm thầm (S6 — như HSK).
// Không phụ thuộc React: ai quan tâm thì subscribe.

export interface SyncStatus {
  /** Lần đồng bộ thành công gần nhất (ISO), null nếu chưa lần nào. */
  lastOk: string | null;
  /** Thông báo lỗi lần gần nhất, null nếu đang bình thường. */
  error: string | null;
  /** Số lần lỗi liên tiếp — dùng để quyết định có làm phiền người dùng không. */
  failCount: number;
  /** Số liệu lần đồng bộ gần nhất ("12.597 thẻ · 40 bài đã đọc") — để đối chiếu giữa 2 thiết bị. */
  info: string | null;
}

const KEY = "en.syncStatus";
const listeners = new Set<() => void>();

const EMPTY: SyncStatus = { lastOk: null, error: null, failCount: 0, info: null };

// Snapshot được cache: useSyncExternalStore yêu cầu getSnapshot trả CÙNG reference
// khi dữ liệu không đổi, nếu không sẽ render vô hạn.
let snapshot: SyncStatus | null = null;

export function getSyncStatus(): SyncStatus {
  if (snapshot) return snapshot;
  try {
    snapshot = { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<SyncStatus>) };
  } catch {
    snapshot = EMPTY;
  }
  return snapshot;
}

/** Snapshot cho SSR (không có localStorage) — luôn cùng reference. */
export function getServerSyncStatus(): SyncStatus {
  return EMPTY;
}

function write(s: SyncStatus): void {
  snapshot = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* bỏ qua */
  }
  for (const fn of listeners) fn();
}

export function setSyncOk(info: string | null = null, now = new Date()): void {
  write({ lastOk: now.toISOString(), error: null, failCount: 0, info });
}

export function setSyncError(message: string): void {
  const cur = getSyncStatus();
  write({ lastOk: cur.lastOk, error: message, failCount: cur.failCount + 1, info: cur.info });
}

export function onSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Đã lâu không đồng bộ được → đáng cảnh báo (mặc định 3 ngày). */
export function isStale(s: SyncStatus, days = 3, now = Date.now()): boolean {
  if (s.failCount === 0) return false;
  if (!s.lastOk) return s.failCount >= 3;
  return now - new Date(s.lastOk).getTime() > days * 86_400_000;
}
