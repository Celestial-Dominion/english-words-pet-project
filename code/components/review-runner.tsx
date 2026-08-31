"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Sparkles } from "lucide-react";
import { recordAnswer, undoAnswer, recordPractice, addXp, progressSummary, getMnemonic, setMnemonic, updateMaxCombo } from "@/lib/db";
import { XP, badgeGroups, rankForWords, type Stats, type Badge } from "@/lib/gamify";
import { ratingFromSpeed } from "@/lib/srs";
import { gradeSpelling, isSpellCorrect, type SpellVerdict } from "@/lib/spell";
import { wordAudioUrl, sentenceAudioUrl, playAudio as play, stopAudio } from "@/lib/tts";
import { suggestReading, type ReadingSuggestion } from "@/lib/suggest";
import { requestSync } from "@/lib/sync";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { reshuffleOptions, type Question } from "@/lib/review-session";
import { posLabel } from "@/lib/pos";
import type { SrsConfig, ReviewRecord } from "@/lib/types";
import SentenceArrange from "@/components/sentence-arrange";
import Celebration, { primeCelebrationAudio } from "@/components/celebration";
import SpellCard from "@/components/spell-card";

const REQUEUE_GAP = 3; // sai → gặp lại sau ~3 thẻ
const BREAK_EVERY = 22; // mời nghỉ sau mỗi chặng 22 thẻ
const REPEAT_WINDOW_MS = 15 * 60 * 1000; // thẻ đang học FSRS hẹn lại trong ≤15' → lặp ngay trong phiên (như HSK)
const AUTO_ADVANCE_MS = 1300; // đúng → tự sang thẻ kế sau 1,3s (có nút dừng lại xem kỹ)

// Nhãn loại câu hỏi hiện trên header (như HSK).
function typeLabel(q: Question): string {
  if (q.kind === "learn") return q.leech ? "🔁 Hay quên" : "✨ Từ mới";
  if (q.kind === "arrange") return "Ghép câu";
  if (q.kind === "spell") return "Gõ chính tả";
  if (q.mode === "reverse") return "Nghĩa → Anh";
  if (q.mode === "listen") return "Nghe → nghĩa";
  if (q.mode === "cloze") return "Điền vào câu";
  return "Anh → nghĩa";
}

function statsOf(s: Awaited<ReturnType<typeof progressSummary>>): Stats {
  return {
    words: s.words, xp: s.xp, streak: s.streak, reads: s.reads, reviews: s.reviews,
    correct: s.correct, activeDays: s.activeDays, matured: s.matured,
    maxDayReviews: s.maxDayReviews, weekend: s.weekend, byLevel: s.byLevel,
    redeemedLeeches: s.redeemedLeeches, maxCombo: s.maxCombo, longestStreak: s.longestStreak,
    comebackDays: s.comebackDays, perfectDay: s.perfectDay,
  };
}
const earnedIds = (s: Stats) => new Set(badgeGroups(s).flatMap((g) => g.badges).filter((b) => b.earned).map((b) => b.id));

interface UndoInfo {
  wordId: string;
  date: string; // ngày của lần chấm (undo trừ đúng ngày kể cả qua nửa đêm)
  prev: ReviewRecord | undefined;
  correct: boolean;
  isNew: boolean;
  xp: number;
  comboBefore: number;
  requeued: Question | null;
}

interface Summary {
  xpGained: number;
  perfect: boolean;
  maxCombo: number;
  reviewed: number; // số thẻ đã chấm
  again: number; // số thẻ "Lại"
  newBadges: Badge[];
  rankUp: { from: string; to: string } | null;
}

