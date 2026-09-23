"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpenText, Check, MessagesSquare } from "lucide-react";
import { lookupWord, loadExamplesForWords, type ReadingDoc, type ExampleSentence } from "@/lib/data";
import { markRead, isRead } from "@/lib/db";
import { levelMeta } from "@/lib/levels";
import type { Word } from "@/lib/types";
import WordDetail from "@/components/word-detail";
import { Passage, ReaderToolbar, useListenAll } from "@/components/passage";

/** "2008-12-07" → "7/12/2008"; chuỗi lạ thì trả nguyên văn. */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : iso;
}

export default function Reader({ doc, onBack }: { doc: ReadingDoc; onBack: () => void }) {
  const [selected, setSelected] = useState<Word | null>(null);
  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  // Giống HSK: ưu tiên đọc liền mạch; người học chủ động bật bản dịch khi cần đối chiếu.
  const [showVi, setShowVi] = useState(false);
  // Gắn cờ "đã đọc" kèm id bài để đổi bài là tự về false, không cần setState trong effect.
  const [readOf, setReadOf] = useState<{ id: string; read: boolean }>({ id: doc.id, read: false });
  const read = readOf.id === doc.id && readOf.read;
  const setRead = (value: boolean) => setReadOf({ id: doc.id, read: value });
  const endRef = useRef<HTMLDivElement>(null);
  const { activeIdx, playing, toggle, rate, cycleRate } = useListenAll(doc.sentences);
  const level = levelMeta(doc.level);
  const isDialogue = !!doc.speakers?.length;

  // Danh sách có thể rất dài; khi thay cả cây DOM bằng Reader, trình duyệt đôi lúc giữ
  // scrollTop cũ sau callback mở bài. Cuộn trong layout effect để tiêu đề không bị che.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [doc.id]);

  // Đọc trạng thái đã có (đừng đánh dấu ngay lúc MỞ bài: chạm nhầm vào bài cũng bị tính vào
  // thống kê + gợi ý bài đọc dù chưa đọc chữ nào).
  useEffect(() => {
    isRead(doc.id).then((value) => setReadOf({ id: doc.id, read: value }));
  }, [doc.id]);

  // Đánh dấu khi người đọc thật sự tới CUỐI bài (cuộn xuống hết) — mốc đủ tin cậy mà không
  // bắt phải bấm nút. Bấm nút trên toolbar vẫn bật/tắt được thủ công.
  useEffect(() => {
    const el = endRef.current;
    if (!el || read) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        void markRead(doc.id).then(() => setRead(true));
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc.id, read]);

  const toggleRead = async () => {
    await markRead(doc.id, !read);
    setRead(!read);
  };

  const onTapWord = async (token: string) => {
    const word = await lookupWord(token);
    if (!word) return;
    const loaded = await loadExamplesForWords(word.level, [word.id]);
    setExamples(loaded[word.id] || []);
    setSelected(word);
  };

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <header className="mb-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại"
          className="mb-4 text-sm font-medium text-primary transition-colors hover:underline"
        >
          ← Danh sách bài đọc
        </button>

        <div className="flex items-start gap-3">
          <span className="mt-1 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            {isDialogue ? <MessagesSquare className="size-5" /> : <BookOpenText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{doc.title_en}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{doc.title_vi}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">{level?.cefr ?? `Cấp ${doc.level}`}</span>
              <span>{isDialogue ? "Hội thoại" : doc.src === "wikinews" ? "Tin tức" : "Bài đọc"}</span>
              <span aria-hidden>·</span>
              <span>{doc.sentences.length} câu</span>
              {doc.date && (
                <>
                  <span aria-hidden>·</span>
                  <span>{doc.src === "wikinews" ? "Tin gốc đăng ngày" : "Đăng ngày"} {formatDate(doc.date)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <ReaderToolbar
        playing={playing}
        onToggle={toggle}
        rate={rate}
        onCycleRate={cycleRate}
        showVi={showVi}
        onToggleVi={() => setShowVi((value) => !value)}
      >
        <button
          type="button"
          onClick={() => void toggleRead()}
          aria-pressed={read}
          aria-label={read ? "Đã đọc — bấm để bỏ đánh dấu" : "Đánh dấu đã đọc"}
          title={read ? "Đã đọc (bấm để bỏ)" : "Đánh dấu đã đọc"}
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all ${
            read
              ? "bg-emerald-500 text-white shadow-sm"
              : "border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          <Check className="size-4.5" strokeWidth={read ? 3 : 2} />
        </button>
      </ReaderToolbar>

      <article className="rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
        <p className="mb-5 border-b pb-4 text-xs leading-relaxed text-muted-foreground">
          Chạm vào bất kỳ từ tiếng Anh nào để xem nghĩa, phát âm và ví dụ.
        </p>

        <Passage
          sentences={doc.sentences}
          showVi={showVi}
          activeIdx={activeIdx}
          onTapWord={onTapWord}
          speakers={doc.speakers}
        />

        {/* Mốc "đã đọc tới cuối" — xem effect IntersectionObserver ở trên. */}
        <div ref={endRef} data-testid="reading-end" aria-hidden className="h-px" />

        {/* Ghi công nguồn mở — CC BY-SA/CC BY 2.5 bắt buộc dẫn nguồn ở nơi hiển thị nội dung.
            Hội thoại do dự án tự viết nên không có khối này. */}
        <footer className="mt-8 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          {doc.url ? (
            <p>
              Nguồn: {" "}
              <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                {doc.src === "wikinews" ? "Wikinews" : "Simple English Wikipedia"}
              </a>{" "}
              — {doc.src === "wikinews" ? "CC BY 2.5" : "CC BY-SA"}
              {" · "}
              <span title="Văn bản gốc được rút gọn/lọc câu theo cấp độ từ vựng khi xây dựng app.">đã rút gọn</span>
              {" · "}
              <span title="Tiếng Anh là bản gốc; hãy đọc tiếng Anh trước, bản dịch chỉ để đối chiếu.">
                bản dịch tiếng Việt do máy dịch
              </span>
            </p>
          ) : (
            <p>Hội thoại luyện tập do dự án biên soạn.</p>
          )}
        </footer>
      </article>

      {selected && <WordDetail word={selected} examples={examples} onClose={() => setSelected(null)} />}
    </div>
  );
}
