"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Minus, Plus, Upload } from "lucide-react";
import { exportData, importData, getConfig, setConfig, type BackupData } from "@/lib/db";
import { onSyncMerged, requestSync } from "@/lib/sync";
import { LEVELS } from "@/lib/levels";
import type { SrsConfig } from "@/lib/types";
import SyncRow from "@/components/sync-row";
import { useDarkMode, setDarkMode } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * TOÀN BỘ cài đặt ở một chỗ — dùng cho ngăn Cài đặt (nút ⚙️ trên topbar, nút Cài đặt ở tab Ôn tập)
 * và trang /cai-dat. Trước đây cài đặt học nằm trong mục gập cuối tab Ôn tập còn sao lưu nằm ở
 * trang riêng, hai nơi trỏ chéo nhau → phải qua 3–4 bước mới chỉnh được một công tắc.
 */
export default function SettingsPanel() {
  const [cfg, setCfg] = useState<SrsConfig | null>(null);

  useEffect(() => {
    const load = async () => setCfg(await getConfig());
    void load();
    // kéo cài đặt từ máy khác về → công tắc nhảy theo ngay
    return onSyncMerged(() => void load());
  }, []);

  const patch = async (p: Partial<SrsConfig>) => setCfg(await setConfig(p));

  // chờ đọc xong cấu hình (vài ms) rồi hiện cả ngăn một lượt — không để các mục nhảy chỗ
  if (!cfg) return null;

  return (
    <div className="space-y-6">
      <Group title="Học & ôn">
        <Row label="Từ mới mỗi ngày" as="div">
          <Stepper
            label="Từ mới mỗi ngày"
            value={cfg.newPerDay}
            min={0}
            max={200}
            onChange={(n) => void patch({ newPerDay: n })}
          />
        </Row>
        <Row label="Nguồn từ mới" hint={cfg.newLevel === 0 ? "lấy từ cấp thấp nhất còn từ chưa học" : undefined}>
          <select
            value={cfg.newLevel}
            onChange={(e) => void patch({ newLevel: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={0}>Tự động</option>
            {LEVELS.map((l) => (
              <option key={l.level} value={l.level}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Thẻ ôn mỗi phiên" hint="giới hạn thẻ đến hạn mỗi phiên cho đỡ nản; thẻ còn lại để dành phiên sau">
          <select
            value={cfg.reviewPerSession}
            onChange={(e) => void patch({ reviewPerSession: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={0}>Tất cả</option>
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} thẻ
              </option>
            ))}
          </select>
        </Row>
        <Row label="Hướng hỏi" as="div" stack>
          <Segmented
            label="Hướng hỏi"
            value={cfg.direction}
            options={[
              ["en2vi", "Anh→nghĩa"],
              ["vi2en", "Nghĩa→Anh"],
            ]}
            onChange={(v) => void patch({ direction: v })}
          />
        </Row>
      </Group>

      <Group title="Âm thanh">
        <Row
          label="🔊 Âm thanh"
          hint="tự đọc từ/câu, câu hỏi nghe, nhạc chúc mừng — tắt khi không mở tiếng được (nút loa vẫn bấm nghe được)"
        >
          <Switch
            checked={cfg.soundEnabled !== false}
            onChange={(e) => void patch({ soundEnabled: e.target.checked })}
          />
        </Row>
        <Row
          label="Nghe trong bài chính"
          hint={
            cfg.soundEnabled === false
              ? "đang tắt theo Âm thanh — bật Âm thanh lại thì dùng được"
              : "phát audio từ → chọn nghĩa; các thẻ khác vẫn tự đọc"
          }
        >
          <Switch
            checked={cfg.listenEnabled !== false && cfg.soundEnabled !== false}
            disabled={cfg.soundEnabled === false}
            onChange={(e) => void patch({ listenEnabled: e.target.checked })}
          />
        </Row>
      </Group>

      <Group
        title="Dạng bài"
        note="Mỗi từ luyện 3 đợt: ① bài chính nhận biết/nhớ lại/nghe/gõ — chấm lịch ôn một lần · ② điền từ vào câu · ③ ghép câu. Hai đợt luyện câu không đổi lịch FSRS."
      >
        <Row label="Nhớ lại trước" hint="ẩn đáp án, tự nhớ trong đầu rồi mới bấm hiện (nhớ lâu hơn)">
          <Switch
            checked={cfg.recallFirst !== false}
            onChange={(e) => void patch({ recallFirst: e.target.checked })}
          />
        </Row>
        <Row label="Gõ chính tả" hint="thỉnh thoảng gõ lại từ đã quen (gặp ≥3 lần / bền ≥7 ngày) thay vì chọn">
          <Switch checked={cfg.spelling !== false} onChange={(e) => void patch({ spelling: e.target.checked })} />
        </Row>
        <Row label="Tự chuyển khi đúng" hint="trả lời đúng → tự sang thẻ kế">
          <Switch checked={cfg.autoAdvance} onChange={(e) => void patch({ autoAdvance: e.target.checked })} />
        </Row>
        <Row label="② Điền từ vào câu" hint="số câu mỗi từ, sau bài chính">
          <select
            aria-label="Số câu điền mỗi từ"
            value={cfg.clozePerWord ?? (cfg.clozeEnabled !== false ? 1 : 0)}
            onChange={(e) => {
              const n = Number(e.target.value);
              void patch({ clozePerWord: n, clozeEnabled: n > 0 });
            }}
            className={selectCls}
          >
            <option value={0}>Tắt</option>
            <option value={1}>1 câu</option>
            <option value={2}>2 câu</option>
            <option value={3}>3 câu</option>
            <option value={5}>5 câu</option>
          </select>
        </Row>
        <Row label="③ Câu ghép mỗi từ" hint="sắp xếp lại câu, ưu tiên câu khác bài điền">
          <select
            aria-label="Số câu ghép mỗi từ"
            value={cfg.arrangePerWord}
            onChange={(e) => void patch({ arrangePerWord: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={0}>Tắt</option>
            <option value={1}>1 câu</option>
            <option value={2}>2 câu</option>
            <option value={3}>3 câu</option>
            <option value={5}>5 câu (tất cả)</option>
          </select>
        </Row>
        <Row label="Câu vừa sức" hint="ưu tiên câu có đủ tỉ lệ từ bạn đã học (A1–A2 luôn tính là đã biết)">
          <select
            aria-label="Mức câu vừa sức"
            value={cfg.sentenceKnownMin}
            onChange={(e) => void patch({ sentenceKnownMin: Number(e.target.value) })}
            className={selectCls}
          >
            <option value={0}>Không lọc</option>
            <option value={0.6}>≥ 60%</option>
            <option value={0.7}>≥ 70%</option>
            <option value={0.8}>≥ 80%</option>
          </select>
        </Row>
        <Row
          label="Nghĩa câu khi đang làm"
          hint="hiện bản dịch ngay từ đầu ở câu điền & ghép — tắt thì làm xong mới hiện, khỏi bị mớm đáp án"
        >
          <Switch checked={cfg.sentenceVi === true} onChange={(e) => void patch({ sentenceVi: e.target.checked })} />
        </Row>
        <Row label="Xáo trộn các đợt" hint="giãn các bài của cùng một từ, tránh nhớ theo thứ tự">
          <Switch
            checked={cfg.interleave !== false}
            onChange={(e) => void patch({ interleave: e.target.checked })}
          />
        </Row>
      </Group>

      <Group title="Giao diện">
        <ThemeRow />
      </Group>

      <section>
        <GroupTitle>Đồng bộ &amp; sao lưu</GroupTitle>
        <div className="space-y-2">
          <SyncRow />
          <BackupCard />
        </div>
      </section>

      {/* Ghi công nguồn mở — CC BY-SA bắt buộc ghi tác giả + giữ nguyên giấy phép cho bản dẫn xuất */}
      <details className="group rounded-2xl border px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          📚 Nguồn dữ liệu &amp; giấy phép
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            Phiên âm, từ loại, dạng biến hình, định nghĩa tiếng Anh —{" "}
            <a href="https://kaikki.org/dictionary/English/" className="underline" target="_blank" rel="noreferrer">
              Wiktextract / Wiktionary
            </a>{" "}
            (CC BY-SA 4.0)
          </li>
          <li>Gán cấp CEFR — CEFR-J Wordlist (A1–B2) &amp; Octanove Vocabulary Profile (C1–C2), CC BY-SA</li>
          <li>
            Vốn từ công việc —{" "}
            <a
              href="https://www.newgeneralservicelist.com/business-service-list"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Business Service List
            </a>{" "}
            by Browne, C. &amp; Culligan, B. (CC BY-SA 4.0)
          </li>
          <li>Tần suất từ — wordfreq (Robyn Speer, MIT) &amp; OpenSubtitles FrequencyWords (CC BY-SA)</li>
          <li>Nghĩa tiếng Việt, câu ví dụ, cụm đi kèm, bài đọc, truyện, video hội thoại — do dự án này biên soạn</li>
          <li>Giọng đọc — Microsoft Edge neural TTS (en-US), sinh sẵn lúc build</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Dữ liệu dẫn xuất từ các nguồn CC BY-SA được chia sẻ lại theo cùng giấy phép.
        </p>
      </details>
    </div>
  );
}

// text-sm vẫn ≥ 16px (gốc chữ app 20px) → iOS không phóng to trang khi chạm ô chọn.
// min-w-0 + trần 60%: màn quá hẹp thì ô chọn co lại chứ không đè lên nhãn.
const selectCls =
  "min-w-0 max-w-[60%] rounded-xl border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";

function GroupTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <GroupTitle>{title}</GroupTitle>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>
      {note && <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </section>
  );
}

// <label> bọc cả dòng → bấm vào chữ cũng gạt được công tắc / mở được ô chọn.
// Dòng mô tả nằm DƯỚI, trải hết bề ngang — màn điện thoại hẹp (gốc chữ app 20px) mà để cạnh ô
// chọn thì cột chữ chỉ còn vài từ mỗi dòng. `stack`: ô điều khiển rộng (nút gạt 2 lựa chọn)
// xuống hẳn dòng dưới, trải hết bề ngang.
function Row({
  label,
  hint,
  as = "label",
  stack = false,
  children,
}: {
  label: string;
  hint?: string;
  as?: "label" | "div";
  stack?: boolean;
  children: ReactNode;
}) {
  const Tag = as;
  return (
    <Tag className="block px-4 py-3">
      <span className={cn("flex gap-3", stack ? "flex-col" : "min-h-9 items-center justify-between")}>
        <span className="min-w-[5.5rem] text-sm font-medium">{label}</span>
        {children}
      </span>
      {hint && <span className="mt-1 block text-xs leading-snug text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

// Công tắc gạt: vẫn là checkbox thật (bàn phím, trình đọc màn hình, getByLabel đều chạy), chỉ vẽ lại cho dễ bấm.
function Switch(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <span className="relative inline-flex h-7 w-12 shrink-0">
      <input
        type="checkbox"
        role="switch"
        {...props}
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-disabled:opacity-40"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
      />
    </span>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full border p-0.5 text-sm">
      {options.map(([val, text]) => (
        <button
          key={val}
          type="button"
          aria-pressed={value === val}
          onClick={() => onChange(val)}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 transition-colors",
            value === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// −/+ cho ngón cái trên điện thoại; vẫn gõ số trực tiếp được. Nháp riêng để xoá trắng ô khi đang gõ
// không bị ghi ngay thành 0 (gõ "10" từng nhận "0" → "01").
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    // giá trị đổi từ ngoài (−/+, đồng bộ máy khác) → nháp theo
    setShown(value);
    setDraft(String(value));
  }
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn =
    "grid size-8 place-items-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-40";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" aria-label="Bớt 1" disabled={value <= min} onClick={() => onChange(clamp(value - 1))} className={btn}>
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.trim() === "") return;
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(Math.round(n)));
        }}
        onBlur={() => setDraft(String(value))}
        className="w-12 rounded-xl border bg-background px-1 py-1 text-center text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
      />
      <button type="button" aria-label="Thêm 1" disabled={value >= max} onClick={() => onChange(clamp(value + 1))} className={btn}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ThemeRow() {
  const dark = useDarkMode();
  return (
    <Row label="Chế độ màu" as="div" stack>
      <Segmented
        label="Giao diện"
        value={dark ? "dark" : "light"}
        options={[
          ["light", "☀️ Sáng"],
          ["dark", "🌙 Tối"],
        ]}
        onChange={(v) => setDarkMode(v === "dark")}
      />
    </Row>
  );
}

function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `english-words-backup-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg({ ok: true, text: `Đã xuất ${data.reviews.length.toLocaleString("vi")} thẻ + toàn bộ tiến độ.` });
    } catch {
      setMsg({ ok: false, text: "Xuất dữ liệu lỗi." });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      if (
        mode === "replace" &&
        !window.confirm("Ghi đè TOÀN BỘ dữ liệu trên máy này bằng tệp sao lưu? (Không hoàn tác được)")
      ) {
        setBusy(false);
        return;
      }
      const r = await importData(data, mode);
      setMsg({
        ok: true,
        text: `Đã khôi phục ${r.reviews.toLocaleString("vi")} thẻ · ${r.daily} ngày thống kê. Đang tải lại…`,
      });
      requestSync();
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Tệp sao lưu không hợp lệ." });
      setBusy(false);
    }
  };

  const btn =
    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border bg-background py-2.5 text-sm font-semibold transition-all hover:bg-muted active:scale-[0.99] disabled:opacity-50";

  return (
    <div className="rounded-2xl border bg-card">
      <div className="space-y-3 px-4 py-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          💾 Lịch sử ôn FSRS là thứ duy nhất không dựng lại được nếu mất — thỉnh thoảng xuất một tệp dự phòng.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void doExport()} disabled={busy} className={btn}>
            <Download className="size-4" /> Xuất tệp
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={btn}>
            <Upload className="size-4" /> Nhập tệp…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
        </div>
        {msg && (
          <p className={cn("text-xs", msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{msg.text}</p>
        )}
      </div>
      <div className="border-t">
        <Row label="Cách nhập" hint="Gộp = giữ cả hai, bản mới hơn thắng · Ghi đè = xoá sạch rồi khôi phục từ tệp">
          <select value={mode} onChange={(e) => setMode(e.target.value as "merge" | "replace")} className={selectCls}>
            <option value="merge">Gộp</option>
            <option value="replace">Ghi đè</option>
          </select>
        </Row>
      </div>
    </div>
  );
}
