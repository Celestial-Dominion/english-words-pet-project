"use client";

// Luyện tập cuối bài Ngữ pháp: từng câu một (điền · gõ · chọn · câu tự nhiên · sửa lỗi · phân biệt · viết lại · sắp xếp ·
// nghe rồi chọn — đoạn nghe lấy ngay trong audio của bài, không tải file mới). Chấm lần trả lời đầu; ≥70% = đã học →
// lịch ôn riêng của Ngữ pháp. Mỗi câu trả lời tính vào thống kê ngày (chuỗi ngày, nhiệm vụ) như Luyện tập tự do.
import { useMemo, useState } from "react";
import { Check, Play, RotateCcw, X } from "lucide-react";
import { BLANK, EXERCISE_LABEL, PASS_SCORE, orderCorrect, typeCorrect, type Exercise, type GrammarLesson } from "@/lib/grammar";
import { recordGrammarAnswer, recordGrammarPractice } from "@/lib/grammar-progress";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
function shuffled<T>(arr: T[], seed: number): T[] {
  const r = rng(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return h;
};

// Câu có chỗ trống: ___ thành ô gạch dưới; đã chấm thì điền đáp án đúng vào ô.
function Stem({ text, fill }: { text: string; fill?: string }) {
  const parts = text.split(BLANK);
  return (
    <p className="text-xl leading-relaxed sm:text-2xl">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className={`mx-1 inline-block min-w-[3em] border-b-2 text-center ${fill ? "border-emerald-500 font-semibold text-emerald-700 dark:text-emerald-400" : "border-foreground/60"}`}>
              {fill ?? " "}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

export function Practice({ lesson, onListen, onDone }: { lesson: GrammarLesson; onListen: (beat: number) => void; onDone?: (score: number) => void }) {
  const [round, setRound] = useState(0);
  const [started, setStarted] = useState(false);
  const [qi, setQi] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const total = lesson.ex.length;
  const done = started && qi >= total;
  const score = total ? Math.round((results.filter(Boolean).length / total) * 100) : 0;

  const answer = (ok: boolean) => {
    setResults((r) => [...r, ok]);
    void recordGrammarAnswer(ok);
  };
  const next = () => {
    const n = qi + 1;
    setQi(n);
    if (n >= total) {
      const sc = Math.round((results.filter(Boolean).length / total) * 100);
      void recordGrammarPractice(lesson.id, sc).catch(() => {});
      onDone?.(sc);
    }
  };
  const restart = () => {
    setRound((r) => r + 1);
    setQi(0);
    setResults([]);
    setStarted(true);
  };

  if (!total) return null;
  return (
    <section className="space-y-3" id="luyen-tap">
      <h2 className="text-lg font-semibold">Luyện tập</h2>
      {!started ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-4 sm:p-5">
          <div>
            <div className="font-semibold">
              {total} câu · đạt từ {PASS_SCORE}% là tính đã học
            </div>
            <div className="text-sm text-muted-foreground">Điền từ, sửa lỗi, chọn câu tự nhiên, sắp xếp, nghe rồi chọn…</div>
          </div>
          <button type="button" onClick={() => setStarted(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-sm active:scale-95">
            Bắt đầu
          </button>
        </div>
      ) : done ? (
        <div className="space-y-3 rounded-3xl border bg-card p-5 text-center">
          <div className={`text-4xl font-bold tabular-nums ${score >= PASS_SCORE ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>{score}%</div>
          <div className="text-sm text-muted-foreground">
            {score >= PASS_SCORE ? "Đạt! Bài được đánh dấu đã học — app sẽ nhắc ôn lại theo lịch." : "Chưa đạt — xem lại phần Lỗi thường gặp trong video rồi làm lại nhé."}
          </div>
          <button type="button" onClick={restart} className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-muted">
            <RotateCcw className="size-4" /> Làm lại
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(qi / total) * 100}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {qi + 1}/{total}
            </span>
          </div>
          <Question key={`${round}-${qi}`} ex={lesson.ex[qi]} seed={hash(`${lesson.id}:${qi}:${round}`)} onListen={onListen} lesson={lesson} onAnswer={answer} onNext={next} />
        </div>
      )}
    </section>
  );
}

function Question({
  ex,
  seed,
  onListen,
  lesson,
  onAnswer,
  onNext,
}: {
  ex: Exercise;
  seed: number;
  onListen: (beat: number) => void;
  lesson: GrammarLesson;
  onAnswer: (ok: boolean) => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const opts = useMemo(() => ("o" in ex ? shuffled(ex.o.map((_, i) => i), seed) : []), [ex, seed]);
  const bank = useMemo(() => {
    if (ex.k !== "order") return [];
    let b = shuffled(ex.parts.map((_, i) => i), seed);
    if (b.every((x, i) => x === i)) b = [...b.slice(1), b[0]];
    return b;
  }, [ex, seed]);

  const finish = (ok: boolean) => {
    setChecked(ok);
    onAnswer(ok);
  };
  const choose = (i: number) => {
    if (checked !== null || !("a" in ex)) return;
    setPicked(i);
    finish(i === ex.a);
  };

  const label = EXERCISE_LABEL[ex.k];
  const fillText = checked !== null && "o" in ex && "a" in ex ? ex.o[ex.a] : undefined;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
      {ex.k === "listen" ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onListen(ex.beat)} className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow active:scale-95" aria-label="Nghe câu">
            <Play className="ml-0.5 size-5" fill="currentColor" />
          </button>
          <span className="text-sm text-muted-foreground">{ex.en ? "Nghe rồi chọn đúng câu bạn nghe được (bấm để nghe lại)" : "Nghe rồi chọn nghĩa đúng (bấm để nghe lại)"}</span>
        </div>
      ) : ex.k === "order" ? (
        <p className="text-base">
          Xếp thành câu: <span className="font-medium">{ex.vi}</span>
        </p>
      ) : ex.k === "type" ? (
        <Stem text={ex.stem} fill={checked !== null ? ex.ans[0] : undefined} />
      ) : (
        <>
          {ex.q && <p className="text-base font-medium">{ex.q}</p>}
          {ex.stem && ex.k === "fix" && (
            <p className="flex items-start gap-2 text-xl">
              <X className="mt-1 size-5 shrink-0 text-red-600" />
              <span className="g-strike">{ex.stem}</span>
            </p>
          )}
          {ex.stem && ex.k === "transform" && <p className="rounded-2xl bg-muted/60 px-3 py-2 text-xl">{ex.stem}</p>}
          {ex.stem && (ex.k === "fill" || ex.k === "contrast") && <Stem text={ex.stem} fill={fillText} />}
          {ex.k === "fix" && <p className="text-sm text-muted-foreground">Câu trên sai — chọn cách sửa đúng:</p>}
        </>
      )}

      {ex.k === "order" ? (
        <OrderBoard ex={ex} bank={bank} order={order} setOrder={setOrder} checked={checked} onCheck={() => finish(orderCorrect(ex, order))} />
      ) : ex.k === "type" ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (checked === null && typed.trim()) finish(typeCorrect(ex, typed));
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={checked !== null}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Gõ từ còn thiếu…"
            className={`min-w-0 flex-1 rounded-2xl border bg-background px-4 py-2.5 text-lg outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 ${checked === true ? "border-emerald-500" : checked === false ? "border-red-500" : ""}`}
          />
          {checked === null && (
            <button type="submit" disabled={!typed.trim()} className="inline-flex h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-40 active:scale-95">
              Kiểm tra
            </button>
          )}
        </form>
      ) : (
        <div className="grid gap-2">
          {opts.map((oi) => {
            const isRight = "a" in ex && oi === ex.a;
            const isPicked = picked === oi;
            const state = checked === null ? "" : isRight ? "border-emerald-500 bg-emerald-500/10" : isPicked ? "border-red-500 bg-red-500/10" : "opacity-60";
            return (
              <button
                key={oi}
                type="button"
                disabled={checked !== null}
                onClick={() => choose(oi)}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-[1.05rem] transition-colors ${checked === null ? "hover:border-primary/50 hover:bg-muted/50 active:scale-[0.99]" : ""} ${state}`}
              >
                <span>{"o" in ex ? ex.o[oi] : ""}</span>
                {checked !== null && isRight && <Check className="size-5 shrink-0 text-emerald-600" />}
                {checked !== null && isPicked && !isRight && <X className="size-5 shrink-0 text-red-600" />}
              </button>
            );
          })}
        </div>
      )}

      {checked !== null && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${checked ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-amber-500/10 text-amber-900 dark:text-amber-200"}`}>
          <div className="font-semibold">{checked ? "Chính xác!" : "Chưa đúng."}</div>
          {ex.k === "listen" && (() => {
            const b = lesson.beats[ex.beat];
            return b?.k === "e" ? <div className="mt-1 text-base">{b.en}</div> : null;
          })()}
          {ex.k === "order" && !checked && <div className="mt-1 text-base">{ex.parts.join(" ") + ex.end}</div>}
          {ex.k === "type" && !checked && <div className="mt-1 text-base">Đáp án: {ex.ans.join(" / ")}</div>}
          {ex.why && <div className="mt-1">{ex.why}</div>}
        </div>
      )}
      {checked !== null && (
        <div className="flex justify-end">
          <button type="button" onClick={onNext} className="inline-flex h-10 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground active:scale-95">
            Tiếp
          </button>
        </div>
      )}
    </div>
  );
}

