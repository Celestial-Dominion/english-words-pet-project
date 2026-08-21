"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Volume2, Plus, Check, ArrowLeft } from "lucide-react";
import { lookupWord, loadExamplesForWords, loadTopicIds, type ExampleSentence } from "@/lib/data";
import { posLabel } from "@/lib/pos";
import { wordAudioUrl, sentenceAudioUrl, playAudio as play } from "@/lib/tts";
import { getReview, recordAnswer, addXp, getMnemonic, setMnemonic, markKnown } from "@/lib/db";
import { occurrencesOf, type Occurrence } from "@/lib/suggest";
import { XP } from "@/lib/gamify";
import type { Word, ReviewRecord } from "@/lib/types";

type Status = "new" | "due" | "learned";
function statusOf(rec: ReviewRecord | null | undefined): Status | null {
  if (rec === undefined) return null; // đang tải
  if (!rec) return "new";
  if (new Date(rec.due).getTime() <= Date.now()) return "due";
  return "learned";
}
/** "ôn lại sau 3 ngày" — khoảng cách tới hạn ôn kế tiếp (như HSK). */
function intervalLabel(due: Date | string): string {
  const ms = new Date(due).getTime() - Date.now();
  if (ms <= 0) return "bây giờ";
  const h = Math.round(ms / 3_600_000);
  if (h < 48) return `${Math.max(1, h)} giờ`;
  return `${Math.round(h / 24)} ngày`;
}

// Nhãn tiếng Việt cho register (văn phong) — sống còn ở C1/C2.
const REGISTER_VI: Record<string, string> = {
  formal: "trang trọng",
  informal: "thân mật",
  academic: "học thuật",
  literary: "văn chương",
  slang: "tiếng lóng",
  dated: "cũ/ít dùng",
  vulgar: "thô tục",
  offensive: "miệt thị",
};

