"use client";

// LUYỆN TẬP TỰ DO (như /luyen-tap của HSK): luyện câu của các từ ĐÃ HỌC — không chấm
// FSRS, không đổi lịch ôn, chỉ cộng XP luyện + thống kê ngày. Hai chế độ:
//  • Nghe & gõ câu (dictation) — bản tiếng Anh của luyện gõ bên HSK.
//  • Ghép câu — xáo khối từ, xếp lại (chỉ câu toàn từ đã biết, khỏi đoán mù).
// Phạm vi tự chọn: tất cả / hay quên / đến hạn / theo cấp.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Headphones, Puzzle, ChevronLeft } from "lucide-react";
import { practiceCounts, gatherPracticeSentences, type PracticeScope, type PracticeSentence } from "@/lib/practice-free";
import { tokenize, arrangeReady, ARRANGE_TOKENS } from "@/lib/review-session";
import { learnedIds, recordPractice, addXp } from "@/lib/db";
import { XP } from "@/lib/gamify";
import { LEVELS, FOUNDATION } from "@/lib/levels";
import SentenceArrange from "@/components/sentence-arrange";
import DictationCard from "@/components/dictation-card";
import { cn } from "@/lib/utils";

type Mode = "dictation" | "arrange";
const SESSION_SIZE = 10;

interface Counts {
  all: number;
  hard: number;
  due: number;
  byLevel: Record<number, number>;
}

export default function LuyenTapPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [scope, setScope] = useState<PracticeScope>("all");
  const [mode, setMode] = useState<Mode>("dictation");
  const [busy, setBusy] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [session, setSession] = useState<PracticeSentence[] | null>(null);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [xpGained, setXpGained] = useState(0);

  useEffect(() => {
    practiceCounts().then(setCounts);
  }, []);

  const start = async () => {
    setBusy(true);
    setEmpty(false);
    try {
      // Luật "câu dùng được" truyền THẲNG vào gather — nó còn bốc tiếp được khi mẫu đầu
      // rơi hết (lọc sau khi gom là dính "hết câu" giả). Ghép câu: câu vừa sức, cận token
      // dùng chung với phiên ôn. Dictation: không quá dài + KHÔNG chứa chữ số (audio đọc
      // "nineteen ninety-eight" mà đích là "1998" → chấm oan người gõ dạng chữ).
      const known = mode === "arrange" ? await learnedIds() : undefined;
      const usable = (s: PracticeSentence): boolean => {
        const tokens = tokenize(s.en);
        if (mode === "arrange")
          return tokens.length >= ARRANGE_TOKENS.min && tokens.length <= ARRANGE_TOKENS.max && arrangeReady(tokens, known, s.wordId);
        return tokens.length >= 3 && tokens.length <= 14 && !/\d/.test(s.en);
      };
      const list = await gatherPracticeSentences(scope, SESSION_SIZE, new Date(), usable);
      if (list.length === 0) {
        setEmpty(true);
        return;
      }
      setSession(list);
      setI(0);
      setRight(0);
      setXpGained(0);
    } finally {
      setBusy(false);
    }
  };

  const answered = (correct: boolean) => {
    if (correct) {
      setRight((r) => r + 1);
      setXpGained((x) => x + XP.practice);
      void addXp(XP.practice);
    }
    void recordPractice(correct);
    setI((k) => k + 1);
  };

  const scopeChips = useMemo(() => {
    if (!counts) return [];
    const chips: { key: PracticeScope; label: string; n: number }[] = [
      { key: "all", label: "Tất cả đã học", n: counts.all },
      { key: "hard", label: "Hay quên", n: counts.hard },
      { key: "due", label: "Đến hạn hôm nay", n: counts.due },
    ];
    for (const l of [...LEVELS, FOUNDATION]) {
      const n = counts.byLevel[l.level] ?? 0;
      if (n > 0) chips.push({ key: l.level, label: l.cefr, n });
    }
    return chips;
  }, [counts]);

  // ---- đang trong phiên ----
  if (session) {
    const done = i >= session.length;
    const cur = session[i];
    return (
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setSession(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Thoát
          </button>
          <div className="text-sm font-medium text-muted-foreground">
            {Math.min(i + 1, session.length)}/{session.length}
          </div>
        </div>
        {done ? (
          <div className="space-y-4 rounded-3xl border bg-card p-8 text-center shadow-sm">
            <div className="text-4xl">{right === session.length ? "🏅" : right >= session.length / 2 ? "💪" : "🌊"}</div>
            <h2 className="text-xl font-bold">
              Đúng {right}/{session.length} câu
            </h2>
            {xpGained > 0 && <div className="text-sm font-medium text-primary">+{xpGained} điểm</div>}
            <p className="text-sm text-muted-foreground">Luyện tự do không đổi lịch ôn — cứ thoải mái.</p>
            <div className="flex gap-2">
              <button
                onClick={start}
                className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                Luyện tiếp
              </button>
              <button
                onClick={() => setSession(null)}
                className="flex-1 rounded-2xl border py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Đổi chế độ
              </button>
            </div>
          </div>
        ) : mode === "dictation" ? (
          <DictationCard key={i} en={cur.en} vi={cur.vi} onNext={answered} />
        ) : (
          <SentenceArrange key={i} en={cur.en} vi={cur.vi} tokens={tokenize(cur.en)} onNext={answered} />
        )}
      </div>
    );
  }

  // ---- màn chọn ----
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Luyện tập</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Luyện câu của từ đã học — không chấm điểm ghi nhớ, không đổi lịch ôn.
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chế độ</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("dictation")}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-sm font-semibold transition-colors",
              mode === "dictation" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <Headphones className="size-5" /> Nghe & gõ câu
          </button>
          <button
            onClick={() => setMode("arrange")}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-sm font-semibold transition-colors",
              mode === "arrange" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <Puzzle className="size-5" /> Ghép câu
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phạm vi từ</div>
        {counts === null ? (
          <div className="text-sm text-muted-foreground">Đang tải…</div>
        ) : counts.all === 0 ? (
          <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            Chưa có từ nào được học — vào{" "}
            <Link href="/hoc" className="font-medium text-primary hover:underline">
              Học từ
            </Link>{" "}
            trước nhé.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {scopeChips.map((c) => (
              <button
                key={String(c.key)}
                onClick={() => setScope(c.key)}
                disabled={c.n === 0}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40",
                  scope === c.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                {c.label} · {c.n.toLocaleString("vi")}
              </button>
            ))}
          </div>
        )}
      </div>

      {empty && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          {mode === "arrange"
            ? "Chưa đủ câu “vừa sức” trong phạm vi này (bài ghép chỉ dùng câu toàn từ đã biết, cần đã học ≥40 từ). Thử phạm vi rộng hơn hoặc chế độ Nghe & gõ."
            : "Phạm vi này chưa có câu ví dụ phù hợp. Thử phạm vi rộng hơn."}
        </div>
      )}

      <button
        onClick={start}
        disabled={busy || !counts || counts.all === 0}
        className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
      >
        {busy ? "Đang chuẩn bị…" : `Bắt đầu ${SESSION_SIZE} câu`}
      </button>
    </div>
  );
}
