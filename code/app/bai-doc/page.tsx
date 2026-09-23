"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BookOpenText,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Code2,
  Library,
  MessagesSquare,
} from "lucide-react";
import { loadReadingsIndex, loadReadings, type ReadingMeta, type ReadingDoc } from "@/lib/data";
import { readIds } from "@/lib/db";
import { LEVELS, levelAccent } from "@/lib/levels";
import Reader from "@/components/reader";

type ReadingKind = "all" | "business" | "it" | "dialogue";
type KindIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

const KINDS: { id: ReadingKind; label: string; description: string; Icon: KindIcon }[] = [
  {
    id: "all",
    label: "Tất cả",
    description: "Bách khoa, tin tức, công việc và hội thoại.",
    Icon: Library,
  },
  {
    id: "business",
    label: "Công việc",
    description: "Tin tức và tình huống dùng tiếng Anh nơi làm việc.",
    Icon: BriefcaseBusiness,
  },
  {
    id: "it",
    label: "CNTT",
    description: "Bài đọc và hội thoại dành cho ngành công nghệ.",
    Icon: Code2,
  },
  {
    id: "dialogue",
    label: "Hội thoại",
    description: "Đoạn nói ngắn theo lượt để luyện phản xạ giao tiếp.",
    Icon: MessagesSquare,
  },
];

const PAGE_SIZE = 60;
const number = new Intl.NumberFormat("vi-VN");

function matchesKind(reading: ReadingMeta, kind: ReadingKind): boolean {
  if (kind === "all") return true;
  if (kind === "dialogue") return !!reading.dialogue;
  if (kind === "it") return reading.topic === "it";
  return reading.topic === "business" && !reading.dialogue;
}

