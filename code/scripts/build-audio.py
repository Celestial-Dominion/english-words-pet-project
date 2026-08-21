#!/usr/bin/env python3
"""Sinh audio MP3 từ manifest bằng edge-tts (giọng en-US-AriaNeural — ĐÃ CHỐT, không đổi).

Dùng:
    python3 scripts/build-audio.py out/audio-words.json     ../public/audio/words
    python3 scripts/build-audio.py out/audio-sentences.json ../public/audio/sentences

Manifest = JSON list [{ "text": "...", "file": "xxxx.mp3", "voice": "..." (tuỳ chọn) }].
Không ghi "voice" thì dùng giọng mặc định; hội thoại 2 vai ghi giọng nam cho vai thứ 2.
Resume: bỏ qua file đã tồn tại & > 0 byte → chạy lại nhiều đợt an toàn.
"""
import asyncio
import json
import os
import sys
import time

import edge_tts

VOICE = "en-US-AriaNeural"
CONCURRENCY = 8

IS_TTY = sys.stderr.isatty()


def _fmt(sec):
    if sec is None or sec != sec or sec < 0:
        return "--"
    m = int(sec // 60)
    return f"{m}m{int(sec % 60):02d}s" if m else f"{int(sec)}s"


class Progress:
    """Thanh tiến độ: TTY vẽ 1 dòng tự cập nhật, chạy nền thì in mỗi 5%."""

    def __init__(self, total, label=""):
        self.total, self.label = total, label
        self.cur = 0
        self.start = time.time()
        self.last_draw = 0.0
        self.last_pct = -1

    def tick(self, n=1, note=""):
        self.cur += n
        now = time.time()
        pct = int(self.cur / self.total * 100) if self.total else 0
        if IS_TTY:
            if now - self.last_draw < 0.1 and self.cur < self.total:
                return
        elif pct < self.last_pct + 5:
            return
        self.last_draw, self.last_pct = now, pct

        elapsed = now - self.start
        eta = (elapsed / self.cur) * (self.total - self.cur) if self.cur else float("nan")
        stats = f"{self.cur}/{self.total}" + (f" · {note}" if note else "")
        if IS_TTY:
            width = 24
            filled = int(self.cur / self.total * width) if self.total else 0
            bar = "█" * filled + "░" * max(0, width - filled)
            print(f"\r\x1b[2K  {self.label:<12} {bar} {pct:>3}%  {stats}  ETA {_fmt(eta)}",
                  end="", file=sys.stderr, flush=True)
        else:
            print(f"  {self.label}: {pct:>3}%  {stats}  ETA {_fmt(eta)}", file=sys.stderr, flush=True)

    def done(self, msg=""):
        if IS_TTY:
            print(f"\r\x1b[2K  {self.label:<12} {msg}", file=sys.stderr, flush=True)
        elif msg:
            print(f"  {self.label}: {msg}", file=sys.stderr, flush=True)


async def synth(sem, text, out_path, stats, bar, voice=None):
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        stats["skip"] += 1
        bar.tick(1, f"{stats['ok']} mới · {stats['skip']} bỏ qua")
        return
    async with sem:
        for attempt in range(3):
            try:
                tmp = out_path + ".part"
                await edge_tts.Communicate(text, voice or VOICE).save(tmp)
                if os.path.getsize(tmp) == 0:
                    raise RuntimeError("empty audio")
                os.replace(tmp, out_path)
                stats["ok"] += 1
                bar.tick(1, f"{stats['ok']} mới · {stats['skip']} bỏ qua"
                            + (f" · {stats['err']} lỗi" if stats["err"] else ""))
                return
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    stats["err"] += 1
                    bar.tick(1, f"{stats['ok']} mới · {stats['err']} lỗi")
                    print(f"\n  LỖI '{text[:40]}': {e}", file=sys.stderr, flush=True)
                else:
                    await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    here = os.path.dirname(os.path.abspath(__file__))
    resolve = lambda p: p if os.path.isabs(p) else os.path.join(here, p)  # noqa: E731
    manifest_path, out_dir = resolve(sys.argv[1]), resolve(sys.argv[2])
    os.makedirs(out_dir, exist_ok=True)

    with open(manifest_path, encoding="utf-8") as f:
        items = json.load(f)
    print(f"Manifest: {len(items)} mục → {out_dir}", file=sys.stderr, flush=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    stats = {"ok": 0, "skip": 0, "err": 0}
    bar = Progress(len(items), os.path.basename(out_dir))
    await asyncio.gather(
        *(
            synth(sem, it["text"], os.path.join(out_dir, it["file"]), stats, bar, it.get("voice"))
            for it in items
        )
    )
    bar.done(f"XONG: {stats['ok']} mới, {stats['skip']} bỏ qua, {stats['err']} lỗi.")


if __name__ == "__main__":
    asyncio.run(main())
