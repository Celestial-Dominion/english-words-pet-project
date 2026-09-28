"use client";

// Transcript tự cuộn theo câu đang phát (dùng chung Video + Ngữ pháp): câu mới bắt đầu → đưa vào khoảng trên của vùng
// còn nhìn thấy (dưới header / cảnh dính). Người dùng vừa tự cuộn (4 s) hoặc transcript đã khuất hẳn → không giật trang.
import { useEffect, useRef, type RefObject } from "react";

export function useFollowScroll(box: RefObject<HTMLElement | null>, idx: number, topInset: () => number, attr = "data-line") {
  const lastUser = useRef(0);
  useEffect(() => {
    const mark = () => (lastUser.current = Date.now());
    const onKey = (e: KeyboardEvent) => {
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) mark();
    };
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchmove", mark);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    if (idx < 0 || Date.now() - lastUser.current < 4000) return;
    const el = box.current?.querySelector<HTMLElement>(`[${attr}="${idx}"]`);
    if (!el || !box.current) return;
    const top = topInset();
    const b = box.current.getBoundingClientRect();
    if (b.bottom < top + 40 || b.top > window.innerHeight - 40) return;
    const r = el.getBoundingClientRect();
    const region = window.innerHeight - top;
    const want = top + Math.min(24, region * 0.06);
    if (Math.abs(r.top - want) < 8) return;
    window.scrollTo({ top: window.scrollY + r.top - want, behavior: "smooth" });
  }, [idx, topInset, box, attr]);
}
