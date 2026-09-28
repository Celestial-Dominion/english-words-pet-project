"use client";

// Khung bong bóng minh hoạ (ý nghĩ / cận cảnh). Nội dung (bubbles/*, tải lười theo bài) vẽ
// trong vòng tròn bán kính ~104, tâm (0,0); cảnh tự đặt bong bóng trên đầu người nói và vẽ
// đuôi chỉ về phía họ.
import { useId } from "react";
import type { Draw } from "./assets";

export const BUBBLE_R = 112;

// (tx, ty) = hướng đuôi (đơn vị).
export function Bubble({ draw, tx, ty }: { draw: Draw; tx: number; ty: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = BUBBLE_R;
  return (
    <g>
      <circle cx={tx * (r + 22)} cy={ty * (r + 22)} r={15} fill="#fff" stroke="#3A3A3A" strokeWidth={5} />
      <circle cx={tx * (r + 52)} cy={ty * (r + 52)} r={9} fill="#fff" stroke="#3A3A3A" strokeWidth={4} />
      <clipPath id={`${uid}c`}>
        <circle r={r - 6} />
      </clipPath>
      <circle r={r} fill="#fff" stroke="#3A3A3A" strokeWidth={6} />
      <g clipPath={`url(#${uid}c)`}>{draw()}</g>
    </g>
  );
}
