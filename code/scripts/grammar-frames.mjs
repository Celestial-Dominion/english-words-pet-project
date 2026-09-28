// Soát hình bài Ngữ pháp: mỗi bài → 1 PNG "contact sheet" = sân khấu ở giữa TỪNG bảng (công thức, cặp, trục thời
// gian, sửa lỗi, cảnh hội thoại…) + chú thích (phần · loại bảng · câu). Chrome headless qua CDP, trỏ vào DEV server
// (bản out/ bị AuthGate chặn). Công cụ soát tay — không nằm trong build/test.
//
//   BASE=http://localhost:3012 node scripts/grammar-frames.mjs [id…] [--level a1]   (không id = mọi bài đã build)
//   → $OUT (mặc định <tmp>/grammar-frames)/{id}.png ; COLS / W = số cột / bề ngang mỗi khung (mặc định 3 × 480);
//   VW = bề ngang cửa sổ (1400 = desktop, 390 = điện thoại); PORT = cổng CDP (chạy song song thì mỗi tiến trình một PORT);
//   TYPES = chỉ chụp các loại bảng này (vd TYPES=table,timeline).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? join(tmpdir(), "grammar-frames");
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? "http://localhost:3012";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PORT ?? 9343);
const COLS = Number(process.env.COLS ?? 3);
const W = Number(process.env.W ?? 480);
const VW = Number(process.env.VW ?? 1400);
const TYPES = process.env.TYPES ? new Set(process.env.TYPES.split(",")) : null;
const idx = JSON.parse(readFileSync(join(ROOT, "public/data/grammar/index.json"), "utf8")).lessons;
const argv = process.argv.slice(2);
const li = argv.indexOf("--level");
const lvl = li >= 0 ? argv[li + 1] : null;
const named = argv.filter((a, i) => !a.startsWith("--") && !(li >= 0 && i === li + 1));
const list = named.length ? idx.filter((l) => named.includes(l.id)) : idx.filter((l) => !lvl || l.lv === lvl);

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `grammar-frames-chrome-${PORT}`)}`, "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(path, method = "GET") {
  for (let i = 0; i < 50; i++) {
    try {
      return await (await fetch(`http://127.0.0.1:${PORT}${path}`, { method })).json();
    } catch {
      await sleep(200);
    }
  }
  throw new Error("chrome không lên");
}
const target = await json("/json/new?about:blank", "PUT");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setBypassServiceWorker", { bypass: true });
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: VW, height: 1000, deviceScaleFactor: 1, mobile: VW < 768 });

for (const meta of list) {
  await send("Page.navigate", { url: `${BASE}/ngu-phap/${meta.lv}/${meta.id}` });
  let ok = false;
  for (let i = 0; i < 120 && !ok; i++) {
    await sleep(150);
    ok = await evaluate(`!!document.querySelector('audio') && !!document.querySelector('[style*="container-type"]')`).catch(() => false);
  }
  if (!ok) {
    console.log(meta.id, "✗ không tải được bài");
    continue;
  }
  const lesson = await (await fetch(`${BASE}/data/grammar/lessons/${meta.id}.json?v=${meta.v}`)).json();
  // audio bài để preload="none" → nạp metadata trước, không thì đặt currentTime không có tác dụng
  await evaluate(`(async () => {
    const a = document.querySelector('audio');
    if (a.readyState < 1) { a.preload = 'auto'; a.load(); await new Promise((r) => { a.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 8000); }); }
    // phát rồi dừng ngay một lần → bỏ lớp nút "phát" phủ giữa cảnh
    await a.play().catch(() => {}); a.pause();
    return a.readyState;
  })()`);
  // mỗi bảng: khung giữa đoạn đầu tiên dùng bảng đó (+ đoạn cuối nếu bảng kéo dài ≥3 đoạn: thấy trạng thái sau cùng)
  const picks = [];
  lesson.boards.forEach((b, bi) => {
    const bs = lesson.beats.map((x, i) => [x, i]).filter(([x]) => x.b === bi);
    if (!bs.length || (TYPES && !TYPES.has(b.type))) return;
    const take = (x, i) => picks.push({ t: Math.min(x.end - 0.05, x.start + Math.max(0.6, (x.end - x.start) * 0.6)), i, b });
    take(...bs[0]);
    if (bs.length >= 3) take(...bs[bs.length - 1]);
  });
  const frames = [];
  if (!picks.length) {
    console.log(meta.id, "· không có bảng cần chụp");
    continue;
  }
  for (const p of picks) {
    const beat = lesson.beats[p.i];
    const cap = `${p.i + 1}. ${beat.sec} · ${p.b.type}${p.b.sec ? "/" + p.b.sec : ""} · ${beat.k === "e" ? (beat.who ? beat.who + ": " : "") + beat.en : beat.parts.map((x) => x.v ?? x.e).join("").slice(0, 70)}`;
    const box = await evaluate(`(async () => {
      window.dispatchEvent(new WheelEvent('wheel'));
      const a = document.querySelector('audio');
      a.pause();
      await new Promise((r) => { a.addEventListener('seeked', r, { once: true }); a.currentTime = ${p.t}; setTimeout(r, 900); });
      await new Promise((r) => setTimeout(r, 700));
      window.scrollTo({ top: 0, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 150));
      const el = document.querySelector('.aspect-video');
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...box, scale: 1 } });
    frames.push({ png: shot.data, cap });
  }
  // contact sheet
  await send("Page.navigate", { url: "about:blank" });
  await sleep(200);
  await evaluate(`(() => {
    document.body.style.margin = '0';
    const g = document.createElement('div');
    g.id = '__grid';
    g.style.cssText = 'display:grid;grid-template-columns:repeat(${COLS}, ${W}px);gap:10px;padding:12px;width:max-content;font:12px system-ui;background:#fff';
    for (const f of ${JSON.stringify(frames)}) {
      const c = document.createElement('div');
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,' + f.png;
      img.style.cssText = 'width:${W}px;display:block;border:1px solid #ddd;border-radius:8px';
      const p = document.createElement('div');
      p.textContent = f.cap;
      p.style.cssText = 'width:${W}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#333;margin-top:2px';
      c.append(img, p);
      g.appendChild(c);
    }
    document.body.appendChild(g);
    return true;
  })()`);
  await sleep(400);
  const box = await evaluate(`(() => { const r = document.getElementById('__grid').getBoundingClientRect(); return { x: 0, y: 0, width: r.width, height: r.height }; })()`);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...box, scale: 1 } });
  writeFileSync(join(OUT, `${meta.id}.png`), Buffer.from(shot.data, "base64"));
  console.log(meta.id, "✓", `${frames.length} khung →`, join(OUT, `${meta.id}.png`));
}
ws.close();
chrome.kill();
process.exit(0);
