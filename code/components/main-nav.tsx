"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_TABS } from "@/components/nav-tabs";

// Điều hướng ngang cho desktop (ẩn trên mobile — mobile dùng BottomNav).
export default function MainNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV_TABS.map((t) => {
        const on = t.match.some((m) => (m === "/" ? path === "/" : path.startsWith(m)));
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={on ? 2.4 : 2} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
