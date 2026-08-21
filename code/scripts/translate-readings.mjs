// Dịch bài đọc bằng MÁY (rẻ nhất — 0 token agent), dùng cho đợt mở rộng kho bài đọc.
//
//   node scripts/translate-readings.mjs [--engine=mymemory|google] [--limit=50] [--email=you@x.com]
//
// Chất lượng máy dịch đủ dùng cho BÀI ĐỌC (bản dịch chỉ để đối chiếu khi bí — người học đọc
// tiếng Anh là chính). KHÔNG dùng cho nghĩa từ vựng / câu ví dụ: đó là nội dung học chính,
// sai một nghĩa là học sai vĩnh viễn → phải qua agent.
//
// engine:
//   mymemory (mặc định) — API công khai, free tier rõ ràng. Không email: ~1.000 từ/ngày;
//                          có --email: ~10.000 từ/ngày. Chậm nhưng hợp lệ.
//   google              — endpoint translate_a/single: nhanh, không cần key, nhưng là API
//                          NỘI BỘ không công khai; dùng quy mô lớn có thể bị chặn IP.
//
// Resume: ghi từng batch ra rd-done/ ngay khi xong, chạy lại là bỏ qua phần đã dịch.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { progress } from "./lib-progress.mjs";

const HERE = import.meta.dirname;
const BATCH_DIR = join(HERE, "rd-batches");
const DONE_DIR = join(HERE, "rd-done");
mkdirSync(DONE_DIR, { recursive: true });

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const ENGINE = arg("engine", "mymemory");
const LIMIT = Number(arg("limit", "0")); // 0 = không giới hạn
const EMAIL = arg("email", "");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- engine ----
async function viaMyMemory(text) {
  const u = new URL("https://api.mymemory.translated.net/get");
  u.searchParams.set("q", text);
  u.searchParams.set("langpair", "en|vi");
  if (EMAIL) u.searchParams.set("de", EMAIL);
  const r = await fetch(u);
  const d = await r.json();
  if (d.responseStatus !== 200 && d.responseStatus !== "200") {
    throw new Error(String(d.responseDetails ?? d.responseStatus));
  }
  return String(d.responseData.translatedText);
}

/**
 * Dịch NHIỀU câu trong MỘT request bằng cách nối chúng bằng xuống dòng — Google giữ nguyên
 * ranh giới dòng, nên nhanh gấp ~10 lần so với gọi từng câu. Nếu số dòng trả về không khớp
 * (câu quá dài bị cắt, hoặc engine gộp dòng) thì caller tự lùi về dịch từng câu.
 */
async function viaGoogleBatch(lines) {
  const joined = lines.join("\n");
  const u = new URL("https://translate.googleapis.com/translate_a/single");
  u.searchParams.set("client", "gtx");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", "vi");
  u.searchParams.set("dt", "t");
  u.searchParams.set("q", joined);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const out = d[0].map((x) => x[0]).join("").split("\n").map((x) => x.trim()).filter(Boolean);
  if (out.length !== lines.length) throw new Error(`lệch dòng ${out.length}/${lines.length}`);
  return out;
}

async function viaGoogle(text) {
  const u = new URL("https://translate.googleapis.com/translate_a/single");
  u.searchParams.set("client", "gtx");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", "vi");
  u.searchParams.set("dt", "t");
  u.searchParams.set("q", text);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return d[0].map((x) => x[0]).join("");
}

// ---- Fallback khi translate_a/single bị chặn (429/403) ----
// 1) clients5 (dict-chrome-ex): endpoint của extension Chrome, hạn mức tách riêng.
async function viaGoogleClients5(text) {
  const u = new URL("https://clients5.google.com/translate_a/t");
  u.searchParams.set("client", "dict-chrome-ex");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", "vi");
  u.searchParams.set("q", text);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  // trả ["bản dịch"] hoặc [["bản dịch","en"]]
  const first = Array.isArray(d) ? d[0] : null;
  const out = Array.isArray(first) ? first[0] : first;
  if (typeof out !== "string") throw new Error("format lạ");
  return out;
}

// 2) Trang MOBILE translate.google.com/m — bản HTML cho máy yếu, gần như không bị chặn.
async function viaGoogleMobile(text) {
  const u = new URL("https://translate.google.com/m");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", "vi");
  u.searchParams.set("q", text);
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/class="result-container">([^<]*)</);
  if (!m) throw new Error("không tìm thấy result-container");
  // giải HTML entity cơ bản (&amp; &#39; &quot; &lt; &gt;)
  return m[1]
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

const GOOGLE_FALLBACKS = [viaGoogleClients5, viaGoogleMobile];

/**
 * Bản BATCH của trang mobile: /m giữ nguyên ranh giới \n (đã kiểm 11/08) nên dịch được cả bài
 * trong 1 request — nhanh gấp ~10 lần fallback từng câu khi translate_a/single bị 429.
 * Giới hạn: q đi trên URL (GET) → chỉ dùng khi tổng độ dài còn an toàn (~6KB).
 */
