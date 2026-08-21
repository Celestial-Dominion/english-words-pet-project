import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Xuất tĩnh để host trên hosting tĩnh (F7) — tạo thư mục `out/`.
  output: "export",
  // Static export không có image optimizer của server.
  images: { unoptimized: true },
};

export default nextConfig;
