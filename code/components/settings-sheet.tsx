"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Settings, X } from "lucide-react";
import SettingsPanel from "@/components/settings-panel";

// Ngăn Cài đặt dùng chung toàn app: nút ⚙️ trên topbar (mọi trang) và nút Cài đặt ở tab Ôn tập
// cùng mở MỘT ngăn này qua sự kiện — bấm một lần là thấy đủ mọi cài đặt, chỉnh xong đóng lại vẫn
// đứng nguyên chỗ cũ (kể cả giữa phiên học: nút là <button> nên không dính hộp "rời phiên?").
const OPEN_EVENT = "en:settings-open";

export function openSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function SettingsButton() {
  return (
    <button
      type="button"
      onClick={openSettings}
      aria-label="Cài đặt"
      aria-haspopup="dialog"
      className="grid size-9 place-items-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
    >
      <Settings className="size-4" />
    </button>
  );
}

export default function SettingsSheet() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    // đổi trang (nút Back của máy…) → đóng ngăn, không để nó đè lên trang mới
    setPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  return open ? <Sheet onClose={() => setOpen(false)} /> : null;
}

function Sheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // khoá cuộn nền + đưa focus vào ngăn; đóng thì trả focus về nút đã mở
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      back?.focus?.();
    };
  }, []);

  return (
    /* Mobile: bottom-sheet · Desktop (sm+): ngăn kéo phải cao hết màn hình (như thẻ từ) */
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50 backdrop-blur-sm sm:flex-row"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // Phím gõ trong ngăn không lọt ra phím tắt của phiên học bên dưới (1–4, Enter, Space…)
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") onClose();
        }}
        className="flex h-[90dvh] flex-col rounded-t-3xl border-t bg-background shadow-2xl outline-none duration-200 animate-in slide-in-from-bottom-4 sm:h-full sm:w-full sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l sm:slide-in-from-right-4"
      >
        <div className="shrink-0 px-3 pt-2.5 pb-3 sm:pt-4">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
          <div className="flex items-center justify-between gap-3 pl-1">
            <h2 id="settings-title" className="text-lg font-bold tracking-tight">
              Cài đặt
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cài đặt"
              className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
}
