"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { lookupWord, loadExamplesForWords, type ReadingDoc, type ExampleSentence } from "@/lib/data";
import { markRead, isRead } from "@/lib/db";
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
  const [showVi, setShowVi] = useState(true);
  // Gắn cờ "đã đọc" kèm id bài để đổi bài là tự về false, không cần setState trong effect.
  const [readOf, setReadOf] = useState<{ id: string; read: boolean }>({ id: doc.id, read: false });
  const read = readOf.id === doc.id && readOf.read;
  const setRead = (v: boolean) => setReadOf({ id: doc.id, read: v });
  const endRef = useRef<HTMLDivElement>(null);
  const { activeIdx, playing, toggle, rate, cycleRate } = useListenAll(doc.sentences);

  // Đọc trạng thái đã có (đừng đánh dấu ngay lúc MỞ bài: chạm nhầm vào bài cũng bị tính vào
  // thống kê + gợi ý bài đọc dù chưa đọc chữ nào).
  useEffect(() => {
    isRead(doc.id).then((r) => setReadOf({ id: doc.id, read: r }));
  }, [doc.id]);

  // Đánh dấu khi người đọc thật sự tới CUỐI bài (cuộn xuống hết) — mốc đủ tin cậy mà không
  // bắt phải bấm nút. Bấm nút vẫn bật/tắt được thủ công.
  useEffect(() => {
    const el = endRef.current;
    if (!el || read) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
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
    const w = await lookupWord(token);
    if (!w) return;
    const ex = await loadExamplesForWords(w.level, [w.id]);
    setExamples(ex[w.id] || []);
    setSelected(w);
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="Quay lại" className="grid size-9 shrink-0 place-items-center rounded-full bg-muted transition-colors hover:bg-muted/70">
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{doc.title_en}</h1>
          <div className="truncate text-sm text-muted-foreground">{doc.title_vi}</div>
          {/* Phần lớn tin Wikinews đã hơn 10 năm — không hiện ngày thì người học tưởng tin mới.
              Để RIÊNG một dòng: nhét chung dòng tiêu đề dịch thì bị `truncate` cắt mất. */}
          {doc.date && (
            <div className="text-xs text-muted-foreground">Tin gốc đăng ngày {formatDate(doc.date)}</div>
          )}
        </div>
      </div>

      <ReaderToolbar
        playing={playing}
        onToggle={toggle}
        rate={rate}
        onCycleRate={cycleRate}
        showVi={showVi}
        onToggleVi={() => setShowVi((v) => !v)}
      />

      <Passage sentences={doc.sentences} showVi={showVi} activeIdx={activeIdx} onTapWord={onTapWord} speakers={doc.speakers} />

      {/* Ghi công nguồn mở — CC BY-SA/CC BY 2.5 bắt buộc dẫn nguồn ở nơi hiển thị nội dung.
          Hội thoại do dự án tự viết nên không có khối này. */}
      {doc.url && (
        <p className="mt-6 text-xs text-muted-foreground">
          Nguồn:{" "}
          <a href={doc.url} target="_blank" rel="noreferrer" className="underline">
            {doc.src === "wikinews" ? "Wikinews" : "Simple English Wikipedia"}
          </a>{" "}
          — {doc.src === "wikinews" ? "CC BY 2.5" : "CC BY-SA"}
          {" · "}
          {/* CC BY-SA/CC BY buộc ghi rõ bản dẫn xuất ĐÃ SỬA so với bản gốc. */}
          <span title="Văn bản gốc được rút gọn/lọc câu theo cấp độ từ vựng khi xây dựng app.">
            đã rút gọn
          </span>
          {" · "}
          {/* Nói thẳng chỗ nào không nên tin bản dịch: bài nguồn mở dịch MÁY (quyết định E5),
              còn hội thoại + câu ví dụ + nghĩa từ đều dịch tay. */}
          <span title="Tiếng Anh là bản gốc; hãy đọc tiếng Anh trước, bản dịch chỉ để đối chiếu.">
            bản dịch tiếng Việt do máy dịch
          </span>
        </p>
      )}
      {doc.speakers && (
        <p className="mt-6 text-xs text-muted-foreground">Hội thoại luyện tập do dự án biên soạn.</p>
      )}

      {/* Mốc "đã đọc tới cuối" — xem effect IntersectionObserver ở trên */}
      <div ref={endRef} aria-hidden />

      {/* Đánh dấu đã đọc — bật/tắt được (như HSK) */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => void toggleRead()}
          className={
            read
              ? "inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:text-emerald-300"
              : "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          }
        >
          <Check className="size-4" />
          {read ? "Đã đọc — chạm để bỏ đánh dấu" : "Đánh dấu đã đọc"}
        </button>
      </div>

      {selected && <WordDetail word={selected} examples={examples} onClose={() => setSelected(null)} />}
    </div>
  );
}
