import { GraduationCap, Layers, Library, Flame, Dumbbell, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
  match: string[];
}

// Nguồn duy nhất cho cả MainNav (desktop) & BottomNav (mobile). Thứ tự + icon như HSK.
export const NAV_TABS: NavTab[] = [
  { href: "/hoc", label: "Học từ", icon: GraduationCap, match: ["/hoc"] },
  { href: "/on-tap", label: "Ôn tập", icon: Layers, match: ["/on-tap"] },
  { href: "/luyen-tap", label: "Luyện", icon: Dumbbell, match: ["/luyen-tap"] },
  { href: "/tien-do", label: "Tiến độ", icon: Flame, match: ["/tien-do"] },
  { href: "/doc", label: "Thư viện", icon: Library, match: ["/doc", "/bai-doc", "/truyen", "/video"] },
];
