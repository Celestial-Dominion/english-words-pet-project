"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Medal, Sparkles } from "lucide-react";
import { progressSummary } from "@/lib/db";
import { rankForWords } from "@/lib/gamify";

// Chip cấp bậc hiện tại + XP ở header → bấm vào mở trang Binh nghiệp (thành tựu).
export default function LevelChip() {
  const [words, setWords] = useState<number | null>(null);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    progressSummary().then((s) => {
      setWords(s.words);
      setXp(s.xp);
    });
  }, []);

  if (words === null) return null;
  const { rank } = rankForWords(words);

  return (
    <Link
      href="/tu-luyen"
      aria-label={`Cấp bậc ${rank.vi} · ${xp} điểm`}
      className="flex items-center gap-1.5 rounded-full border bg-background py-1 pr-2.5 pl-1 transition-colors hover:bg-muted"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Medal className="size-4" />
      </span>
      <span className="hidden text-xs font-semibold sm:block">{rank.vi}</span>
      {xp > 0 && (
        <span className="flex items-center gap-0.5 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
          <Sparkles className="size-3" />
          {xp.toLocaleString("vi")}
        </span>
      )}
    </Link>
  );
}
