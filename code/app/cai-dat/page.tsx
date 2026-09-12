"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, Upload, RefreshCw, SlidersHorizontal, ChevronRight } from "lucide-react";
import { exportData, importData, type BackupData } from "@/lib/db";
import { requestSync } from "@/lib/sync";

export default function CaiDatPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [msg, setMsg] = useState<string | null>(null);
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
      setMsg(`Đã xuất ${data.reviews.length.toLocaleString("vi")} thẻ + toàn bộ tiến độ.`);
    } catch {
      setMsg("Xuất dữ liệu lỗi.");
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
      setMsg(`Đã khôi phục ${r.reviews.toLocaleString("vi")} thẻ · ${r.daily} ngày thống kê. Đang tải lại…`);
      requestSync();
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Tệp sao lưu không hợp lệ.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cài đặt</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sao lưu dữ liệu học, đồng bộ và cấu hình.</p>
      </div>

      {/* Sao lưu / khôi phục */}
      <section className="rounded-3xl border p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">💾 Sao lưu &amp; khôi phục</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Lịch sử ôn tập FSRS là thứ duy nhất không thể dựng lại nếu mất — xuất tệp dự phòng định kỳ cho chắc.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => void doExport()}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
          >
            <Download className="size-4" /> Xuất dữ liệu (.json)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition-all hover:bg-muted active:scale-[0.99] disabled:opacity-50"
          >
            <Upload className="size-4" /> Nhập từ tệp…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
        </div>
        <label className="mt-3 flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">
            Cách nhập
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Gộp = giữ cả hai, bản mới hơn thắng · Ghi đè = xoá sạch rồi khôi phục từ tệp
            </span>
          </span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "merge" | "replace")}
            className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            <option value="merge">Gộp</option>
            <option value="replace">Ghi đè</option>
          </select>
        </label>
        {msg && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
      </section>

      {/* Đồng bộ */}
      <section className="rounded-3xl border p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">☁️ Đồng bộ đám mây</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Đăng nhập Google (nút trên thanh đầu trang) để tự đồng bộ thẻ, thống kê, mẹo nhớ và tiến độ các
          khóa học giữa các thiết bị. Đồng bộ chạy khi mở app, khi kết thúc phiên học và khi rời app.
        </p>
        <button
          onClick={() => {
            requestSync();
            setMsg("Đã yêu cầu đồng bộ (chạy nền).");
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all hover:bg-muted active:scale-[0.99]"
        >
          <RefreshCw className="size-4" /> Đồng bộ ngay
        </button>
      </section>

      {/* Cài đặt phiên ôn */}
      <Link
        href="/on-tap"
        className="flex items-center justify-between gap-3 rounded-3xl border p-5 transition-colors hover:bg-muted/50"
      >
        <span className="flex items-center gap-3">
          <SlidersHorizontal className="size-5 text-muted-foreground" />
          <span>
            <span className="block text-sm font-semibold">Cài đặt phiên học/ôn</span>
            <span className="block text-xs text-muted-foreground">
              Từ mới mỗi ngày, số thẻ mỗi phiên, hướng hỏi, âm thanh… — trong mục ⚙️ ở tab Ôn tập
            </span>
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

      {/* Ghi công nguồn mở — CC BY-SA bắt buộc ghi tác giả + giữ nguyên giấy phép cho bản dẫn xuất */}
      <section className="rounded-3xl border p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">📚 Nguồn dữ liệu</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
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
            <a href="https://www.newgeneralservicelist.com/business-service-list" className="underline" target="_blank" rel="noreferrer">
              Business Service List
            </a>{" "}
            by Browne, C. &amp; Culligan, B. (CC BY-SA 4.0)
          </li>
          <li>Tần suất từ — wordfreq (Robyn Speer, MIT) &amp; OpenSubtitles FrequencyWords (CC BY-SA)</li>
          <li>Bài đọc — Simple English Wikipedia (CC BY-SA) &amp; Wikinews (CC BY 2.5)</li>
          <li>Nghĩa tiếng Việt, câu ví dụ, cụm đi kèm — do dự án này tạo</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Dữ liệu dẫn xuất từ các nguồn CC BY-SA được chia sẻ lại theo cùng giấy phép.
        </p>
      </section>
    </div>
  );
}
