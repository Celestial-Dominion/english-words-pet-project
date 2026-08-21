"use client";

// NHIỆM VỤ NGÀY — 3 mục tiêu nhỏ xoay theo ngày, thanh tiến độ + tự nhận XP khi xong.
// Goal-gradient: mục tiêu nhỏ sắp chạm đích là lực kéo "học nốt hôm nay" mạnh nhất;
// đây là cơ chế giữ chân chính, huy hiệu chỉ là phần thưởng dài hạn phía sau.
import { useEffect, useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { todayQuests, type TodayQuests } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function DailyQuests() {
  const [data, setData] = useState<TodayQuests | null>(null);
  const [flash, setFlash] = useState(0); // XP vừa nhận — hiện chip nhỏ vài giây

  useEffect(() => {
    let alive = true;
    todayQuests().then((d) => {
      if (!alive) return;
      setData(d);
      if (d.justGranted > 0) {
        setFlash(d.justGranted);
        const t = setTimeout(() => setFlash(0), 4000);
        return () => clearTimeout(t);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null; // đang tải — khối tự xuất hiện, không cần skeleton
  const doneCount = data.quests.filter((p) => p.done).length;

  return (
    <section className="rounded-3xl border bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          ⚓ Nhiệm vụ hôm nay <span className="font-normal">· {doneCount}/{data.quests.length}</span>
        </h2>
        {flash > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary animate-in fade-in slide-in-from-bottom-1">
            <Sparkles className="size-3.5" /> +{flash} XP
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {data.quests.map((p) => {
          const pct = p.def.metric === "accuracy" ? (p.done ? 100 : Math.min(100, p.value)) : Math.min(100, Math.round((p.value / p.def.target) * 100));
          return (
            <div key={p.def.id} className="flex items-center gap-3">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-base", p.done ? "bg-emerald-500/15" : "bg-muted")}>
                {p.done ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> : p.def.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm font-medium", p.done && "text-muted-foreground line-through")}>{p.def.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.def.metric === "accuracy" ? `${p.value}%` : `${Math.min(p.value, p.def.target)}/${p.def.target}`} · +{p.def.xp} XP
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", p.done ? "bg-emerald-500" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
