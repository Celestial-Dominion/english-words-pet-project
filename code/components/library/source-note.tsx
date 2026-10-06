// Ghi nguồn cho bài đọc / truyện phỏng theo nguồn mở: tên gốc, tác giả/tuyển tập, giấy phép (liên kết bản tóm tắt
// giấy phép) và đường dẫn GitHub — đủ yêu cầu ghi công của CC BY (tác giả, nguồn, giấy phép, ghi rõ đã chỉnh sửa).
import { ExternalLink } from "lucide-react";
import { LICENSES, type ContentSource } from "@/lib/library";

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
        Nguồn GitHub
        <ExternalLink className="ml-0.5 inline size-3 align-[-1px]" />
      </a>
      {" "}— đã biên soạn lại theo cấp độ và dịch sang tiếng Việt.
    </p>
  );
}