export default function BaiDocPage() {
  const [index, setIndex] = useState<ReadingMeta[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<ReadingDoc | null>(null);
  const [kind, setKind] = useState<ReadingKind>("all");
  // Giống HSK: vào hub chọn cấp trước, rồi mới xem danh sách riêng của cấp đó.
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  // Không render một lúc hàng trăm bài ở C1/C2. Key giúp reset phân trang khi đổi loại/cấp
  // mà không cần setState trong effect.
  const [page, setPage] = useState({ key: "", count: PAGE_SIZE });

  const refresh = () => readIds().then(setRead);
  useEffect(() => {
    let alive = true;
    loadReadingsIndex()
      .then((idx) => {
        if (!alive) return;
        setIndex(idx);
        // deep-link ?open=<id> (từ gợi ý "Đọc ngay để nhớ lâu" sau phiên học)
        const id = new URLSearchParams(window.location.search).get("open");
        const meta = id ? idx.find((r) => r.id === id) : null;
        if (meta) {
          loadReadings(meta.level).then((docs) => {
            if (!alive) return;
            const doc = docs.find((d) => d.id === meta.id);
            if (doc) setActive(doc);
          });
        }
      })
      .catch(() => alive && setLoadError(true));
    refresh();
    return () => {
      alive = false;
    };
  }, []);

  const open = async (meta: ReadingMeta) => {
    const docs = await loadReadings(meta.level);
    const doc = docs.find((d) => d.id === meta.id);
    if (!doc) return;
    setActive(doc);
    // Chờ DOM danh sách được thay bằng Reader rồi mới cuộn; cuộn trước commit khiến
    // trình duyệt khôi phục vị trí cũ và che mất nút "Danh sách" dưới topbar.
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  };

  const shown = useMemo(() => (index ?? []).filter((reading) => matchesKind(reading, kind)), [index, kind]);
  const selectedKind = KINDS.find((item) => item.id === kind) ?? KINDS[0];
  const totalRead = shown.filter((reading) => read.has(reading.id)).length;
  const list = selectedLevel === null ? [] : shown.filter((reading) => reading.level === selectedLevel);
  const listRead = list.filter((reading) => read.has(reading.id)).length;
  const nextUnread = list.find((reading) => !read.has(reading.id));
  const listKey = `${kind}:${selectedLevel ?? "hub"}`;
  const visibleCount = page.key === listKey ? page.count : PAGE_SIZE;
  const visibleList = list.slice(0, visibleCount);

  const selectKind = (next: ReadingKind) => {
    setKind(next);
    setSelectedLevel(null);
  };
  const selectLevel = (level: number) => {
    setSelectedLevel(level);
    requestAnimationFrame(() => document.getElementById("reading-catalog")?.scrollIntoView({ behavior: "smooth" }));
  };

  if (active) {
    return (
      <Reader
        doc={active}
        onBack={() => {
          setActive(null);
          refresh();
          requestAnimationFrame(() => window.scrollTo({ top: 0 }));
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
          <BookOpenText className="size-4" />
          Thư viện luyện đọc
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Bài đọc</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Chọn loại nội dung và cấp độ. Trong bài, chạm một từ để tra nghĩa hoặc nghe toàn bài theo từng câu.
        </p>
      </header>

      {/* Loại nội dung: một segmented control gọn, thay cho hàng chip emoji rời rạc. */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/70 p-1.5 sm:grid-cols-4">
        {KINDS.map(({ id, label, Icon }) => {
          const selected = kind === id;
          const count = (index ?? []).filter((reading) => matchesKind(reading, id)).length;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => selectKind(id)}
              className={`flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-left transition-all active:scale-[0.98] ${
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/55 hover:text-foreground"
              }`}
            >
              <Icon className={`size-4 shrink-0 ${selected ? "text-primary" : ""}`} strokeWidth={selected ? 2.4 : 2} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{label}</span>
                <span className="block text-[0.68rem] tabular-nums opacity-70">{index ? number.format(count) : "—"} bài</span>
              </span>
            </button>
          );
        })}
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm text-destructive">
          Không tải được thư viện bài đọc. Kiểm tra kết nối rồi tải lại trang.
        </div>
      ) : index === null ? (
        <CatalogSkeleton />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
          Chưa có bài đọc cho loại nội dung này.
        </div>
      ) : (
        <section id="reading-catalog" className="scroll-mt-24 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-xl font-bold">{selectedKind.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{selectedKind.description}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              Đã đọc <span className="font-semibold tabular-nums text-foreground">{totalRead}/{shown.length} bài</span>
            </div>
          </div>

          {selectedLevel === null ? (
            <LevelGrid readings={shown} read={read} onSelect={selectLevel} />
          ) : (
            <LevelReadingList
              level={selectedLevel}
              readings={list}
              visibleReadings={visibleList}
              read={read}
              readCount={listRead}
              nextUnread={nextUnread}
              onBack={() => setSelectedLevel(null)}
              onOpen={(reading) => void open(reading)}
              onMore={() => setPage({ key: listKey, count: visibleCount + PAGE_SIZE })}
            />
          )}
        </section>
      )}
    </div>
  );
}

function LevelGrid({
  readings,
  read,
  onSelect,
}: {
  readings: ReadingMeta[];
  read: Set<string>;
  onSelect: (level: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {LEVELS.map((level) => {
        const accent = levelAccent(level.level);
        const list = readings.filter((reading) => reading.level === level.level);
        const done = list.filter((reading) => read.has(reading.id)).length;
        const pct = list.length ? (done / list.length) * 100 : 0;
        return (
          <button
            key={level.level}
            type="button"
            disabled={list.length === 0}
            aria-label={`${level.label}, ${list.length} bài, đã đọc ${done}`}
            onClick={() => onSelect(level.level)}
            className={`group overflow-hidden rounded-2xl border bg-gradient-to-br ${accent.grad} p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex size-11 items-center justify-center rounded-xl text-base font-bold ${accent.badge}`}>
                {level.cefr}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{level.label.split(" · ")[1] ?? level.label}</span>
                <span className="block text-sm text-muted-foreground">{number.format(list.length)} bài đọc</span>
              </span>
              {done === list.length && list.length > 0 ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${accent.badge}`}>✓ Xong</span>
              ) : (
                <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all duration-500 ${accent.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{done}/{list.length}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LevelReadingList({
  level,
  readings,
  visibleReadings,
  read,
  readCount,
  nextUnread,
  onBack,
  onOpen,
  onMore,
}: {
  level: number;
  readings: ReadingMeta[];
  visibleReadings: ReadingMeta[];
  read: Set<string>;
  readCount: number;
  nextUnread?: ReadingMeta;
  onBack: () => void;
  onOpen: (reading: ReadingMeta) => void;
  onMore: () => void;
}) {
  const meta = LEVELS.find((item) => item.level === level);
  const accent = levelAccent(level);
  const pct = readings.length ? (readCount / readings.length) * 100 : 0;

  return (
    <div className="space-y-5 duration-300 animate-in fade-in slide-in-from-bottom-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${accent.badge}`}>
            {meta?.cefr ?? level}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-bold sm:text-2xl">{meta?.label ?? `Cấp ${level}`}</h3>
            <p className="text-sm text-muted-foreground">
              Đã đọc <span className="font-semibold text-foreground">{readCount}/{readings.length}</span> bài
            </p>
          </div>
        </div>
        <button type="button" onClick={onBack} className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← Cấp khác
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-500 ${accent.bar}`} style={{ width: `${pct}%` }} />
      </div>

      {nextUnread && (
        <button
          type="button"
          aria-label={readCount > 0 ? "Đọc tiếp bài chưa hoàn thành" : "Bắt đầu bài đọc đầu tiên"}
          onClick={() => onOpen(nextUnread)}
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-primary/35 bg-primary/5 px-4 py-3 text-left transition-all hover:bg-primary/10 active:scale-[0.99]"
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-primary">
              {readCount > 0 ? "Đọc tiếp" : "Bắt đầu đọc"}
            </span>
            <span className="mt-0.5 block truncate font-semibold">{nextUnread.title_en}</span>
            <span className="block truncate text-xs text-muted-foreground">{nextUnread.title_vi}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-primary" />
        </button>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleReadings.map((reading, idx) => {
          const done = read.has(reading.id);
          return (
            <button
              key={reading.id}
              type="button"
              onClick={() => onOpen(reading)}
              aria-label={`${reading.title_en} — ${reading.title_vi}, ${reading.n} câu${done ? ", đã đọc" : ""}`}
              className="group flex min-h-[4.25rem] items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md active:scale-[0.99]"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                  done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{reading.title_en}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {reading.title_vi} · {reading.n} câu
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {visibleReadings.length < readings.length && (
        <button
          type="button"
          onClick={onMore}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          Hiện thêm {Math.min(PAGE_SIZE, readings.length - visibleReadings.length)} bài
          <span className="font-normal opacity-70">· đang hiện {visibleReadings.length}/{readings.length}</span>
        </button>
      )}
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Đang tải bài đọc">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl border bg-muted/45" />
      ))}
    </div>
  );
}
