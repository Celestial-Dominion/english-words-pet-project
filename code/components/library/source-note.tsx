// Ghi nguồn cho bài đọc / truyện phỏng theo nguồn mở: tên gốc, tác giả/tuyển tập, giấy phép (liên kết bản tóm tắt
// giấy phép) và đường dẫn nguồn (GitHub hoặc trang gốc) — đủ yêu cầu ghi công của CC BY (tác giả, nguồn, giấy phép,
// ghi rõ đã chỉnh sửa).
import { ExternalLink } from "lucide-react";
import { LICENSES, type ContentSource } from "@/lib/library";

// Nhãn liên kết theo tên miền nguồn: "Nguồn GitHub", "Nguồn Wikipedia"…
function hostLabel(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h === "github.com") return "Nguồn GitHub";
    if (h.endsWith("wikipedia.org")) return "Nguồn Wikipedia";
    if (h.endsWith("wikivoyage.org")) return "Nguồn Wikivoyage";
    return `Nguồn ${h}`;
  } catch {
    return "Nguồn";
  }
}

export function SourceNote({ source, className }: { source: ContentSource; className?: string }) {
  const lic = LICENSES[source.license];
  const link = "font-medium text-primary underline-offset-2 hover:underline";
  return (
    <p className={className ?? "text-xs leading-relaxed text-muted-foreground"}>
      Phỏng theo <span className="font-medium text-foreground">«{source.title}»</span> — {source.credit}.{" "}
      {lic ? (
        <a href={lic.url} target="_blank" rel="noopener noreferrer" className={link}>
          {lic.label}
        </a>
      ) : (
        source.license
      )}{" "}
      ·{" "}
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={`${link} whitespace-nowrap`}>
        {hostLabel(source.url)}
        <ExternalLink className="ml-0.5 inline size-3 align-[-1px]" />
      </a>
      {" "}— đã biên soạn lại theo cấp độ và dịch sang tiếng Việt.
    </p>
  );
}
