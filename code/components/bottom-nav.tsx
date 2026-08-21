"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/nav-tabs";

// Thanh điều hướng dưới cùng (chỉ điện thoại) — kiểu app học ngôn ngữ.
export default function BottomNav() {
  const path = usePathname();
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
                "flex flex-1 flex-col items-center gap-1 pt-2 pb-1.5 text-[0.65rem] font-medium transition-colors active:scale-95",
                on ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", on && "bg-primary/15")}>
                <Icon className="size-5" strokeWidth={on ? 2.4 : 2} />
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
