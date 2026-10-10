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

/** Giao diện tối đang bật? — dùng chung cho nút trên topbar và mục Giao diện trong Cài đặt. */
export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false);
}

export function setDarkMode(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("en.theme", dark ? "dark" : "light");
  } catch {
    /* bỏ qua */
  }
  window.dispatchEvent(new Event("fr-theme"));
}

export function ThemeToggle() {
  const dark = useDarkMode();
  return (
    <button
      type="button"
      aria-label="Đổi giao diện sáng/tối"
      onClick={() => setDarkMode(!dark)}
      className="inline-flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