async function viaGoogleMobileBatch(lines) {
  const joined = lines.join("\n");
  if (joined.length > 6000) throw new Error("quá dài cho GET /m");
  const u = new URL("https://translate.google.com/m");
  u.searchParams.set("sl", "en");
  u.searchParams.set("tl", "vi");
  u.searchParams.set("q", joined);
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/class="result-container">([\s\S]*?)<\/div>/);
  if (!m) throw new Error("không tìm thấy result-container");
  const decode = (s) => s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const out = decode(m[1]).split("\n").map((x) => x.trim()).filter(Boolean);
  if (out.length !== lines.length) throw new Error(`lệch dòng ${out.length}/${lines.length}`);
  return out;
}

const ENGINES = { mymemory: viaMyMemory, google: viaGoogle };
const translateOne = ENGINES[ENGINE];
if (!translateOne) {
  console.error(`engine không hợp lệ: ${ENGINE} (chọn: ${Object.keys(ENGINES).join(", ")})`);
  process.exit(1);
}
// MyMemory siết chặt hơn nhiều → giãn nhịp khác nhau theo engine.
const DELAY = ENGINE === "mymemory" ? 1200 : 250;

async function translate(text, tries = 0) {
  try {
    await sleep(DELAY);
    const out = await translateOne(text);
    if (!out?.trim()) throw new Error("kết quả rỗng");
    return out.trim();
  } catch (e) {
    // Bị chặn (429/403) ở engine google → thử lần lượt các endpoint dự phòng
    // (clients5, trang mobile /m) trước khi retry — mỗi endpoint có hạn mức riêng.
    if (ENGINE === "google" && /HTTP (429|403)/.test(String(e.message))) {
      for (const fb of GOOGLE_FALLBACKS) {
        try {
          await sleep(500);
          const out = await fb(text);
          if (out?.trim()) return out.trim();
        } catch { /* thử endpoint kế */ }
      }
    }
    if (tries < 3) {
      await sleep(3000 * (tries + 1));
      return translate(text, tries + 1);
    }
    throw e;
  }
}

// ---- chạy ----
const doneFiles = new Set(existsSync(DONE_DIR) ? readdirSync(DONE_DIR) : []);
const batches = readdirSync(BATCH_DIR)
  .filter((f) => f.endsWith(".json") && !doneFiles.has(f))
  .sort();

if (!batches.length) {
  console.error("Không còn batch nào chưa dịch.");
  process.exit(0);
}

const picked = LIMIT ? batches.slice(0, LIMIT) : batches;
const totalDocs = picked.reduce(
  (n, f) => n + JSON.parse(readFileSync(join(BATCH_DIR, f), "utf8")).length, 0);
console.error(`Engine: ${ENGINE}${EMAIL ? ` (email: ${EMAIL})` : ""} · ${picked.length} batch · ${totalDocs} bài`);

const bar = progress(totalDocs, `dịch ${ENGINE}`);
let failed = 0;
for (const f of picked) {
  const docs = JSON.parse(readFileSync(join(BATCH_DIR, f), "utf8"));
  const out = [];
  for (const d of docs) {
    try {
      // Cả bài (tiêu đề + mọi câu) trong 1 request; hỏng thì lùi về dịch từng câu.
      let title_vi, vi;
      if (ENGINE === "google") {
        try {
          await sleep(DELAY);
          const all = await viaGoogleBatch([d.title_en, ...d.sentences]);
          [title_vi, ...vi] = all;
        } catch {
          // translate_a/single bị chặn → thử trang MOBILE cả bài (vẫn 1 request);
          // hỏng nữa mới lùi về dịch từng câu (chậm nhất, đi qua đủ mọi fallback).
          try {
            await sleep(DELAY);
            const all = await viaGoogleMobileBatch([d.title_en, ...d.sentences]);
            [title_vi, ...vi] = all;
          } catch {
            title_vi = await translate(d.title_en);
            vi = [];
            for (const s of d.sentences) vi.push(await translate(s));
          }
        }
      } else {
        title_vi = await translate(d.title_en);
        vi = [];
        for (const s of d.sentences) vi.push(await translate(s));
      }
      out.push({ id: d.id, title_vi, vi });
      bar.tick(1, `${out.length}/${docs.length} trong ${f}${failed ? ` · lỗi ${failed}` : ""}`);
    } catch (e) {
      failed++;
      bar.tick(1, `lỗi ${failed}: ${e.message.slice(0, 40)}`);
    }
  }
  // ghi ngay từng batch → dừng giữa chừng vẫn giữ được phần đã dịch
  if (out.length) writeFileSync(join(DONE_DIR, f), JSON.stringify(out, null, 1));
}
bar.done(`xong${failed ? ` (${failed} bài lỗi, chạy lại để dịch tiếp)` : ""}`);