export default function WordDetail({
  word,
  examples,
  onClose,
  onChange,
}: {
  word: Word;
  examples: ExampleSentence[];
  onClose: () => void;
  onChange?: () => void;
}) {
  const [rec, setRec] = useState<ReviewRecord | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [isBusiness, setIsBusiness] = useState(false); // từ thuộc vốn từ công việc (BSL)
  // Mở rộng danh sách nghĩa EN — lưu theo id để chuyển sang từ khác là tự thu lại.
  const [showAllEnFor, setShowAllEnFor] = useState<string | null>(null);
  // Điều hướng họ từ NGAY trong modal: bấm "decision" khi đang xem "decide" → chồng thẻ mới,
  // giữ đường quay lại. `root` để tự huỷ chồng khi component được tái dùng cho từ khác.
  const [nav, setNav] = useState<{ root: string; stack: { word: Word; examples: ExampleSentence[] }[] }>({
    root: word.id,
    stack: [],
  });
  const stack = useMemo(() => (nav.root === word.id ? nav.stack : []), [nav, word.id]);
  const top = stack[stack.length - 1];
  const cur = top?.word ?? word;
  const curExamples = top?.examples ?? examples;

  useEffect(() => {
    getReview(cur.id).then((r) => setRec(r ?? null));
    getMnemonic(cur.id).then(setNote).catch(() => {});
    occurrencesOf(cur.id).then(setOcc).catch(() => {});
    loadTopicIds("business").then((set) => setIsBusiness(set.has(cur.id))).catch(() => {});
  }, [cur.id]);

  /** Mở một từ cùng họ (tra qua lemma-map nên chạy được cả với từ nền A1–A2). */
  const openFamily = async (id: string) => {
    const w = await lookupWord(id);
    if (!w) return;
    const ex = await loadExamplesForWords(w.level, [w.id]);
    setNav({ root: word.id, stack: [...stack, { word: w, examples: ex[w.id] ?? [] }] });
  };
  const goBack = () => setNav({ root: word.id, stack: stack.slice(0, -1) });

  // Esc: đang xem từ cùng họ thì lùi một bước, ở thẻ gốc thì đóng (như HSK)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack.length) setNav({ root: word.id, stack: stack.slice(0, -1) });
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stack, word.id, onClose]);

  const status = statusOf(rec);
  const learn = async () => {
    if (busy || rec) return;
    setBusy(true);
    await recordAnswer({ wordId: cur.id, level: cur.level, correct: true, isNew: true });
    await addXp(XP.newWord);
    const r = await getReview(cur.id);
    setRec(r ?? null);
    setBusy(false);
    onChange?.();
  };

  // khoá cuộn nền khi mở modal
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    /* Mobile: bottom-sheet · Desktop (sm+): ngăn kéo phải cao hết màn hình (như HSK) */
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm sm:flex-row" onClick={onClose}>
      <div
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-t bg-background pb-8 shadow-2xl duration-200 animate-in slide-in-from-bottom-4 sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0 sm:slide-in-from-right-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* thanh kéo + quay lại (khi đang lần theo họ từ) + đóng */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-4 pt-3 pb-2 backdrop-blur">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
          {stack.length > 0 && (
            <button
              onClick={goBack}
              className="absolute left-3 top-2 inline-flex h-9 items-center gap-1 rounded-full bg-muted px-3 text-sm font-medium text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              {stack.length > 1 ? stack[stack.length - 2].word.id : word.id}
            </button>
          )}
          <button onClick={onClose} aria-label="Đóng" className="absolute right-3 top-2 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5">
          {/* tiêu đề */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <span>{cur.id}</span>
                <button
                  onClick={() => play(wordAudioUrl(cur))}
                  aria-label="Phát âm"
                  className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary active:scale-95"
                >
                  <Volume2 className="size-5" />
                </button>
              </div>
              <div className="mt-1 font-mono text-muted-foreground">{cur.ipa}</div>
            </div>
          </div>

          {/* nghĩa */}
          <div className="mt-3 text-lg font-medium">{cur.meaning_vi}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {cur.pos.map(posLabel).join(", ")}
            {isBusiness ? (
              <>
                {" · "}
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                  💼 công việc
                </span>
              </>
            ) : null}
            {cur.register?.length ? (
              <>
                {" · "}
                {cur.register.map((r) => (
                  <span key={r} className="mr-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {REGISTER_VI[r] ?? r}
                  </span>
                ))}
              </>
            ) : null}
            {/* Nghĩa EN: chỉ 2 nghĩa đầu. Wiktionary trả cả nghĩa cực hiếm ("helicopter" =
                quả có cánh của cây phong) — đổ hết ra là nhiễu, người học tưởng đó là nghĩa chính. */}
            {cur.meaning_en.length
              ? ` · ${(showAllEnFor === cur.id ? cur.meaning_en : cur.meaning_en.slice(0, 2)).join(", ")}`
              : ""}
            {cur.meaning_en.length > 2 && showAllEnFor !== cur.id && (
              <button onClick={() => setShowAllEnFor(cur.id)} className="ml-1 whitespace-nowrap text-primary hover:underline">
                +{cur.meaning_en.length - 2} nghĩa nữa
              </button>
            )}
          </div>

          {/* trạng thái học + nút thêm vào ôn tập */}
          {status && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {status === "new" ? (
                <>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">Chưa học</span>
                  <button
                    onClick={learn}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Plus className="size-4" /> Học từ này
                  </button>
                  {/* Đã biết sẵn → tạo thẻ nhớ bền, khỏi học lại từ đầu (như HSK) */}
                  <button
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      await markKnown(cur.id, cur.level);
                      const r = await getReview(cur.id);
                      setRec(r ?? null);
                      setBusy(false);
                      onChange?.();
                    }}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50"
                  >
                    <Check className="size-4" /> Đã biết rồi
                  </button>
                </>
              ) : status === "due" ? (
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  Đến hạn ôn
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Đã học · ôn lại sau {rec ? intervalLabel(rec.due) : ""}
                </span>
              )}
            </div>
          )}

          {/* đặc thù tiếng Anh: động từ bất quy tắc / số nhiều bất quy tắc / biến thể Anh–Mỹ */}
          {(cur.irregular || cur.plural || cur.variants?.length) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cur.irregular && (
                <span className="rounded-lg bg-muted px-2.5 py-1 text-sm">
                  Bất quy tắc: <b>{cur.id} – {cur.irregular.past} – {cur.irregular.participle}</b>
                </span>
              )}
              {cur.plural && (
                <span className="rounded-lg bg-muted px-2.5 py-1 text-sm">
                  Số nhiều bất quy tắc: <b>{cur.plural}</b>
                </span>
              )}
              {cur.variants?.length ? (
                <span className="rounded-lg bg-muted px-2.5 py-1 text-sm">
                  Viết khác (Anh-Anh): <b>{cur.variants.join(", ")}</b>
                </span>
              ) : null}
            </div>
          )}

          {/* collocations: cụm hay đi kèm */}
          {cur.collocations?.length ? (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                🔗 Cụm hay đi kèm
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cur.collocations.map((c) => (
                  <span key={c} className="rounded-full bg-primary/10 px-2.5 py-1 text-sm text-primary">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* họ từ: decide → decision → decisive — kỹ năng word formation của FCE/CAE */}
          {cur.family?.length ? (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                🌱 Họ từ
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cur.family.map((id) => (
                  <button
                    key={id}
                    onClick={() => void openFamily(id)}
                    className="rounded-full border px-2.5 py-1 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98]"
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* mẹo nhớ tự ghi (tự nghĩ → nhớ lâu nhất) */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ✍️ Mẹo nhớ của bạn
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => void setMnemonic(cur.id, note)}
              rows={2}
              placeholder="Vd: liên tưởng hình ảnh, câu chuyện, hoặc âm gần giống…"
              className="w-full resize-none rounded-2xl border bg-background p-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <ExampleList examples={curExamples} />

          {/* Gặp lại trong ngữ cảnh: bài đọc/truyện chứa từ này (như HSK) */}
          {occ.length > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                📖 Gặp lại trong ngữ cảnh
              </div>
              <div className="space-y-1.5">
                {occ.map((o) => (
                  <a
                    key={`${o.type}-${o.id}`}
                    href={`/bai-doc?open=${encodeURIComponent(o.id)}`}
                    className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 truncate">
                      <b>{o.title_en}</b> <span className="text-muted-foreground">· {o.title_vi}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">bài đọc</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExampleList({ examples }: { examples: ExampleSentence[] }) {
  if (!examples.length) return <p className="mt-4 text-sm text-muted-foreground">Chưa có câu ví dụ.</p>;
  return (
    <div className="mt-4 space-y-2.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ví dụ ({examples.length})</div>
      {examples.map((s, i) => (
        <div key={i} className="rounded-2xl bg-muted/50 p-3">
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
  );
}
