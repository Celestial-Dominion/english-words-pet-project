"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

// Đồng bộ với class .dark trên <html> (script nội tuyến trong layout đặt sớm để tránh nháy).
function subscribe(cb: () => void) {
  window.addEventListener("fr-theme", cb);
  return () => window.removeEventListener("fr-theme", cb);
}
function isDark() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return (
    <button
      type="button"
      aria-label="Đổi giao diện sáng/tối"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("en.theme", next ? "dark" : "light");
        } catch {
          /* bỏ qua */
        }
        window.dispatchEvent(new Event("fr-theme"));
      }}
      className="inline-flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
