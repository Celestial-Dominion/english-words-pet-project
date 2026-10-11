#!/usr/bin/env node
// Kiểm bản LIVE sau deploy: tải về rồi so sha256 với out/ cho (1) trang chủ + trang Ôn tập (mang mã build),
// (2) mẫu ngẫu nhiên N file trong số file vừa đổi (scripts/.deploy-changed.txt — deploy-plan.mjs ghi; trống
// thì lấy mẫu toàn out/). Byte khớp hết mới tính là deploy đúng; lệch → in ✗ và thoát mã 1.
//   node scripts/deploy-verify.mjs [N=40]
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const N = Number(process.argv[2] ?? 40);
const project = JSON.parse(readFileSync(join(ROOT, ".firebaserc"), "utf8")).projects.default;
const SITE = `https://${project}.web.app`;

const all = () => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(OUT, p).split("\\").join("/"));
    }
  };
  walk(OUT);
  return out;
};
const listFile = join(ROOT, "scripts", ".deploy-changed.txt");
let pool = existsSync(listFile) ? readFileSync(listFile, "utf8").split("\n").filter(Boolean) : [];
const from = pool.length ? "file vừa đổi" : "toàn out/";
if (!pool.length) pool = all();
const sample = new Set(["index.html", "on-tap.html"]);
while (sample.size < Math.min(N + 2, pool.length + 2)) sample.add(pool[Math.floor(Math.random() * pool.length)]);

// cleanUrls: a/b.html phục vụ ở /a/b, index.html ở thư mục; tên file CJK/ký tự đặc biệt → mã hoá từng đoạn.
const urlOf = (f) => {
  let p = f;
  if (p.endsWith(".html")) p = p.slice(0, -5);
  if (p === "index" || p.endsWith("/index")) p = p.slice(0, -5);
  return SITE + "/" + p.split("/").map(encodeURIComponent).join("/");
};
const sha = (b) => createHash("sha256").update(b).digest("hex");

// null = khớp; chuỗi = lý do lệch. Thử lại 3 lần cho lỗi mạng chớp nhoáng.
const check = async (f) => {
  let why = "";
  for (let t = 0; t < 3; t++) {
    try {
      const res = await fetch(urlOf(f), { cache: "no-store" }); // tự giải nén gzip/br → byte gốc
      const body = Buffer.from(await res.arrayBuffer());
      if (res.ok && sha(body) === sha(readFileSync(join(OUT, f)))) return null;
      why = `HTTP ${res.status}, ${body.length} byte`;
    } catch (e) {
      why = e.message;
    }
  }
  return `${f} (${why})`;
};
const bad = [];
const items = [...sample];
let k = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (k < items.length) {
      const why = await check(items[k++]);
      if (why) bad.push(why);
    }
  }),
);
if (bad.length) {
  console.log(`✗ kiểm live: ${bad.length}/${sample.size} file KHÁC bản local (${SITE}):`);
  for (const b of bad.slice(0, 10)) console.log("   " + b);
  process.exit(1);
}
console.log(`✓ kiểm live: ${sample.size}/${sample.size} file khớp byte (trang chủ, Ôn tập + ${sample.size - 2} mẫu ${from})`);
