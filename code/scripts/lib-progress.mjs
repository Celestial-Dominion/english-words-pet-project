// Thanh tiến độ cho các script chạy lâu (tải bài, sinh audio, build data).
// Ghi ra STDERR để không lẫn vào stdout (stdout dành cho dữ liệu, pipe được).
//
//   const p = progress(3000, "simplewiki");
//   p.tick();                       // +1
//   p.tick(5, "giữ 210");           // +5 kèm ghi chú
//   p.done("xong 210 bài");
//
// TTY  → vẽ 1 dòng tự cập nhật (\r), có % + ETA.
// Không TTY (chạy nền, ghi ra file) → in dòng mới mỗi ~5% để log không phình.

const isTTY = process.stderr.isTTY;

const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return "--";
  const m = Math.floor(s / 60);
  return m ? `${m}m${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`;
};

export function progress(total, label = "") {
  const start = Date.now();
  let cur = 0;
  let lastDraw = 0;
  let lastPct = -1;

  const draw = (note = "", force = false) => {
    const now = Date.now();
    // TTY: tối đa ~10 lần/giây. Không TTY: mỗi 5% một dòng.
    const pct = total ? Math.floor((cur / total) * 100) : 0;
    if (!force) {
      if (isTTY && now - lastDraw < 100) return;
      if (!isTTY && (pct < lastPct + 5 || pct === lastPct)) return;
    }
    lastDraw = now;
    lastPct = pct;

    const elapsed = (now - start) / 1000;
    const eta = cur > 0 && total ? (elapsed / cur) * (total - cur) : NaN;
    const stats = `${cur}/${total || "?"}${note ? ` · ${note}` : ""}`;

    if (isTTY) {
      const width = 24;
      const filled = total ? Math.round((cur / total) * width) : 0;
      const bar = "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
      const line = `  ${label.padEnd(12)} ${bar} ${String(pct).padStart(3)}%  ${stats}  ETA ${fmtTime(eta)}`;
      process.stderr.write(`\r\x1b[2K${line}`);
    } else {
      process.stderr.write(`  ${label}: ${String(pct).padStart(3)}%  ${stats}  ETA ${fmtTime(eta)}\n`);
    }
  };

  return {
    tick(n = 1, note = "") {
      cur += n;
      draw(note);
    },
    set(v, note = "") {
      cur = v;
      draw(note);
    },
    done(msg = "") {
      cur = total || cur;
      draw(msg, true);
      process.stderr.write(isTTY ? "\n" : "");
      if (msg && !isTTY) process.stderr.write(`  ${label}: ${msg}\n`);
    },
  };
}
