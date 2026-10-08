"use client";

// SÀNG LỌC TỪ ĐÃ BIẾT theo cấp: lướt từng từ CHƯA học theo đúng thứ tự hàng đợi từ mới (từ phổ biến
// trước) — Biết / Chưa biết. Người học B1+ gặp rất nhiều từ đã biết ở đầu hàng đợi; học từng từ qua
// phiên (thẻ học + trắc nghiệm + điền + ghép, chiếm suất từ mới) là phí.
//
// Bấm "Biết" CHƯA ghi ngay: hiện NGHĨA của app trước để tự soát — từ B1–C2 hay đa nghĩa (found =
// thành lập, season = nêm gia vị), quen mặt chữ ≠ biết nghĩa app dạy. Xác nhận mới tạo thẻ đã-biết
// (db.markKnown: hẹn kiểm tra 30–90 ngày, chưa tính huy hiệu tới khi qua lần kiểm tra đó).
// "Chưa biết" không ghi gì — từ ở lại hàng đợi học. Con trỏ lưu theo máy (localStorage) để lần sau
// lướt tiếp chỗ cũ chứ không gặp lại những từ vừa bảo chưa biết.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Check, Volume2, X } from "lucide-react";
import { learnedIds, markKnown, undoMarkKnown } from "@/lib/db";
import { posLabel } from "@/lib/pos";
import { wordAudioUrl, playAudio as play, stopAudio } from "@/lib/tts";
import { levelMeta } from "@/lib/levels";
import { cn } from "@/lib/utils";
import type { Word } from "@/lib/types";

// Gợi ý dừng: trong 20 từ gần nhất biết dưới 30% → từ đây trở đi phần lớn là từ mới thật.
const WINDOW = 20;
const STOP_RATE = 0.3;

const cursorKey = (level: number) => `en.triage.${level}`;
function loadCursor(level: number): string | null {
  try {
    return localStorage.getItem(cursorKey(level));
  } catch {
    return null;
  }
}
function saveCursor(level: number, id: string | null): void {
  try {
    if (id) localStorage.setItem(cursorKey(level), id);
    else localStorage.removeItem(cursorKey(level));
  } catch {
    /* bỏ qua — chỉ là tiện ích theo máy */
  }
}

interface Decision {
  id: string;
  known: boolean;
}