function OrderBoard({
  ex,
  bank,
  order,
  setOrder,
  checked,
  onCheck,
}: {
  ex: Extract<Exercise, { k: "order" }>;
  bank: number[];
  order: number[];
  setOrder: (o: number[]) => void;
  checked: boolean | null;
  onCheck: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className={`flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-2 ${checked === true ? "border-emerald-500" : checked === false ? "border-red-500" : "border-border"}`}>
        {order.map((i, k) => (
          <button key={k} type="button" disabled={checked !== null} onClick={() => setOrder(order.filter((_, j) => j !== k))} className="rounded-xl bg-primary/10 px-3 py-1.5 text-lg active:scale-95">
            {ex.parts[i]}
          </button>
        ))}
        {order.length === ex.parts.length && <span className="text-lg">{ex.end}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {bank.map((i) => {
          const used = order.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={used || checked !== null}
              onClick={() => setOrder([...order, i])}
              className={`rounded-xl border px-3 py-1.5 text-lg transition-opacity active:scale-95 ${used ? "invisible" : "hover:bg-muted"}`}
            >
              {ex.parts[i]}
            </button>
          );
        })}
      </div>
      {checked === null && (
        <div className="flex justify-end">
          <button type="button" disabled={order.length !== ex.parts.length} onClick={onCheck} className="inline-flex h-10 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-40 active:scale-95">
            Kiểm tra
          </button>
        </div>
      )}
    </div>
  );
}
