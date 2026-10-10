import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Mã build mặc định là chuỗi ngẫu nhiên và được nhúng vào MỌI trang HTML + RSC (~10,8k file)
// → lần deploy nào Firebase cũng phải tải lại toàn bộ trang dù chỉ thêm vài bài đọc.
// Lấy mã build từ băm MÃ NGUỒN (không tính public/, content/, dữ liệu) → thêm nội dung thì mã giữ nguyên,
// chỉ trang đổi nội dung mới phải tải; sửa code thì mã đổi → Next vẫn ép tải lại trang ở tab cũ.
// lib/library-labels.ts chỉ chứa bảng nhãn chủ đề/thể loại/giấy phép (đợt nội dung hay thêm) nên không tính vào.
const CODE_DIRS = ["app", "components", "lib"];
const CODE_FILES = ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs"];
const SKIP = new Set(["lib/library-labels.ts"]);

// package.json: chỉ giữ lệnh `build` trong scripts — đợt nội dung hay thêm lệnh content:* mà bundle không đổi.
function readForHash(f: string): Buffer | string {
  if (f !== "package.json") return readFileSync(f);
  const pkg = JSON.parse(readFileSync(f, "utf8"));
  pkg.scripts = { build: pkg.scripts?.build };
  return JSON.stringify(pkg);
}

function codeBuildId(): string {
  const h = createHash("sha256");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith(".")) // .DS_Store…
      .flatMap((e) => {
        const p = join(dir, e.name);
        return e.isDirectory() ? walk(p) : [p];
      });
  const files = [...CODE_DIRS.flatMap((d) => walk(d)), ...CODE_FILES.filter((f) => statSync(f, { throwIfNoEntry: false }))]
    .filter((f) => !SKIP.has(f))
    .sort();
  for (const f of files) h.update(f).update("\0").update(readForHash(f)).update("\0");
  // biến NEXT_PUBLIC_* được nhúng vào bundle (config Firebase, UID chủ, bản tắt đồng bộ) → cũng đổi mã build
  for (const [k, v] of Object.entries(process.env).filter(([k]) => k.startsWith("NEXT_PUBLIC_")).sort())
    h.update(`${k}=${v}\0`);
  return "c" + h.digest("hex").slice(0, 20);
}

const nextConfig: NextConfig = {
  // Xuất tĩnh để host trên Firebase Hosting — tạo thư mục `out/`.
  output: "export",
  // Static export không có image optimizer của server.
  images: { unoptimized: true },
  generateBuildId: async () => codeBuildId(),
};

export default nextConfig;
