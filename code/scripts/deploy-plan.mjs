#!/usr/bin/env node
// Ước lượng khối lượng deploy TRƯỚC khi tải + đề xuất số luồng (DEPLOY.md, mục "Chọn số luồng").
// So out/ với bộ nhớ đệm băm của firebase-tools (.firebase/hosting.b3V0.cache: đường dẫn, mtime, sha256
// bản gzip mức 9 — cập nhật sau mỗi lần deploy) theo ĐÚNG cách firebase-tools làm: mtime trùng → coi như
// không đổi; mtime khác hoặc file mới → băm lại rồi so. Ra: tóm tắt + dòng máy đọc
//   PLAN files=… mb=… large=… mp3=… conc=… up=…   (up = Mbps tải lên đo được, 0 = không đo)
// và danh sách file đổi ở scripts/.deploy-changed.txt (deploy-verify.mjs lấy mẫu từ đó).
//   node scripts/deploy-plan.mjs              (UPLINK_MBPS=50 → dùng số này, khỏi đo tải lên)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const CACHE = join(ROOT, ".firebase", `hosting.${Buffer.from("out").toString("base64")}.cache`);
const HISTORY = join(ROOT, ".firebase", "deploy-history.tsv");
const LARGE = 256 * 1024; // file ≥256 KB (MP3, JSON lớn) — loại làm nghẽn băng thông khi nhiều luồng

if (!existsSync(OUT)) {
  console.error("không có out/ — chạy npm run build trước");
  process.exit(1);
}

// Bỏ như firebase.json "ignore": file/thư mục chấm, node_modules, firebase.json.
const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== "firebase.json") files.push(relative(OUT, p).split("\\").join("/"));
  }
};
walk(OUT);

const cache = new Map();
if (existsSync(CACHE)) {
  for (const line of readFileSync(CACHE, "utf8").split("\n")) {
    // tên file có thể chứa dấu phẩy → mtime và hash là hai trường CUỐI
    const b = line.lastIndexOf(","), a = line.lastIndexOf(",", b - 1);
    if (a > 0) cache.set(line.slice(0, a), { mtime: Number(line.slice(a + 1, b)), hash: line.slice(b + 1) });
  }
}

const gz = promisify(gzip);
const changed = [];
let rehashed = 0;
const candidates = [];
for (const f of files) {
  const st = statSync(join(OUT, f));
  const c = cache.get(f);
  if (c && c.mtime === st.mtime.getTime()) continue;
  candidates.push({ f, size: st.size, hash: c?.hash });
}
// Băm song song vừa phải (zlib chạy trên threadpool của libuv).
let next = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (next < candidates.length) {
      const it = candidates[next++];
      if (it.hash) {
        rehashed++;
        const h = createHash("sha256").update(await gz(readFileSync(join(OUT, it.f)), { level: 9 })).digest("hex");
        if (h === it.hash) continue;
      }
      changed.push(it);
    }
  }),
);

const bytes = changed.reduce((s, x) => s + x.size, 0);
const large = changed.filter((x) => x.size >= LARGE).length;
const mp3 = changed.filter((x) => x.f.endsWith(".mp3")).length;
const largeMb = changed.filter((x) => x.size >= LARGE).reduce((s, x) => s + x.size, 0) / 1e6;

// Số luồng tự chọn (AI/người vẫn ép được CONC=N sau khi xem lịch sử):
//  - ≤ 20 file lớn: chủ yếu file nhỏ → nghẽn ở độ trễ từng file, không phải băng thông → 100 luồng.
//  - > 20 file lớn: nghẽn ở BĂNG THÔNG tải lên. firebase-tools cho mỗi file thời gian chờ max(30 s, 20 ms/KB)
//    → mỗi luồng cần ≥ 50 KB/s; chừa gấp 3 → luồng = tốc độ tải lên (KB/s) ÷ 150, kẹp 4–100. (28/09: 200 luồng
//    trên đường ~5,5 MB/s = 27 KB/s mỗi luồng → quá hạn chờ hàng loạt.) Đo bằng networkQuality của macOS (~15 s,
//    chỉ khi cần); không đo được → 8 luồng như trước.
const measureUplink = () => {
  try {
    const out = execFileSync("networkQuality", ["-d", "-c", "-M", "15"], {
      timeout: 40000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Math.round(JSON.parse(out).ul_throughput / 1e5) / 10; // bit/s → Mbps, 1 chữ số thập phân
  } catch {
    return 0;
  }
};
let up = 0;
let conc = 100;
if (large > 20) {
  up = Number(process.env.UPLINK_MBPS) || measureUplink();
  conc = up > 0 ? Math.max(4, Math.min(100, Math.floor((up * 125) / 150))) : 8; // Mbps × 125 = KB/s
}

const byType = new Map();
for (const x of changed) {
  const ext = x.f.includes(".") ? x.f.slice(x.f.lastIndexOf(".") + 1) : "(khác)";
  byType.set(ext, (byType.get(ext) ?? 0) + 1);
}
writeFileSync(join(ROOT, "scripts", ".deploy-changed.txt"), changed.map((x) => x.f).join("\n") + (changed.length ? "\n" : ""));

console.log(`▸ kế hoạch: ${files.length} file trong out/, ${changed.length} file đổi so với lần deploy trước (băm lại ${rehashed})`);
console.log(
  `  ${(bytes / 1e6).toFixed(1)} MB · ${large} file ≥256 KB (${largeMb.toFixed(1)} MB) · ${mp3} MP3 · ` +
    [...byType].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${v} .${k}`).join(", "),
);
if (large > 20) {
  console.log(
    up > 0
      ? `  tải lên ${up} Mbps (≈${(up / 8).toFixed(1)} MB/s) → ${conc} luồng (~${Math.round((up * 125) / conc)} KB/s mỗi luồng; ` +
          `firebase-tools cần ≥50) · file lớn cần ít nhất ~${Math.ceil(largeMb / (up / 8))} giây`
      : "  không đo được tốc độ tải lên → 8 luồng (an toàn); đặt UPLINK_MBPS=… nếu biết",
  );
}
if (!existsSync(CACHE)) console.log("  (chưa có bộ nhớ đệm băm → coi mọi file là mới; firebase sẽ tự bỏ file server đã có)");
if (existsSync(HISTORY)) {
  const rows = readFileSync(HISTORY, "utf8").trim().split("\n");
  console.log(`  lịch sử gần nhất (${HISTORY.replace(ROOT + "/", "")}):`);
  for (const r of [rows[0], ...rows.slice(1).slice(-5)]) console.log("    " + r.replaceAll("\t", " | "));
}
console.log(`PLAN files=${changed.length} mb=${(bytes / 1e6).toFixed(1)} large=${large} mp3=${mp3} conc=${conc} up=${up}`);