export default function ReviewRunner({
  questions,
  title,
  config,
  onExit,
}: {
  questions: Question[];
  title: string;
  config: SrsConfig;
  onExit: () => void;
}) {
  const [qs, setQs] = useState<Question[]>(questions);
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suggestion, setSuggestion] = useState<ReadingSuggestion | null>(null);
  const [autoAdv, setAutoAdv] = useState(false); // đang đếm 1,3s tự chuyển (có thể bấm dừng)
  const [mnemo, setMnemo] = useState(""); // mẹo nhớ trên learn-card từ hay quên
  const [showAllEx, setShowAllEx] = useState(false); // learn-card: xem thêm ví dụ
  const [spell, setSpell] = useState<{ typed: string; verdict: SpellVerdict } | null>(null); // kết quả bài gõ

  const q = qs[i];

  // Đơn vị "thẻ" = TỪ VỰNG: mỗi từ 1 thẻ (1 MCQ chấm FSRS). Câu "chọn giống" và
  // "sắp xếp câu" là BƯỚC PHỤ gắn vào thẻ của từ đó — không cộng vào tổng "X/Y"
  // (nếu không, đặt "10 thẻ" mà phiên lại chạy 13–20 câu, trông như cài đặt không ăn).
  const cardOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const x of questions)
      if (x.graded && !seen.has(x.word.id)) {
        seen.add(x.word.id);
        order.push(x.word.id);
      }
    return order;
  }, [questions]);
  const cardTotal = cardOrder.length;
  // Đang ở thẻ thứ mấy = SỐ TỪ có câu CHẤM ĐIỂM đã gặp tính tới câu hiện tại. Tính theo vị trí
  // trong cardOrder như trước thì thẻ bị chèn lại (requeue) mang số thứ tự BAN ĐẦU của nó →
  // header tụt lùi ("8/10" rồi nhảy về "2/10"). Đếm theo tập từ đã gặp thì số chỉ đi tới.
  // CHỈ đếm đợt graded: từ khi xen kẽ (interleave), thẻ học/ghép câu của một từ có thể xuất
  // hiện rất sớm — đếm cả chúng thì phiên học từ mới đạt "N/N" từ giữa chừng (thẻ học dồn
  // về đầu vì mang khoá nhỏ nhất nhóm) trong khi các câu MCQ vẫn còn phía trước.
  const cardNo = useMemo(() => {
    const inSession = new Set(cardOrder);
    const seen = new Set<string>();
    for (let k = 0; k <= i && k < qs.length; k++) {
      const x = qs[k];
      if (x?.graded && inSession.has(x.word.id)) seen.add(x.word.id);
    }
    return Math.min(Math.max(seen.size, 1), Math.max(cardTotal, 1));
  }, [qs, i, cardOrder, cardTotal]);
  const cardsDone = Math.max(0, cardNo - 1);
  const cardProgress = cardTotal ? Math.min(cardsDone / cardTotal, 1) : 0;
  // "làm lại" = số thẻ đã bị chèn lại trong phiên (MCQ vượt quá 1/từ), trừ đi khi hoàn tác.
  const redo = Math.max(0, qs.filter((x) => x.graded).length - cardTotal);

  // gamify trong phiên
  const xpRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const wrongRef = useRef(false);
  const wrongCountRef = useRef(0); // số thẻ chấm "Lại" (hiện ở tổng kết như HSK)
  const gradedRef = useRef(0);
  const sinceBreakRef = useRef(0);
  const shownAtRef = useRef(0);
  const beforeRef = useRef<{ ids: Set<string>; rankIndex: number; rankVi: string } | null>(null);
  const finalizedRef = useRef(false);

  useEffect(() => {
    progressSummary().then((s) => {
      const st = statsOf(s);
      beforeRef.current = { ids: earnedIds(st), rankIndex: rankForWords(st.words).index, rankVi: rankForWords(st.words).rank.vi };
    });
  }, []);

  // Thoát giữa phiên → hỏi xác nhận; chặn back/refresh + CLICK link điều hướng (topbar/nav)
  // khi đang trong phiên. (Topbar hiện trong phiên nên phải chặn cả link, không chỉ back.)
  const router = useRouter();
  const requestExit = useCallback(() => setConfirmExit(true), []);
  const activeRef = useRef(true);
  const suppressPopRef = useRef(false);
  const ownDummyRef = useRef(true); // còn sở hữu entry chặn back?
  const pendingHrefRef = useRef<string | null>(null); // link người dùng bấm giữa phiên
  useEffect(() => {
    activeRef.current = !done;
  }, [done]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onPop = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false; // popstate do chính mình back() lúc dọn dẹp → bỏ qua
        return;
      }
      if (!activeRef.current) {
        ownDummyRef.current = false; // entry vừa bị tiêu bởi lần Back này
        return;
      }
      window.history.pushState(null, ""); // giữ trang, hỏi xác nhận
      setConfirmExit(true);
    };
    // Chặn click vào link điều hướng nội bộ (logo, tab, nút Cài đặt trên topbar) → hỏi xác nhận.
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || a.target === "_blank" || a.hasAttribute("download")) return; // chỉ chặn điều hướng nội bộ
      if (!activeRef.current) return; // phiên đã xong → link đi bình thường
      e.preventDefault();
      e.stopPropagation();
      pendingHrefRef.current = href;
      setConfirmExit(true);
    };
    window.history.pushState(null, "");
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClickCapture, true);
      stopAudio(); // tắt audio còn dang dở khi rời phiên
      // Dọn entry chặn-Back CHỈ khi rời đi giữa phiên. Nếu phiên đã xong thì tuyệt đối không
      // back(): lúc này người dùng có thể vừa bấm link ở màn tổng kết ("Đọc một bài"), Next đã
      // push trang mới, back() sẽ đá ngược về trang cũ — nút trông như hỏng.
      if (ownDummyRef.current && activeRef.current) {
        suppressPopRef.current = true;
        window.history.back();
      }
    };
  }, []);

  // Xác nhận thoát: nếu do bấm link giữa phiên → điều hướng tới đúng nơi đó; nếu không → onExit.
  const doExit = useCallback(() => {
    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    activeRef.current = false;
    if (href) {
      ownDummyRef.current = false; // router.push tự thêm history — khỏi back() dọn dẹp
      router.push(href);
    } else {
      onExit();
    }
  }, [onExit, router]);
  const cancelExit = useCallback(() => {
    pendingHrefRef.current = null;
    setConfirmExit(false);
  }, []);

  // Nhớ-lại-trước (recall-first): ẩn phương án MCQ đến khi bấm hiện. Mốc tính tốc độ
  // trả lời bắt đầu từ lúc HIỆN đáp án (không phạt thời gian đang cố nhớ).
  const gate = config.recallFirst !== false;
  useEffect(() => {
    // Đồng bộ trạng thái hiển thị với MỐC THỜI GIAN trả lời (shownAtRef) — hai thứ phải đặt
    // cùng lúc, không thể derive vì mốc thời gian là side effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (q?.kind === "mcq") {
      setRevealed(!gate);
      if (!gate) shownAtRef.current = Date.now();
    } else {
      setRevealed(true);
      shownAtRef.current = Date.now();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [i, q?.kind, gate]);
  const reveal = () => {
    setRevealed(true);
    shownAtRef.current = Date.now();
  };

  // Tự phát âm khi hiện thẻ: learn + MCQ nghĩa/nghe (KHÔNG phát ở chế độ ngược/cloze — lộ đáp án).
  useEffect(() => {
    if (!q) return;
    if (q.kind === "learn" || q.kind === "spell" || (q.kind === "mcq" && (q.mode === "meaning" || q.mode === "listen"))) {
      play(wordAudioUrl(q.word));
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Learn-card từ hay quên: nạp mẹo nhớ đã ghi (lưu lại khi rời ô).
  useEffect(() => {
    // Nạp mẹo nhớ từ IndexedDB khi đổi thẻ (I/O ngoài React).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (q?.kind === "learn" && q.leech) getMnemonic(q.word.id).then(setMnemo);
    else setMnemo("");
    setShowAllEx(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalize = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const perfect = !wrongRef.current && gradedRef.current > 0;
    if (perfect) {
      xpRef.current += XP.perfectSession;
      await addXp(XP.perfectSession);
    }
    // ghi kỷ lục combo TRƯỚC khi chụp summary — huy hiệu "Loạt pháo" mới tính được ngay
    await updateMaxCombo(maxComboRef.current);
    const after = statsOf(await progressSummary());
    const before = beforeRef.current;
    const afterRank = rankForWords(after.words);
    const newBadges = before
      ? badgeGroups(after).flatMap((g) => g.badges).filter((b) => b.earned && !before.ids.has(b.id))
      : [];
    setSummary({
      xpGained: xpRef.current,
      perfect,
      maxCombo: maxComboRef.current,
      reviewed: gradedRef.current,
      again: wrongCountRef.current,
      newBadges,
      rankUp: before && afterRank.index > before.rankIndex ? { from: before.rankVi, to: afterRank.rank.vi } : null,
    });
    setDone(true);
    requestSync(); // đẩy kết quả phiên lên cloud ngay (không đợi lần mở app sau)
    // gợi ý bài đọc chứa nhiều từ vừa học/ôn nhất (chạy nền, có thì hiện)
    const ids = [...new Set(qs.filter((x) => x.graded).map((x) => x.word.id))];
    suggestReading(ids).then(setSuggestion).catch(() => {});
  }, [qs]);

  const next = () => {
    setAutoAdv(false);
    setChosen(null);
    setSpell(null);
    setUndoInfo(null);
    if (i + 1 >= qs.length) {
      void finalize();
      return;
    }
    sinceBreakRef.current += 1;
    if (sinceBreakRef.current >= BREAK_EVERY && qs.length - (i + 1) >= 4) {
      sinceBreakRef.current = 0;
      setOnBreak(true);
    }
    setI(i + 1);
  };

  // Đếm 1,3s tự sang thẻ kế khi trả lời đúng (bấm "Dừng lại xem kỹ" để huỷ).
  useEffect(() => {
    if (!autoAdv) return;
    const t = setTimeout(() => next(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [autoAdv, i]); // eslint-disable-line react-hooks/exhaustive-deps


  // chấm MCQ
  const answerChoice = async (idx: number) => {
    if (!q || q.kind !== "mcq" || chosen !== null) return;
    await submitAnswer(idx === q.answer, idx);
  };

  // chấm bài GÕ CHÍNH TẢ (dùng chung đường chấm với MCQ: FSRS, requeue, XP, hoàn tác).
  // `chosen` đóng vai cờ "đã trả lời" cho toàn bộ máy trạng thái nên vẫn phải đặt.
  const answerSpell = async (typed: string) => {
    if (!q || q.kind !== "spell" || chosen !== null) return;
    const v = gradeSpelling(typed, q.word.id);
    setSpell({ typed, verdict: v });
    await submitAnswer(isSpellCorrect(v), 0);
  };

  const submitAnswer = async (correct: boolean, idx: number) => {
    if (!q) return;
    primeCelebrationAudio(); // đang trong cử chỉ chạm → mồi quyền phát fanfare cho iOS
    setChosen(idx);
    const comboBefore = comboRef.current;
    if (correct) {
      setRight((r) => r + 1);
      comboRef.current += 1;
      if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
    } else {
      comboRef.current = 0;
      wrongRef.current = true;
      if (q.graded) wrongCountRef.current += 1;
    }

    if (q.graded) {
      gradedRef.current += 1;
      // trả lời xong → nghe lại (cloze đọc CẢ CÂU, còn lại đọc từ)
      if (q.kind === "mcq" && q.mode === "cloze" && q.clozeEn) play(sentenceAudioUrl(q.clozeEn));
      else play(wordAudioUrl(q.word));
      // Chèn lại thẻ để làm lại trong phiên (dùng chung cho cả hai nhánh sai/đúng-hẹn-lại).
      const alreadyQueued = qs.slice(i + 1).some((x) => x.graded && x.word.id === q.word.id);
      let requeued: Question | null = null;
      const insertRequeue = () => {
        requeued = reshuffleOptions({ ...q, isNew: false }); // xáo phương án — khỏi bấm theo trí nhớ vị trí
        setQs((prev2) => {
          const copy = [...prev2];
          copy.splice(Math.min(i + 1 + REQUEUE_GAP, copy.length), 0, requeued!);
          return copy;
        });
      };
      // SAI → chèn lại NGAY (đồng bộ, TRƯỚC khi ghi DB): ở thẻ CUỐI phiên, nếu đợi await xong
      // mới chèn thì nút thoáng hiện "Kết thúc", người dùng bấm nhanh là finalize cả phiên và
      // MẤT lượt làm lại. Chèn đồng bộ + gộp cùng setChosen → nút hiện "Tiếp tục" tức thì.
      if (!correct && !alreadyQueued) insertRequeue();

      const rating = ratingFromSpeed(
        correct,
        shownAtRef.current ? Date.now() - shownAtRef.current : 99_999,
        q.kind === "mcq" ? q.mode : q.kind === "spell" ? "spell" : undefined,
      );
      const xp = correct ? (q.isNew ? XP.newWord : XP.review) : 0;
      const { prev, next: nextRec, date } = await recordAnswer({ wordId: q.word.id, level: q.word.level, correct, isNew: q.isNew, rating });
      // ĐÚNG nhưng FSRS hẹn lại trong ≤15 phút (thẻ đang ở learning steps) → cũng chèn lại.
      // Cần `due` từ DB nên nằm SAU await; nhánh đúng tự chuyển sau 1,3s nên không dính race.
      if (correct && !alreadyQueued && new Date(nextRec.due).getTime() - Date.now() <= REPEAT_WINDOW_MS) insertRequeue();
      if (xp) void addXp(xp);
      xpRef.current += xp;
      setUndoInfo({ wordId: q.word.id, date, prev, correct, isNew: q.isNew, xp, comboBefore, requeued });
    } else {
      void recordPractice(correct);
      const xp = correct ? XP.practice : 0;
      if (xp) void addXp(xp);
      xpRef.current += xp;
    }
    if (correct && config.autoAdvance) setAutoAdv(true);
  };

  // Hoàn tác lần chấm vừa rồi (lỡ bấm nhầm) → khôi phục FSRS + làm lại câu này.
  const doUndo = async () => {
    const u = undoInfo;
    if (!u) return;
    setAutoAdv(false);
    // Ghi DB TRƯỚC, dọn UI SAU: xoá undoInfo trước rồi mới await thì lúc ghi hỏng
    // (riêng tư/quota/tab cũ) nút Hoàn tác đã biến mất — thất bại im lặng, không thử
    // lại được. Lỗi đã nổi banner qua db (noteDbError); ở đây chỉ cần giữ nguyên nút.
    try {
      await undoAnswer({ wordId: u.wordId, prev: u.prev, correct: u.correct, isNew: u.isNew, date: u.date });
    } catch {
      return; // undoInfo còn nguyên → bấm lại được
    }
    setUndoInfo(null);
    if (u.xp) {
      await addXp(-u.xp);
      xpRef.current -= u.xp;
    }
    if (u.correct) setRight((r) => Math.max(0, r - 1));
    else wrongCountRef.current = Math.max(0, wrongCountRef.current - 1);
    comboRef.current = u.comboBefore;
    gradedRef.current = Math.max(0, gradedRef.current - 1);
    if (u.requeued) setQs((prev) => prev.filter((x) => x !== u.requeued));
    setChosen(null);
    setSpell(null);
    setRevealed(true);
    shownAtRef.current = Date.now();
  };

  // Phím tắt (như HSK): Enter/Space = tiếp tục / hiện đáp án / nghỉ xong; 1-4 = chọn phương án.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || confirmExit) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const cur = qs[i];
      if (!cur) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onBreak) return setOnBreak(false);
        if (cur.kind === "learn") {
          if (cur.leech) void setMnemonic(cur.word.id, mnemo);
          return next();
        }
        if (cur.kind === "mcq" && !revealed && chosen === null) return reveal();
        if (cur.kind === "spell" && chosen === null) return;
        if (chosen !== null) return next();
        return;
      }
      if (onBreak || cur.kind === "arrange" || cur.kind === "learn" || cur.kind === "spell") return;
      const n = Number(e.key);
      if (n >= 1 && n <= cur.options.length && chosen === null && revealed) void answerChoice(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    // Màn tổng kết đứng RIÊNG trong luồng trang (không còn khung phiên) — như HSK.
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 py-4">
          {/* pháo hoa + fanfare — chỉ khi phiên có chấm điểm thật (không nổ cho phiên trống) */}
          {summary && summary.reviewed > 0 && <Celebration perfect={summary.perfect} />}
          <div className="flex flex-col items-center gap-3 rounded-3xl border bg-gradient-to-br from-primary/10 to-transparent p-8 text-center sm:p-10">
            <div className="text-2xl font-bold">✅ Xong phiên ôn!</div>
            <div className="text-muted-foreground">
              Đã ôn {summary?.reviewed ?? 0} thẻ · {summary?.again ?? 0} thẻ “Lại”.
            </div>
            {summary && summary.xpGained > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-2 text-lg font-bold text-amber-600 dark:text-amber-400">
                <Sparkles className="size-5" /> +{summary.xpGained} điểm
              </div>
            )}
            {summary?.rankUp && (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
                🎉 Thăng cấp! <span className="text-muted-foreground">{summary.rankUp.from}</span> →{" "}
                <b>{summary.rankUp.to}</b>
              </div>
            )}
            {summary && summary.newBadges.length > 0 && (
              <div className="w-full">
                <div className="mb-2 text-sm font-semibold">Mở {summary.newBadges.length} huy hiệu mới</div>
                <div className="flex flex-wrap justify-center gap-3">
                  {summary.newBadges.slice(0, 12).map((b) => (
                    <div key={b.id} className="flex w-20 flex-col items-center gap-1">
                      <span className="grid size-11 place-items-center rounded-full bg-amber-500/15 text-xl">{b.icon}</span>
                      <span className="text-[11px] leading-tight text-muted-foreground">{b.name}</span>
                    </div>
                  ))}
                </div>
                {summary.newBadges.length > 12 && (
                  <div className="mt-2 text-xs text-muted-foreground">…và {summary.newBadges.length - 12} huy hiệu khác</div>
                )}
              </div>
            )}
            <button
              onClick={onExit}
              className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] sm:w-auto sm:px-10"
            >
              Quay lại
            </button>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/hoc"
                className="w-full rounded-2xl border py-3 text-center text-sm font-semibold transition-colors hover:bg-muted sm:w-auto sm:px-6"
              >
                Học từ mới →
              </Link>
              {!suggestion && (
                <Link
                  href="/bai-doc"
                  className="w-full rounded-2xl border py-3 text-center text-sm font-semibold transition-colors hover:bg-muted sm:w-auto sm:px-6"
                >
                  📖 Đọc một bài
                </Link>
              )}
            </div>
          </div>
          {suggestion && (
            <a
              href={`/bai-doc?open=${encodeURIComponent(suggestion.id)}`}
              className="block rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
            >
              <div className="text-sm font-semibold text-primary">📖 Đọc ngay để nhớ lâu</div>
              <div className="mt-1 text-sm leading-relaxed">
                <b>{suggestion.count} từ</b> vừa học có trong {suggestion.type === "reading" ? "bài đọc" : "truyện"}{" "}
                <span className="font-semibold">“{suggestion.title_en}”</span>{" "}
                <span className="text-muted-foreground">· {suggestion.title_vi}</span>
              </div>
            </a>
          )}
      </div>
    );
  }

  // Không còn câu nào (dữ liệu hụt / phiên rỗng): trước đây return null = MÀN HÌNH TRẮNG, mà
  // effect chặn Back đã pushState nên bấm Back cũng không ra được, phải tải lại trang.
  if (!q) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-muted-foreground">Không có câu hỏi nào cho phiên này.</p>
        <button
          onClick={onExit}
          className="mt-4 rounded-2xl border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Quay lại
        </button>
      </div>
    );
  }

  // Modal xác nhận rời phiên (dùng chung cho màn nghỉ + màn chính) — giống HSK.
  const exitModal = confirmExit && (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4 duration-150 animate-in fade-in">
      <button type="button" aria-label="Ở lại" onClick={cancelExit} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-3xl border bg-background p-6 shadow-2xl duration-200 animate-in zoom-in-95">
        <h2 className="text-xl font-bold">Thoát phiên ôn?</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Bạn đang trong phiên học/ôn. Thoát bây giờ sẽ kết thúc phiên này. (Các câu đã trả lời vẫn được lưu.)
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            onClick={doExit}
            className="w-full rounded-2xl border py-3 text-base font-semibold text-muted-foreground transition-colors hover:bg-muted active:scale-[0.99] sm:flex-1"
          >
            Thoát
          </button>
          <button
            onClick={cancelExit}
            autoFocus
            className="w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] sm:flex-1"
          >
            Tiếp tục ôn
          </button>
        </div>
      </div>
    </div>
  );

  // ---- Màn nghỉ giữa chặng ----
  if (onBreak) {
    return (
      <>
        <SessionShell onExit={requestExit} progress={cardProgress} count={`${cardNo}/${cardTotal}`}>
          <div className="my-auto w-full space-y-5 rounded-3xl border bg-gradient-to-br from-primary/10 to-transparent p-8 text-center sm:p-10">
            <div className="text-5xl">☕</div>
            <p className="text-xl font-bold">Nghỉ một chút nhé</p>
            <p className="text-sm text-muted-foreground">
              Đã làm <b className="text-foreground">{cardsDone}</b> thẻ · còn{" "}
              <b className="text-foreground">{Math.max(0, cardTotal - cardsDone)}</b> thẻ.
              Nghỉ mắt vài giây rồi tiếp tục.
            </p>
            <button
              onClick={() => setOnBreak(false)}
              className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] sm:w-auto sm:px-8"
            >
              Ôn tiếp <span className="hidden opacity-60 sm:inline">(Enter)</span>
            </button>
            <button onClick={requestExit} className="block w-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:w-auto sm:px-8">
              Để sau
            </button>
          </div>
        </SessionShell>
        {exitModal}
      </>
    );
  }

  return (
    <>
    <SessionShell
      onExit={requestExit}
      progress={cardProgress}
      count={`${cardNo}/${cardTotal}`}
      pill={q.kind === "learn" ? undefined : typeLabel(q)}
      pillPrimary={q.kind === "arrange"}
      isNew={(q.kind === "learn" && !q.leech) || (q.graded && q.isNew)}
      extra={redo > 0 ? `+${redo} làm lại` : undefined}
    >
      {q.kind === "learn" ? (
        /* Thẻ HỌC: từ mới xem trước khi bị hỏi; từ HAY QUÊN (leech) ôn lại kỹ + ghi mẹo nhớ */
        <div className="flex min-h-0 flex-1 flex-col sm:flex-none">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2 sm:flex-none sm:overflow-visible">
            <div className="flex flex-col items-center gap-3 rounded-3xl border bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-6 text-center shadow-sm sm:p-8">
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", q.leech ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-primary/15 text-primary")}>
                {q.leech ? "🔁 Hay quên — ôn lại kỹ" : "✨ Từ mới — học trước nhé"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold tracking-tight sm:text-5xl">{q.word.id}</span>
                <button
                  onClick={() => play(wordAudioUrl(q.word))}
                  aria-label="Nghe"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform active:scale-95"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <div className="font-mono text-base text-muted-foreground">{q.word.ipa}</div>
              {q.word.pos.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
                  {q.word.pos.map((p) => (
                    <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {posLabel(p)}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xl font-medium">{q.word.meaning_vi}</div>
            </div>
            {q.examples && q.examples.length > 0 && (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ví dụ</div>
                <div className="space-y-3">
                  {(showAllEx ? q.examples : q.examples.slice(0, 2)).map((s) => (
                    <div key={s.en}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-base font-medium">{s.en}</div>
                        <button
                          onClick={() => play(sentenceAudioUrl(s.en))}
                          aria-label="Nghe câu"
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary active:scale-95"
                        >
                          <Volume2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{s.vi}</div>
                    </div>
                  ))}
                </div>
                {q.examples.length > 2 && (
                  <button
                    onClick={() => setShowAllEx((v) => !v)}
                    className="mt-2 text-sm font-medium text-primary hover:underline"
                  >
                    {showAllEx ? "Thu gọn" : `Xem thêm ${q.examples.length - 2} ví dụ`}
                  </button>
                )}
              </div>
            )}
            {q.leech && (
              <div className="rounded-2xl bg-muted/50 p-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">✍️ Mẹo nhớ của bạn</div>
                <textarea
                  value={mnemo}
                  onChange={(e) => setMnemo(e.target.value)}
                  onBlur={() => void setMnemonic(q.word.id, mnemo)}
                  rows={2}
                  placeholder="Ghi cách bạn nhớ từ này (hình ảnh, liên tưởng, câu vè…)"
                  className="w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
                />
              </div>
            )}
          </div>
          <div className="shrink-0 border-t bg-background/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:border-0 sm:bg-transparent sm:pb-0 sm:pt-4 sm:backdrop-blur-none">
            <button
              onClick={() => {
                if (q.leech) void setMnemonic(q.word.id, mnemo);
                next();
              }}
              className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              {q.leech ? "Đã ôn — Kiểm tra" : "Đã xem — Kiểm tra"} <span className="hidden opacity-60 sm:inline">(Enter)</span>
            </button>
          </div>
        </div>
      ) : q.kind === "arrange" ? (
        <SentenceArrange
          key={i}
          en={q.en}
          vi={q.vi}
          tokens={q.tokens}
          showVi={config.sentenceVi}
          onNext={(correct) => {
            if (correct) {
              setRight((r) => r + 1);
              comboRef.current += 1;
              if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
              xpRef.current += XP.practice;
              void addXp(XP.practice);
            } else {
              comboRef.current = 0;
              wrongRef.current = true;
            }
            void recordPractice(correct);
            next();
          }}
        />
      ) : q.kind === "spell" ? (
        <div className="flex min-h-0 flex-1 flex-col sm:flex-none">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 sm:flex-none sm:overflow-visible">
            <SpellCard
              key={i}
              word={q.word}
              vi={q.vi}
              examples={q.exs}
              verdict={spell?.verdict ?? null}
              typed={spell?.typed ?? ""}
              onSubmit={(v) => void answerSpell(v)}
              onReplay={() => play(wordAudioUrl(q.word))}
            />
          </div>
          {chosen !== null && (
            <div className="shrink-0 space-y-2 border-t bg-background/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:border-0 sm:bg-transparent sm:pb-0 sm:pt-4 sm:backdrop-blur-none">
              <button
                onClick={next}
                className="relative w-full overflow-hidden rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                {autoAdv && (
                  <span className="absolute inset-y-0 left-0 bg-white/25" style={{ animation: `aaFill ${AUTO_ADVANCE_MS}ms linear forwards` }} />
                )}
                <span className="relative">
                  {i + 1 >= qs.length ? "Kết thúc" : "Tiếp tục"} <span className="hidden opacity-60 sm:inline">(Enter)</span>
                </span>
              </button>
              {undoInfo && !autoAdv && (
                <button
                  onClick={() => void doUndo()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  ↩︎ Hoàn tác — lỡ bấm nhầm
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col sm:flex-none">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2 sm:flex-none sm:overflow-visible">
            {/* đề bài — chạm vào thẻ cũng hiện đáp án khi đang "nhớ lại trước" (như HSK) */}
            <div
              onClick={() => {
                if (q.kind === "mcq" && !revealed && chosen === null) reveal();
              }}
              className="flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-6 text-center shadow-sm sm:min-h-[11rem] sm:p-8"
            >
              {q.mode === "listen" ? (
                <>
                  <button
                    onClick={() => play(wordAudioUrl(q.word))}
                    aria-label="Nghe lại"
                    className="flex size-24 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform active:scale-95"
                  >
                    <Volume2 className="size-10" />
                  </button>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chạm để nghe lại</div>
                </>
              ) : q.mode === "cloze" ? (
                <>
                  <div className="text-xl leading-relaxed sm:text-2xl">
                    {q.clozeBefore}
                    <span className="mx-1 inline-flex min-w-[3ch] justify-center rounded-lg border-2 border-dashed border-primary/60 px-2 align-middle font-bold text-primary">
                      ?
                    </span>
                    {q.clozeAfter}
                  </div>
                  {/* nghĩa câu: mặc định giấu lúc đang làm (bản dịch mớm đáp án); trả lời xong mới hiện */}
                  {q.clozeVi && (config.sentenceVi || chosen !== null) && (
                    <div className="text-sm text-muted-foreground">{q.clozeVi}</div>
                  )}
                  {chosen === null && (
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Điền từ còn thiếu</div>
                  )}
                </>
              ) : q.mode === "reverse" ? (
                <>
                  <div className="text-2xl font-semibold sm:text-3xl">{q.prompt}</div>
                  {chosen === null && (
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chọn từ tiếng Anh đúng</div>
                  )}
                </>
              ) : (
                /* meaning: chỉ hiện TỪ (IPA + nghĩa đầy đủ lộ ở thẻ chi tiết sau khi trả lời — như HSK) */
                <>
                  <div className="text-4xl font-bold tracking-tight sm:text-5xl">{q.prompt}</div>
                  {chosen === null && (
                    <div className={cn("text-xs font-medium tracking-wide", revealed ? "uppercase text-muted-foreground" : "text-primary/70")}>
                      {revealed ? "Chọn nghĩa đúng" : "Chạm để hiện đáp án"}
                    </div>
                  )}
                </>
              )}
              {/* đã trả lời → badge Đúng/Sai nằm CUỐI thẻ, thay dòng hướng dẫn (như HSK) */}
              {chosen !== null && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                    chosen === q.answer
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                  )}
                >
                  {chosen === q.answer ? "✓ Đúng" : "✗ Sai"}
                </div>
              )}
            </div>

            {/* nhớ-lại-trước: ẩn phương án đến khi bấm hiện */}
            {q.kind === "mcq" && !revealed && chosen === null ? (
              <button
                onClick={reveal}
                className="w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-base font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.99]"
              >
                🧠 Thử nhớ trong đầu… <span className="opacity-70">bấm để hiện đáp án</span>
                <span className="hidden opacity-60 sm:inline"> (Space)</span>
              </button>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {q.options.map((opt, idx) => {
                  const isAnswer = idx === q.answer;
                  const isChosen = idx === chosen;
                  const show = chosen !== null;
                  return (
                    <button
                      key={idx}
                      onClick={() => void answerChoice(idx)}
                      disabled={show}
                      className={cn(
                        "flex min-h-[3.75rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-base transition-all",
                        !show && "bg-card hover:bg-muted active:scale-[0.99]",
                        show && isAnswer && "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        show && isChosen && !isAnswer && "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300",
                        show && !isAnswer && !isChosen && "opacity-50",
                      )}
                    >
                      {/* ô số 1-4 — khớp phím tắt (như HSK) */}
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                          show && isAnswer
                            ? "bg-emerald-500 text-white"
                            : show && isChosen
                              ? "bg-rose-500 text-white"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* thẻ chi tiết SAU khi trả lời (như HSK): căn giữa, nổi; ẩn từ khi đề bài đã là từ */}
            {chosen !== null && q.kind === "mcq" && (
              <div className="space-y-2 rounded-3xl border bg-card p-4 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2">
                  {q.mode !== "meaning" && (
                    <span className="text-xl font-bold">{q.word.id}</span>
                  )}
                  <span className="font-mono text-sm text-muted-foreground">{q.word.ipa}</span>
                  <button
                    onClick={() => play(wordAudioUrl(q.word))}
                    aria-label="Nghe"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary active:scale-95"
                  >
                    <Volume2 className="size-4" />
                  </button>
                </div>
                {q.word.pos.length > 0 && (
                  <div className="text-xs italic text-muted-foreground">{q.word.pos.map(posLabel).join(" · ")}</div>
                )}
                <div className="text-sm leading-relaxed">{q.word.meaning_vi}</div>
                {q.exs?.map((s) => (
                  <div key={s.en} className="flex items-start justify-between gap-2 border-t pt-2 text-left text-sm">
                    <div>
                      <div className="font-medium">{s.en}</div>
                      <div className="text-muted-foreground">{s.vi}</div>
                    </div>
                    <button
                      onClick={() => play(sentenceAudioUrl(s.en))}
                      aria-label="Nghe câu"
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary active:scale-95"
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* nút tiếp (kèm thanh đếm 1,3s khi tự chuyển) + dừng lại xem kỹ / hoàn tác */}
          {chosen !== null && (
            <div className="shrink-0 space-y-2 border-t bg-background/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:border-0 sm:bg-transparent sm:pb-0 sm:pt-4 sm:backdrop-blur-none">
              <button
                onClick={next}
                className="relative w-full overflow-hidden rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                {autoAdv && (
                  <span
                    className="absolute inset-y-0 left-0 bg-white/25"
                    style={{ animation: `aaFill ${AUTO_ADVANCE_MS}ms linear forwards` }}
                  />
                )}
                <span className="relative">
                  {qs[i + 1]?.kind === "arrange" && qs[i + 1]?.word.id === q.word.id
                    ? "Ghép câu"
                    : i + 1 >= qs.length
                      ? "Kết thúc"
                      : "Tiếp tục"}{" "}
                  <span className="hidden opacity-60 sm:inline">(Enter)</span>
                </span>
              </button>
              {autoAdv ? (
                <button
                  onClick={() => setAutoAdv(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  ⏸ Dừng lại xem kỹ
                </button>
              ) : (
                undoInfo && (
                  <button
                    onClick={() => void doUndo()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    ↩︎ Hoàn tác — lỡ bấm nhầm
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </SessionShell>
    {exitModal}
    </>
  );
}

/**
 * Khung phiên học/ôn — bố cục như HSK:
 *  - Mobile: khung CỐ ĐỊNH dưới topbar (topbar vẫn hiện), bottom-nav ẩn qua body.studying,
 *    nội dung cuộn nội bộ, CTA ghim đáy.
 *  - Desktop (sm+): luồng thường — nội dung giãn tự nhiên, cuộn bằng trang.
 *  - Hàng tiến trình: đếm thẻ + "+N làm lại" + pill "từ mới"/loại câu · nút "Thoát" chữ.
 */
function SessionShell({
  onExit,
  progress,
  count,
  pill,
  pillPrimary,
  isNew,
  extra,
  children,
}: {
  onExit: () => void;
  progress: number;
  count?: string; // "3/20" — vị trí thẻ hiện tại / tổng ban đầu
  pill?: string; // nhãn loại câu hỏi ("Anh → nghĩa", "Điền vào câu"…)
  pillPrimary?: boolean; // pill tô màu primary (Ghép câu, Hay quên)
  isNew?: boolean; // thẻ từ mới → pill "từ mới"
  extra?: string;
  children: React.ReactNode;
}) {
  // Chế độ tập trung: ẩn bottom-nav + khoá cuộn nền (mobile) khi đang trong phiên.
  useEffect(() => {
    document.body.classList.add("studying", "studying-lock");
    return () => document.body.classList.remove("studying", "studying-lock");
  }, []);
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col bg-background sm:static sm:z-auto sm:block sm:bg-transparent"
      style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 sm:block sm:px-0">
        {/* tiến trình */}
        <div className="shrink-0 space-y-2 pb-3 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              {count && <span className="font-semibold">{count}</span>}
              {extra && <span className="text-muted-foreground">{extra}</span>}
              {isNew && <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">từ mới</span>}
              {pill && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    pillPrimary ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {pill}
                </span>
              )}
            </span>
            <button
              onClick={onExit}
              className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Thoát
            </button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