export default function KnownTriage({
  level,
  words,
  sound,
  onExit,
  onLearn,
}: {
  level: number;
  words: Word[]; // cả danh sách của cấp, đúng thứ tự hàng đợi từ mới
  sound: boolean;
  onExit: () => void;
  onLearn: () => void;
}) {
  // Ảnh chụp lúc mở: từ đã có thẻ (đã học / đã biết) không vào danh sách lướt.
  const [learned, setLearned] = useState<Set<string> | null>(null);
  const [startAfter, setStartAfter] = useState<string | null>(() => loadCursor(level));
  useEffect(() => {
    learnedIds().then(setLearned, () => setLearned(new Set()));
  }, []);

  const queue = useMemo(() => {
    if (!learned) return null;
    const pos = startAfter ? words.findIndex((w) => w.id === startAfter) : -1;
    return words.slice(pos + 1).filter((w) => !learned.has(w.id));
  }, [learned, startAfter, words]);
  // Còn từ chưa học nằm TRƯỚC con trỏ (lượt trước bảo "chưa biết") → cho lướt lại từ đầu.
  const before = useMemo(() => {
    if (!learned || !startAfter) return 0;
    const pos = words.findIndex((w) => w.id === startAfter);
    return pos < 0 ? 0 : words.slice(0, pos + 1).filter((w) => !learned.has(w.id)).length;
  }, [learned, startAfter, words]);

  const [history, setHistory] = useState<Decision[]>([]);
  const [confirming, setConfirming] = useState(false); // đã bấm Biết, đang soát nghĩa
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stopDismissed, setStopDismissed] = useState(false);

  const idx = history.length;
  const w = queue && !finished ? queue[idx] : undefined;
  const knownCount = history.filter((d) => d.known).length;
  const recent = history.slice(-WINDOW);
  const recentRate = recent.length ? recent.filter((d) => d.known).length / recent.length : 1;
  const suggestStop = !stopDismissed && recent.length >= WINDOW && recentRate < STOP_RATE;

  // Chế độ tập trung như phiên học: ẩn bottom-nav + khoá cuộn nền (mobile).
  useEffect(() => {
    document.body.classList.add("studying", "studying-lock");
    return () => {
      document.body.classList.remove("studying", "studying-lock");
      stopAudio();
    };
  }, []);

  // Tự đọc từ khi hiện thẻ (cài đặt Âm thanh tắt thì thôi — nút loa vẫn bấm được).
  useEffect(() => {
    if (w && sound) play(wordAudioUrl(w));
  }, [w?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = useCallback(
    async (known: boolean) => {
      if (!w || busy) return;
      setBusy(true);
      try {
        if (known) await markKnown(w.id, w.level);
      } catch {
        setBusy(false);
        return; // ghi hỏng đã nổi banner (db) — giữ nguyên thẻ để thử lại
      }
      saveCursor(level, w.id);
      setHistory((h) => [...h, { id: w.id, known }]);
      setConfirming(false);
      setBusy(false);
    },
    [w, busy, level],
  );

  const undo = useCallback(async () => {
    if (busy) return;
    if (confirming) return setConfirming(false);
    const last = history[history.length - 1];
    if (!last) return;
    setBusy(true);
    try {
      if (last.known) await undoMarkKnown(last.id);
    } catch {
      setBusy(false);
      return;
    }
    const h = history.slice(0, -1);
    setHistory(h);
    saveCursor(level, h.length ? h[h.length - 1].id : startAfter);
    setFinished(false);
    setBusy(false);
  }, [busy, confirming, history, level, startAfter]);

  const restart = () => {
    saveCursor(level, null);
    setStartAfter(null);
    setHistory([]);
    setConfirming(false);
    setFinished(false);
    setStopDismissed(false);
    learnedIds().then(setLearned, () => {});
  };

  // ← Chưa biết · → / Enter Biết (Đúng) · Backspace Hoàn tác · Space nghe lại. Layout effect: gắn
  // lại phím NGAY khi thẻ mới hiện (trước khi vẽ) — effect thường chạy sau khi vẽ, gõ phím liền tay
  // lúc thẻ vừa hiện sẽ rơi vào handler của thẻ trước.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!w) return;
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (confirming) void decide(true);
        else setConfirming(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void decide(false);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        void undo();
      } else if (e.key === " ") {
        e.preventDefault();
        play(wordAudioUrl(w));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [w, confirming, decide, undo]);

  const cefr = levelMeta(level)?.cefr ?? "";
  const remaining = queue ? Math.max(0, queue.length - idx) : 0;
  const ended = !!queue && (finished || idx >= queue.length);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col bg-background sm:static sm:z-auto sm:block sm:bg-transparent"
      style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 sm:block sm:px-0">
        {/* tiến trình */}
        <div className="flex shrink-0 items-center justify-between gap-3 pb-3 pt-3 text-xs">
          <span className="text-muted-foreground">
            <b className="text-foreground">Sàng lọc · {cefr}</b> · đã lướt {idx} · biết {knownCount}
            {queue && !ended ? ` · còn ${remaining.toLocaleString("vi")}` : ""}
          </span>
          {!ended && (
            <button
              onClick={() => setFinished(true)}
              className="rounded-full px-2.5 py-1 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Xong
            </button>
          )}
        </div>

        {!queue ? (
          <p className="py-16 text-center text-muted-foreground">Đang tải…</p>
        ) : ended ? (
          <div className="my-auto space-y-4 rounded-3xl border bg-gradient-to-br from-sky-500/10 to-transparent p-6 text-center sm:my-0 sm:p-8">
            <div className="text-4xl">🧭</div>
            {idx > 0 ? (
              <p className="text-base">
                Đã lướt <b>{idx}</b> từ: <b>{knownCount}</b> từ đánh dấu đã biết (hẹn kiểm tra lại sau 1–3 tháng),{" "}
                <b>{idx - knownCount}</b> từ để lại hàng đợi học.
              </p>
            ) : (
              <p className="text-base">
                {queue.length === 0 && before === 0 ? "Không còn từ chưa học nào ở cấp này." : "Đã lướt hết danh sách từ chưa học."}
              </p>
            )}
            {before > 0 && idx >= queue.length && (
              <p className="text-sm text-muted-foreground">
                Còn {before.toLocaleString("vi")} từ chưa học ở các lượt lướt trước.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={onLearn}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] sm:w-auto sm:px-6"
              >
                Học từ mới
              </button>
              {before > 0 && idx >= queue.length && (
                <button
                  onClick={restart}
                  className="w-full rounded-2xl border py-3 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto sm:px-6"
                >
                  Lướt lại từ đầu
                </button>
              )}
              {finished && idx < queue.length && (
                <button
                  onClick={() => setFinished(false)}
                  className="w-full rounded-2xl border py-3 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto sm:px-6"
                >
                  Lướt tiếp
                </button>
              )}
              <button
                onClick={onExit}
                className="w-full rounded-2xl border py-3 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto sm:px-6"
              >
                Quay lại
              </button>
            </div>
          </div>
        ) : (
          w && (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2 sm:flex-none sm:overflow-visible">
                {suggestStop && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                    <p>
                      {WINDOW} từ gần nhất bạn chỉ biết {Math.round(recentRate * WINDOW)} — từ đây trở đi phần lớn là từ mới
                      với bạn. Chuyển sang học nhé?
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={onLearn}
                        className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                      >
                        Học từ mới
                      </button>
                      <button
                        onClick={() => setStopDismissed(true)}
                        className="rounded-xl border px-4 py-2 font-semibold transition-colors hover:bg-muted"
                      >
                        Lướt tiếp
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8">
                  <span className="text-xs font-medium text-muted-foreground">Bạn biết nghĩa từ này chưa?</span>
                  <div className="flex items-center gap-2">
                    <span className="text-4xl font-bold tracking-tight sm:text-5xl">{w.id}</span>
                    <button
                      onClick={() => play(wordAudioUrl(w))}
                      aria-label="Nghe"
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform active:scale-95"
                    >
                      <Volume2 className="size-5" />
                    </button>
                  </div>
                  <div className="font-mono text-base text-muted-foreground">{w.ipa}</div>
                  {w.pos.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1">
                      {w.pos.map((p) => (
                        <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {posLabel(p)}
                        </span>
                      ))}
                    </div>
                  )}
                  {confirming && (
                    <div className="w-full rounded-2xl bg-sky-500/10 p-4 text-left duration-150 animate-in fade-in">
                      <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        Nghĩa trong app — bạn biết nghĩa này chứ?
                      </div>
                      <div className="mt-1 text-lg font-medium">{w.meaning_vi}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 space-y-2 border-t bg-background/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:border-0 sm:bg-transparent sm:pb-0 sm:pt-4 sm:backdrop-blur-none">
                {/* Hai nút giữ NGUYÊN vị trí qua hai bước: biết chắc thì chạm phải hai lần là xong */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void decide(false)}
                    disabled={busy}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-2xl border py-3.5 font-semibold transition-all hover:bg-muted active:scale-[0.99] disabled:opacity-50",
                      confirming ? "text-sm sm:text-base" : "text-base", // nhãn dài: giữ một dòng ở khổ 375px
                    )}
                  >
                    <X className="size-4 shrink-0" /> {confirming ? "Chưa biết nghĩa" : "Chưa biết"}
                    <span className="hidden opacity-60 sm:inline">(←)</span>
                  </button>
                  <button
                    onClick={() => (confirming ? void decide(true) : setConfirming(true))}
                    disabled={busy}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-base font-semibold shadow-sm transition-all active:scale-[0.99] disabled:opacity-50",
                      confirming ? "bg-sky-600 text-white hover:bg-sky-600/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    <Check className="size-4" /> {confirming ? "Đúng, đã biết" : "Biết"}
                    <span className="hidden opacity-60 sm:inline">(→)</span>
                  </button>
                </div>
                {(history.length > 0 || confirming) && (
                  <button
                    onClick={() => void undo()}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    ↩︎ {confirming ? "Quay lại" : `Hoàn tác “${history[history.length - 1].id}”`}
                  </button>
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
