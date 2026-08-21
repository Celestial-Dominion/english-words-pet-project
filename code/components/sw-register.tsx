"use client";

import { useEffect } from "react";

// Đăng ký service worker sau sự kiện load (không tranh băng thông lúc tải trang) — như HSK.
export default function SwRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* bỏ qua lỗi đăng ký SW */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
