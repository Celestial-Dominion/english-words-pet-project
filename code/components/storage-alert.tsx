"use client";

import { useSyncExternalStore } from "react";
import { TriangleAlert } from "lucide-react";
import { getStorageStatus, subscribeStorageStatus } from "@/lib/storage-status";

// Banner cảnh báo khi IndexedDB hỏng (chế độ riêng tư / hết quota / tab cũ sau
// deploy) — tiến trình học KHÔNG lưu được, phải cho người dùng biết ngay.
export function StorageAlert() {
  const status = useSyncExternalStore(subscribeStorageStatus, getStorageStatus, getStorageStatus);
  if (!status.lastError) return null;
  return (
    <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-xs font-medium text-destructive">
      <TriangleAlert className="mr-1 inline size-3.5 align-[-2px]" />
      Không lưu được dữ liệu học ({status.lastError}) —{" "}
      <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
        tải lại trang
      </button>
    </div>
  );
}
