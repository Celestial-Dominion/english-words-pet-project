"use client";

// Câu hỏi đọc hiểu trắc nghiệm cuối bài đọc / chương truyện (theo app HSK components/quiz.tsx). Chọn là chấm
// ngay (không đổi được): đáp án đúng tô xanh, chọn sai tô đỏ, rồi lộ nghĩa mọi phương án + lời giải thích trích
// «nguyên văn» câu trong bài. Phương án xáo lại mỗi lần mở / Làm lại. Không lưu điểm. Có autoMark (bài đọc / chương
// cuối truyện): trả lời xong câu cuối → onFinish(đạt?) để cha tự đánh dấu Đã đọc khi đạt (không bao giờ tự bỏ đánh
// dấu), khung tổng kết báo lại. Cha đặt key theo bài/chương để đổi bài là trạng thái mới. Chữ câu hỏi bấm-tra được.
import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { quizPassMin, quizPassed, quizScore, shuffledOrder, splitQuotes } from "@/lib/quiz-pure";
import type { QuizQuestion } from "@/lib/library";
import { cn } from "@/lib/utils";
import { Words } from "./passage-view";

const LETTERS = "ABCD";

function Why({ text }: { text: string }) {
  return (
    <>
      {splitQuotes(text).map((p, i) =>
        p.quote ? (
          <span key={i} className="text-foreground italic">
            «{p.text}»
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function Quiz({
  questions,
  showVi,
  onTapWord,
  autoMark,
  title = "Câu hỏi đọc hiểu",
}: {
  questions: QuizQuestion[];
  showVi: boolean;
  onTapWord: (w: string) => void;
  // done = trạng thái Đã đọc hiện tại (undefined = đang đọc IndexedDB)
  autoMark?: { unit: "bài" | "truyện"; done: boolean | undefined; onFinish: (passed: boolean) => void };
  title?: string;
}) {
  const [orders, setOrders] = useState(() => questions.map((q) => shuffledOrder(q.opts.length)));
  const [picks, setPicks] = useState<(number | undefined)[]>(() => questions.map(() => undefined));
  const answers = questions.map((q) => q.a);
  const { done, correct, total } = quizScore(answers, picks);
  const need = quizPassMin(total);
  const needText = need === total ? `đúng hết ${total} câu` : `đúng từ ${need}/${total} câu`;

  const choose = (i: number, oi: number) => {
    setPicks((p) => (p[i] !== undefined ? p : p.map((v, k) => (k === i ? oi : v))));
    if (picks[i] !== undefined || !autoMark) return;
    const s = quizScore(answers, picks.map((v, k) => (k === i ? oi : v)));
    if (s.done === s.total) autoMark.onFinish(quizPassed(s.correct, s.total)); // gọi ngay trong sự kiện, không qua effect
  };
  const redo = () => {
    setOrders(questions.map((q) => shuffledOrder(q.opts.length)));
    setPicks(questions.map(() => undefined));
  };

  return (
    <section aria-label={title} className="mt-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Chạm đáp án đúng · bật Dịch để xem tiếng Việt
        {autoMark && ` · ${needText} là tính Đã đọc`}
      </p>

      <ol className="mt-5 space-y-8">
        {questions.map((q, i) => {
          const pick = picks[i];
          const answered = pick !== undefined;
          const right = pick === q.a;
          return (
            <li key={i}>
              <p className="text-[1.06rem] leading-relaxed font-medium sm:text-[1.12rem]">
                <span className="mr-1.5 text-base font-semibold text-muted-foreground">{i + 1}.</span>
                <Words text={q.q.en} onTap={onTapWord} />
              </p>
              {(showVi || answered) && <p className="mt-1 border-l-[3px] border-primary/30 pl-3 text-[0.95rem] text-muted-foreground">{q.q.vi}</p>}
              <div className="mt-3 grid gap-2">
                {(orders[i] ?? []).map((oi, k) => {
                  const o = q.opts[oi];
                  if (!o) return null;
                  let cls = "border-border bg-card hover:bg-muted active:scale-[0.99]";
                  let badge = "bg-muted text-muted-foreground";
                  if (answered && oi === q.a) {
                    cls = "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
                    badge = "bg-emerald-500 text-white";
                  } else if (answered && oi === pick) {
                    cls = "border-destructive bg-destructive/15 text-destructive";
                    badge = "bg-destructive text-white";
                  } else if (answered) {
                    cls = "border-border bg-card opacity-60";
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={answered}
                      onClick={() => choose(i, oi)}
                      className={cn(
                        "flex min-h-[3.25rem] items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                        cls,
                      )}
                    >
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold", badge)}>{LETTERS[k] ?? k + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-[1.02rem] leading-snug">{o.en}</span>
                        {(showVi || answered) && <span className="mt-0.5 block text-sm opacity-75">{o.vi}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {answered && (
                <p className="mt-2.5 flex items-start gap-1.5 text-sm leading-relaxed">
                  {right ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <X className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  <span>
                    <span className={cn("font-semibold", right ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>{right ? "Đúng." : "Chưa đúng."}</span>
                    {q.why && (
                      <span className="text-muted-foreground">
                        {" "}
                        <Why text={q.why} />
                      </span>
                    )}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {total > 0 && done === total && (
        <div className="mt-7 flex flex-col items-center gap-2 rounded-2xl bg-muted/40 p-4 text-center">
          <p className="text-base font-semibold">
            Đúng {correct}/{total} câu
          </p>
          <p className="text-sm text-muted-foreground">{correct === total ? "Tuyệt vời — bạn hiểu hết bài!" : "Đọc lại đoạn liên quan rồi làm lại nhé."}</p>
          {autoMark?.done ? (
            <p className="text-sm font-medium text-balance text-emerald-700 dark:text-emerald-400">
              <Check className="mr-1 inline size-4 align-[-0.15em]" />
              Đã đánh dấu {autoMark.unit}: Đã đọc
            </p>
          ) : (
            autoMark &&
            !quizPassed(correct, total) && (
              <p className="text-sm font-medium text-balance text-amber-700 dark:text-amber-400">
                Cần {needText} để tính {autoMark.unit} Đã đọc
              </p>
            )
          )}
          <button
            type="button"
            onClick={redo}
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-4" /> Làm lại
          </button>
        </div>
      )}
    </section>
  );
}
