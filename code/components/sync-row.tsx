"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import { RefreshCw } from "lucide-react";
import { firebaseEnabled, watchAuth, requestSync } from "@/lib/sync";
import { getSyncStatus, getServerSyncStatus, onSyncStatus } from "@/lib/sync-status";
import { cn } from "@/lib/utils";

/**
 * Dòng trạng thái ĐỒNG BỘ trong màn ôn tập (như app HSK). Trước đây trạng thái sync chỉ nằm
 * trong menu tài khoản, nên đang ôn thì không biết tiến độ đã lên cloud chưa.
 * Số liệu "12.597 thẻ · 40 bài đã đọc" để đối chiếu nhanh giữa 2 thiết bị.
 * Nút bấm phát event "en:sync" — dùng lại đúng đường sync của AuthSync (nơi giữ user + debounce)
 * thay vì mở thêm một lối gọi Firestore thứ hai.
 */
export default function SyncRow() {
  const status = useSyncExternalStore(onSyncStatus, getSyncStatus, getServerSyncStatus);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchAuth(setUser), []);
  // Nút chỉ kích hoạt sync nền → coi như xong sau ~3s (AuthSync gộp yêu cầu trong 2s).
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setBusy(false), 3000);
    return () => window.clearTimeout(t);
  }, [busy]);

  if (!firebaseEnabled) return null;

  const at = status.lastOk ? new Date(status.lastOk).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const line = !user
    ? "Chưa đăng nhập — tiến độ chỉ nằm trên máy này"
    : busy
      ? "Đang đồng bộ…"
      : status.error
        ? `⚠️ Đồng bộ lỗi: ${status.error}`
        : at
          ? `Đã đồng bộ lúc ${at}`
          : "Chưa đồng bộ trong phiên này";

  return (
    <div className="space-y-1 rounded-2xl border px-4 py-2.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <span className={cn("min-w-0 truncate", status.error && "text-rose-600 dark:text-rose-400")}>{line}</span>
        {user && (
          <button
            type="button"
            onClick={() => {
              setBusy(true);
              requestSync();
            }}
            disabled={busy}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> Đồng bộ ngay
          </button>
        )}
      </div>
      {status.info && !busy && !status.error && <div className="truncate tabular-nums">{status.info}</div>}
    </div>
  );
}
