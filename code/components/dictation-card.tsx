"use client";

// Nghe & GÕ CẢ CÂU (dictation) — luyện tự do, KHÔNG chấm FSRS (như mục Luyện tập của HSK,
// bản tiếng Anh thay luyện gõ pinyin). Nghe audio câu → gõ lại; chấm TỪNG TỪ, mỗi từ chịu
// lệch 1 ký tự (trượt phím điện thoại); câu đúng khi đủ từ và mọi từ khớp. Sau khi kiểm
// tra: hiện diff từng từ (xanh/đỏ) + câu chuẩn + nghĩa Việt.
import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { sentenceAudioUrl, playAudio as play, stopAudio } from "@/lib/tts";
import { editDistance } from "@/lib/spell";
import { cn } from "@/lib/utils";

// So sánh mức TỪ: thường hoá, nháy cong → thẳng, bỏ mọi ký tự ngoài chữ/số/nháy.
function normWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9']/g, "");
}

function words(s: string): string[] {
  return s.split(/\s+/).map(normWord).filter(Boolean);
}

/** true nếu hai từ coi như khớp (lệch tối đa 1 ký tự; từ ≤3 chữ phải đúng y hệt). */
function wordOk(typed: string | undefined, target: string): boolean {
  if (!typed) return false;
  if (typed === target) return true;
  if (target.length <= 3) return false;
  return editDistance(typed, target, 1) <= 1;
}

export default function DictationCard({
  en,
  vi,
  onNext,
}: {
  en: string;
  vi: string;
  onNext: (correct: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // vào thẻ: phát audio + focus ô gõ; rời thẻ: dừng audio
  useEffect(() => {
    play(sentenceAudioUrl(en));
    inputRef.current?.focus();
    return () => stopAudio();
  }, [en]);

  const target = useMemo(() => en.trim().split(/\s+/), [en]);
  // Chấm theo CON TRỎ trên dãy từ đã gõ: token đích normalize ra rỗng (thuần dấu câu,
  // vd "—") tính đúng luôn và KHÔNG ăn một từ đã gõ — so theo index thô thì một token
  // như vậy làm lệch toàn bộ verdict phía sau. Tính verdicts + correct trong MỘT memo
  // (tránh tách đôi rồi hai nửa trôi khác luật nhau).
  const grade = useMemo(() => {
    if (!submitted) return null;
    const typedWords = words(typed);
    let j = 0;
    const verdicts = target.map((w) => {
      const norm = normWord(w);
      if (!norm) return true;
      return wordOk(typedWords[j++], norm);
    });
    return { verdicts, correct: verdicts.every(Boolean) && j === typedWords.length };
  }, [submitted, typed, target]);
  const correct = grade?.correct ?? false;

  // sau khi kiểm tra, textarea đã unmount → Enter toàn cục để "Tiếp tục".
  // Guard: bỏ phím lặp (giữ Enter hơi lâu) + 300ms ân hạn sau khi kiểm tra — không thì
  // cú Enter lặp/đúp nhảy qua màn diff trước khi kịp nhìn (mất đúng thứ cần xem khi SAI).
  const submittedAt = useRef(0);
  useEffect(() => {
    if (!submitted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || performance.now() - submittedAt.current < 300) return;
      e.preventDefault();
      onNext(correct);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitted, correct, onNext]);

  const check = () => {
    if (!typed.trim() || submitted) return;
    submittedAt.current = performance.now();
    setSubmitted(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-3xl border bg-card p-6 text-center shadow-sm sm:min-h-[10rem]">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nghe rồi gõ lại cả câu</div>
        <button
          onClick={() => play(sentenceAudioUrl(en))}
          aria-label="Nghe câu"
          className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary transition-transform active:scale-95"
        >
          <Volume2 className="size-7" />
        </button>
        {/* gợi ý độ dài: số từ của câu — đỡ mò nhưng không lộ nội dung */}
        <div className="text-xs text-muted-foreground">{target.length} từ</div>
      </div>

      {submitted ? (
        <div className="space-y-3 rounded-3xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-lg font-medium">
            {target.map((w, i) => (
              <span key={i} className={grade?.verdicts[i] ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                {w}
              </span>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">{vi}</div>
          {!correct && typed.trim() && (
            <div className="rounded-xl bg-muted/50 p-2.5 text-sm text-muted-foreground">
              Bạn gõ: <span className="font-medium text-foreground">{typed}</span>
            </div>
          )}
          <button
            onClick={() => onNext(correct)}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
          >
            Tiếp tục <span className="hidden opacity-60 sm:inline">(Enter)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                check();
              }
            }}
            rows={2}
            placeholder="Gõ câu bạn nghe được…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full resize-none rounded-2xl border bg-background p-3.5 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <button
            onClick={check}
            disabled={!typed.trim()}
            className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-40"
          >
            Kiểm tra <span className="hidden opacity-60 sm:inline">(Enter)</span>
          </button>
        </div>
      )}
    </div>
  );
}
