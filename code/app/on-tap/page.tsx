"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Zap, Brain, Plus, ChevronRight } from "lucide-react";
import {
  countDue,
  countAhead,
  countHard,
  getDueReviews,
  getAheadReviews,
  getHardReviews,
  learnedIds,
  newTodayCount,
  getConfig,
  onConfigChanged,
  progressSummary,
} from "@/lib/db";
import {
  loadWords,
  loadExamplesForWords,
  loadLemmaMap,
  loadWordLevels,
  type ExampleSentence,
} from "@/lib/data";
import { warmSession } from "@/lib/warm";
import { onSyncMerged } from "@/lib/sync";
import { buildQuestions, type Question } from "@/lib/review-session";
import type { Word, SrsConfig, ReviewRecord } from "@/lib/types";
import ReviewRunner from "@/components/review-runner";
import SyncRow from "@/components/sync-row";
import { GrammarDueCard } from "@/components/grammar/grammar-due";
import DailyQuests from "@/components/daily-quests";
import { openSettings } from "@/components/settings-sheet";

export default function OnTapPage() {
  const [due, setDue] = useState(0);
  const [ahead, setAhead] = useState(0);
  const [hard, setHard] = useState(0);
  const [learned, setLearned] = useState(0);
  const [remainNew, setRemainNew] = useState(0);
  const [cfg, setCfg] = useState<SrsConfig | null>(null);
  const [session, setSession] = useState<{ qs: Question[]; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [d, a, h, sum, c, nToday] = await Promise.all([
      countDue(),
      countAhead(),
      countHard(),
      progressSummary(),
      getConfig(),
      newTodayCount(),
    ]);
    setDue(d);
    setAhead(Math.min(a, 20));
    setHard(h);
    setLearned(sum.words);
    setCfg(c);
    setRemainNew(Math.max(0, c.newPerDay - nToday));
  }, []);
  useEffect(() => {
    // refresh() là async: mọi setState nằm SAU await nên không đồng bộ trong effect body.
    // Rule không phân tích được qua useCallback async → tắt tại chỗ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    warmSession(); // đọc trước words + shard ví dụ trong lúc người dùng còn nhìn bảng điều khiển
  }, [refresh]);
  // Vừa KÉO tiến độ máy khác về (bấm Đồng bộ / mở lại app) → đọc lại số đến hạn ngay,
  // không bắt người dùng thoát ra vào lại mới thấy hai máy khớp nhau.
  useEffect(() => onSyncMerged(() => void refresh()), [refresh]);
  // Đổi cài đặt trong ngăn Cài đặt (mở được cả giữa phiên) → nhãn nút, số từ mới còn lại và
  // phiên đang chạy (âm thanh, tự chuyển…) theo ngay.
  useEffect(() => onConfigChanged(() => void refresh()), [refresh]);

  // Ghép câu hỏi từ danh sách bản ghi ôn (đến hạn/ôn sớm/hay quên).
  // KHÔNG cần xáo trước: interleave() trong buildQuestions đã trộn toàn phiên
  // bằng khoá ngẫu nhiên riêng — xáo ở đây là tầng chết.
  const buildFromRecords = async (records: ReviewRecord[], title: string) => {
    if (!records.length) return;
    setBusy(true);
    setBuildError(null);
    try {
      const rows = records;
      const [c, known, lemmaMap, wordLevels] = await Promise.all([
        getConfig(),
        learnedIds(),
        loadLemmaMap(),
        loadWordLevels(),
      ]);
      const levels = [...new Set(rows.map((r) => r.level))];
      const wordMap = new Map<string, Word>();
      let examples: Record<string, ExampleSentence[]> = {};
      const pool: Word[] = [];
      for (const lv of levels) {
        // chỉ tải shard ví dụ chứa đúng các từ trong phiên (không nạp cả file cấp)
        const idsOfLevel = rows.filter((r) => r.level === lv).map((r) => r.wordId);
        const [ws, ex] = await Promise.all([loadWords(lv), loadExamplesForWords(lv, idsOfLevel)]);
        for (const w of ws) {
          wordMap.set(w.id, w);
          pool.push(w);
        }
        examples = { ...examples, ...ex };
      }
      const words = rows.map((r) => wordMap.get(r.wordId)).filter(Boolean) as Word[];
      const recMap = new Map(rows.map((r) => [r.wordId, r]));
      const qs = buildQuestions(words, examples, pool, c, false, recMap, known, { lemmaMap, wordLevels });
      // 0 câu (dữ liệu từ vựng tải hụt) → ReviewRunner render null = màn hình trắng kẹt.
      if (!qs.length) throw new Error("Không dựng được câu hỏi");
      setSession({ qs, title });
    } catch {
      setBuildError("Không tải được dữ liệu để bắt đầu phiên. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  };

  // Đến hạn: cắt theo "số thẻ mỗi phiên" (0 = tất cả) — thẻ còn lại ôn ở phiên sau.
  const startDue = async () => {
    const c = await getConfig();
    let rows = await getDueReviews();
    if (c.reviewPerSession > 0 && rows.length > c.reviewPerSession) {
      rows = rows.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()).slice(0, c.reviewPerSession);
    }
    return buildFromRecords(rows, "Ôn tập");
  };
  const startAhead = async () => buildFromRecords(await getAheadReviews(new Date(), 20), "Ôn sớm");
  const startHard = async () => buildFromRecords(await getHardReviews(20), "Ôn từ hay quên");

  if (session && cfg) {
    return (
      <ReviewRunner
        questions={session.qs}
        title={session.title}
        config={cfg}
        onExit={() => {
          setSession(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ôn tập hôm nay</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ôn thẻ đến hạn — hoặc ôn sớm, ôn từ hay quên, học thêm bất cứ lúc nào. Tất cả vẫn theo lịch FSRS.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Đến hạn" value={due} highlight />
          <Stat label="Hay quên" value={hard} />
          <Stat label="Đã học" value={learned} />
        </div>

        <button
          disabled={busy || (due === 0 && ahead === 0)}
          onClick={() => (due > 0 ? startDue() : startAhead())}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          <GraduationCap className="size-5" />
          {busy
            ? "Đang tải…"
            : due > 0
              ? `Ôn tập (${cfg && cfg.reviewPerSession > 0 ? Math.min(due, cfg.reviewPerSession) : due} thẻ)`
              : ahead > 0
                ? `Ôn sớm (${ahead} thẻ)`
                : "Chưa có thẻ để ôn"}
        </button>

        {buildError && (
          <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{buildError}</p>
        )}

        {due > 0 && ahead > 0 && (
          <button
            onClick={startAhead}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border bg-background py-3 text-sm font-semibold transition-all hover:bg-muted active:scale-[0.99] disabled:opacity-50"
          >
            <Zap className="size-4" /> Ôn sớm — xem trước ({ahead} thẻ)
          </button>
        )}

        {hard > 0 && (
          <button
            onClick={startHard}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-500/20 active:scale-[0.99] disabled:opacity-50 dark:text-amber-400"
          >
            <Brain className="size-4" /> Ôn từ hay quên ({Math.min(hard, 20)})
          </button>
        )}

        <Link
          href="/hoc"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border bg-background py-3 text-sm font-semibold transition-all hover:bg-muted active:scale-[0.99]"
        >
          <Plus className="size-4" />
          {remainNew > 0 ? `Học từ mới (${remainNew})` : "Học từ mới"}
        </Link>
      </div>

      {/* Ngữ pháp có lịch ôn riêng (không trộn vào hàng đợi thẻ từ) — nhắc ở đây khi có bài tới hạn */}
      <GrammarDueCard />

      {/* Nhiệm vụ ngày ngay dưới các nút ôn — vừa ôn xong quay ra là thấy thanh tiến độ nhích */}
      <DailyQuests />

      {/* Trạng thái đồng bộ ngay trong màn ôn tập (như HSK) — đang ôn vẫn thấy tiến độ đã lên
          cloud chưa, không phải mở menu tài khoản. */}
      <SyncRow />

      {/* Cài đặt — mở ngăn Cài đặt dùng chung (cùng ngăn với nút ⚙️ trên topbar): một chạm là thấy
          đủ mọi mục, kể cả sao lưu, không phải trỏ qua lại giữa hai trang như trước. */}
      <button
        type="button"
        onClick={openSettings}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-3 rounded-3xl border p-5 text-left transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-muted-foreground">⚙️ Cài đặt</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Từ mới mỗi ngày, dạng bài, âm thanh, sao lưu…
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-3xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
