"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { countDue } from "@/lib/db";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/nav-tabs";

// Thanh điều hướng dưới cùng (chỉ điện thoại) — kiểu app học ngôn ngữ.
export default function BottomNav() {
  const path = usePathname();

  // Badge số thẻ ĐẾN HẠN trên tab Ôn tập (như HSK) — mở app là thấy còn bao nhiêu thẻ chờ,
  // không cần vào tab. now làm mốc + tick 60s để thẻ vừa tới hạn tự hiện ra
  // (liveQuery chỉ tự chạy lại khi DB đổi, không tự chạy khi thời gian trôi).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);
  const due = useLiveQuery(() => countDue(new Date(now)), [now], 0);

  return (
    <nav
      id="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/90 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_TABS.map((t) => {
          const on = t.match.some((m) => (m === "/" ? path === "/" : path.startsWith(m)));
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 pt-2 pb-1.5 text-[0.62rem] font-medium whitespace-nowrap transition-colors active:scale-95",
                on ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("relative flex h-8 w-12 max-w-full items-center justify-center rounded-full transition-colors", on && "bg-primary/15")}>
                <Icon className="size-5" strokeWidth={on ? 2.4 : 2} />
                {t.href === "/on-tap" && due > 0 && (
                  <span className="absolute -top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] leading-none font-bold text-white">
                    {due > 99 ? "99+" : due}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
