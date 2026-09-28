// Soát hình bài Video: mỗi bài → 1 PNG "contact sheet" = cảnh ở giữa TỪNG câu + chú thích
// (người nói, biểu cảm, cử chỉ, bong bóng). Chrome headless qua CDP, trỏ vào DEV server
// (bản out/ bị AuthGate chặn). Công cụ soát tay — không nằm trong build/test.
//
//   BASE=http://localhost:3011 node scripts/video-frames.mjs [id…] [--level N]   (không id = mọi bài)
//   → $OUT (mặc định <tmp>/video-frames)/{id}.png ; COLS / W = số cột / bề ngang mỗi khung;
//   PORT = cổng CDP (chạy 2–3 tiến trình song song thì mỗi tiến trình một PORT khác nhau).
// Dev server không Firebase: NEXT_PUBLIC_FIREBASE_API_KEY= npm run dev (preview "en-dev-local").
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? join(tmpdir(), "video-frames");
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? "http://localhost:3012";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PORT ?? 9333);
const idx = JSON.parse(readFileSync(join(ROOT, "public/data/library/videos-index.json"), "utf8"));
const levelOf = new Map(idx.map((v) => [v.id, v.level]));
const argv = process.argv.slice(2);
const li = argv.indexOf("--level");
const lvl = li >= 0 ? argv[li + 1] : null; // a1..c2
const named = argv.filter((a, i) => !a.startsWith("--") && !(li >= 0 && i === li + 1));
const ids = named.length ? named : idx.filter((v) => lvl === null || v.level === lvl).map((v) => v.id);
const COLS = Number(process.env.COLS ?? 4);
const W = Number(process.env.W ?? 400);

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${join(tmpdir(), `video-frames-chrome-${PORT}`)}`,
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--window-size=1700,1200",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(path, method = "GET") {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method });
      return await r.json();
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
// Dev server: bỏ qua service worker (SWR phục vụ chunk JS cũ) + tắt cache → luôn thấy code/dữ liệu mới.
await send("Network.enable");
await send("Network.setBypassServiceWorker", { bypass: true });
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: COLS * W + 40, height: 1200, deviceScaleFactor: 1, mobile: false });

for (const id of ids) {
  await send("Page.navigate", { url: `${BASE}/video/${levelOf.get(id)}/${id}` });
  // chờ bài + asset cảnh
  let ok = false;
  for (let i = 0; i < 100 && !ok; i++) {
    await sleep(150);
    ok = await evaluate(`!!document.querySelector('audio') && document.querySelectorAll('svg[viewBox="0 0 1600 900"] *').length > 60`).catch(() => false);
  }
  if (!ok) {
    console.log(id, "✗ không tải được cảnh");
    continue;
  }
  const lesson = await (await fetch(`${BASE}/data/library/videos/${id}.json`)).json();
  const times = lesson.lines.map((l) => [Math.min(l.end - 0.05, l.start + Math.max(0.55, (l.end - l.start) * 0.55)), l]);
  await evaluate(`(() => {
    const g = document.createElement('div');
    g.id = '__grid';
    g.style.cssText = 'position:absolute;left:0;top:0;z-index:2147483647;background:#fff;display:grid;grid-template-columns:repeat(${COLS}, ${W}px);gap:8px;padding:12px;width:max-content;font:12px system-ui';
    document.body.appendChild(g);
    window.scrollTo(0,0);
    return true;
  })()`);
  for (const [t, l] of times) {
    const sp = Array.isArray(l.speaker) ? l.speaker.join("+") : l.speaker;
    const cap = `${lesson.lines.indexOf(l) + 1}. ${sp}: ${l.en}${l.expression ? " ·" + l.expression : ""}${l.gesture ? " ·" + l.gesture : ""}${l.thoughtBubble ? " ·💭" + l.thoughtBubble : ""}`;
    await evaluate(`(async () => {
      window.dispatchEvent(new WheelEvent('wheel')); // transcript nhường 4 s → không tự cuộn trang khi tua
      const a = document.querySelector('audio');
      await new Promise((r) => { a.addEventListener('seeked', r, { once: true }); a.currentTime = ${t}; setTimeout(r, 800); });
      await new Promise((r) => setTimeout(r, 180));
      const svg = document.querySelector('svg[viewBox="0 0 1600 900"]');
      const c = document.createElement('div');
      const s = svg.cloneNode(true);
      s.style.width = '${W}px'; s.style.height = '${(W * 9) / 16}px'; s.style.display = 'block';
      s.style.setProperty('--lit', svg.style.getPropertyValue('--lit'));
      c.appendChild(s);
      const p = document.createElement('div');
      p.textContent = ${JSON.stringify(cap)};
      p.style.cssText = 'width:${W}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#333';
      c.appendChild(p);
      document.getElementById('__grid').appendChild(c);
      return true;
    })()`);
  }
  const box = await evaluate(`(async () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    const r = document.getElementById('__grid').getBoundingClientRect();
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  })()`);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...box, scale: 1 } });
  writeFileSync(join(OUT, `${id}.png`), Buffer.from(shot.data, "base64"));
  console.log(id, "✓", `${lesson.lines.length} khung →`, join(OUT, `${id}.png`));
}
ws.close();
chrome.kill();
process.exit(0);
