"use client";

// Phần bổ trợ trang /hoc: tìm kiếm từ TOÀN APP.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { loadWordLevels, loadWords, loadExamplesForWords, type ExampleSentence } from "@/lib/data";
import { toSearch } from "@/lib/slug";
import { levelMeta } from "@/lib/levels";
import type { Word } from "@/lib/types";
import WordDetail from "@/components/word-detail";

interface Hit {
  id: string;
  level: number;
}

export function GlobalWordSearch() {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Record<string, number> | null>(null);
  const [selected, setSelected] = useState<Word | null>(null);
  const [examples, setExamples] = useState<ExampleSentence[]>([]);

  // nạp chỉ mục 11k từ (≈100KB) lần đầu người dùng gõ
  useEffect(() => {
    if (q && !index) loadWordLevels().then(setIndex);
  }, [q, index]);

  // Kết quả tìm là GIÁ TRỊ DẪN XUẤT từ (q, index) → tính bằng useMemo, không dùng effect+setState.
  const hits: Hit[] = useMemo(() => {
    if (!q.trim() || !index) return [];
    const nq = toSearch(q);
    const out: Hit[] = [];
    for (const [id, level] of Object.entries(index)) {
      if (toSearch(id).startsWith(nq)) out.push({ id, level });
      if (out.length >= 60) break;
    }
    // khớp đầu từ trước, ưu tiên từ ngắn + cấp thấp
    out.sort((a, b) => a.id.length - b.id.length || a.level - b.level);
    return out.slice(0, 12);
  }, [q, index]);

  const open = async (h: Hit) => {
    const words = await loadWords(h.level);
    const w = words.find((x) => x.id === h.id);
    if (!w) return;
    const ex = await loadExamplesForWords(h.level, [w.id]);
    setExamples(ex[w.id] || []);
    setSelected(w);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="search"
          placeholder="Tra nhanh một từ bất kỳ…"
          className="w-full rounded-full border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      </div>
      {q.trim() && (
        <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-2xl border bg-background shadow-lg">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{index ? "Không tìm thấy từ nào." : "Đang tải chỉ mục…"}</p>
          ) : (
            hits.map((h) => (
              <button
                key={h.id}
                onClick={() => void open(h)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium">{h.id}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.level === 0 ? "Nền" : levelMeta(h.level)?.cefr}</span>
              </button>
            ))
          )}
        </div>
      )}
      {selected && (
        <WordDetail
          word={selected}
          examples={examples}
          onClose={() => {
            setSelected(null);
            setQ("");
          }}
        />
      )}
    </div>
  );
}
