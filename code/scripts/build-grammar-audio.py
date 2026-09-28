#!/usr/bin/env python3
"""Audio bài Ngữ pháp (docs/ENGLISH_GRAMMAR_PLAYBOOK.md §8).

Đọc scripts/out/grammar-audio.json (build-grammar.mjs ghi) → MỘT MP3 mỗi bài vào public/audio/grammar/{id}.mp3
+ mốc thời gian scripts/.grammar-audio/{key}.json. Job đã có mốc (cùng key) thì bỏ qua → chạy lại bao nhiêu lần cũng
được, chỉ sinh bài mới / đã đổi phần đọc.

Tái dùng pipeline Video (build-content-audio.py): edge-tts có cache theo (giọng, tốc độ, pitch, chữ), cắt lặng, cân RMS
giữa các giọng, MP3 CBR mono 24 kHz (tua chính xác), giải mã lại đo trễ encoder rồi kiểm lời nằm đúng [start, end].
Khác Video: một đoạn lời giảng ghép nhiều mảnh (giọng Việt + tiếng Anh chen giữa) → cue = lúc bắt đầu mảnh tiếng Anh.

Chạy (trong code/):  scripts/.venv-tts/bin/python scripts/build-grammar-audio.py [--only <id>] [--jobs 6]
                     GRAMMAR_KBPS=48 (mặc định) — so sánh codec ở GRAMMAR_PLAYBOOK §8.
"""
import argparse
import asyncio
import hashlib
import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
_spec = importlib.util.spec_from_file_location("bca", os.path.join(HERE, "build-content-audio.py"))
bca = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bca)

MANIFEST = os.path.join(HERE, "out", "grammar-audio.json")
TIMING = os.path.join(HERE, ".grammar-audio")
CACHE = os.path.join(HERE, ".grammar-tts-cache")
AUDIO = os.path.join(ROOT, "public", "audio")
SR = bca.SR
KBPS = int(os.environ.get("GRAMMAR_KBPS", "48"))
LEAD_IN, TAIL = 0.4, 0.8
GAP_PART = 0.12  # giữa hai mảnh trong cùng một đoạn giảng (Việt ↔ Anh)
GAP_SENT = 0.3  # mảnh tiếng Việt vừa kết thúc câu (. ? ! :) rồi mới tới mảnh sau
for d in (TIMING, CACHE):
    os.makedirs(d, exist_ok=True)


def speakable(text):
    return any(ch.isalnum() for ch in text)


async def cached_tts(text, voice, rate, pitch, sem):
    tag = f"{voice}|{rate}|{pitch}|{text}"
    key = hashlib.sha1(tag.encode()).hexdigest()[:16]
    mp3p = os.path.join(CACHE, key + ".mp3")
    meta = os.path.join(CACHE, key + ".json")
    if not (os.path.exists(mp3p) and os.path.exists(meta)):
        # dịch vụ TTS thỉnh thoảng trả rỗng khi dồn nhiều yêu cầu → thử thêm vài vòng, giãn dần (như app HSK)
        for k in range(5):
            try:
                async with sem:
                    mp3, bounds = await bca.tts_stream(text, voice, rate, pitch)
                break
            except SystemExit as e:  # tts_stream báo hỏng bằng SystemExit — trong asyncio phải đổi thành Exception
                if k == 4:
                    raise RuntimeError(str(e)) from None
                await asyncio.sleep(8 * (k + 1))
        with open(mp3p, "wb") as fh:
            fh.write(mp3)
        with open(meta, "w") as fh:
            json.dump(bounds, fh)
    with open(meta) as fh:
        bounds = json.load(fh)
    return bca.decode_mp3(mp3p), bounds


async def build_job(job, sem):
    beats = job["beats"]
    uniq = {}
    for b in beats:
        for p in b["parts"]:
            if speakable(p["text"]):
                uniq[(p["text"], p["voice"], p["rate"], p.get("pitch", "+0Hz"))] = None
    keys = list(uniq)
    res = await asyncio.gather(*(cached_tts(*k, sem) for k in keys))
    got = dict(zip(keys, res))

    pcm = [np.zeros(int(LEAD_IN * SR))]
    cur = int(LEAD_IN * SR)
    out = []
    for i, b in enumerate(beats):
        if i > 0:
            g = int(b["gap"] * SR)
            pcm.append(np.zeros(g))
            cur += g
        part_start = {}
        first = None
        marks = None
        prev_end_sentence = False
        for pi, p in enumerate(b["parts"]):
            if not speakable(p["text"]):
                continue
            a, bounds = got[(p["text"], p["voice"], p["rate"], p.get("pitch", "+0Hz"))]
            clip, cut = bca.trim(a)
            clip = bca.normalize(clip)
            if first is not None:
                g = int((GAP_SENT if prev_end_sentence else GAP_PART) * SR)
                pcm.append(np.zeros(g))
                cur += g
            t0 = cur / SR
            if first is None:
                first = t0
            part_start[pi] = round(t0 + bca.PRE, 3)
            pcm.append(clip)
            cur += len(clip)
            if b.get("words") is not None:
                marks = bca.word_marks(b["words"], bounds, t0 - cut)
            prev_end_sentence = p.get("lang") == "vi" and p["text"].rstrip()[-1:] in ".?!:…"
        if first is None:
            raise RuntimeError(f"{job['id']}: đoạn {i + 1} không có tiếng")
        start, end = round(first + bca.PRE, 3), round(cur / SR - bca.POST, 3)
        o = {"start": start, "end": end}
        if marks is not None:
            o["timing"] = [[w, min(max(t, start), end)] for w, t in marks]
        cues = sorted(([tgt, part_start[pi]] for pi, tgt in b.get("cues", []) if pi in part_start), key=lambda x: x[1])
        if cues:
            o["cues"] = cues
        out.append(o)
    pcm.append(np.zeros(int(TAIL * SR)))
    full = np.concatenate(pcm)
    mp3 = bca.encode(full, KBPS)
    dec = bca.decode_bytes(mp3)
    lag = bca.measure_lag(full.astype(np.int16), dec) / SR
    if lag:
        for o in out:
            o["start"] = round(o["start"] + lag, 3)
            o["end"] = round(o["end"] + lag, 3)
            if "timing" in o:
                o["timing"] = [[w, round(t + lag, 3)] for w, t in o["timing"]]
            if "cues" in o:
                o["cues"] = [[g, round(t + lag, 3)] for g, t in o["cues"]]
    mouth = bca.mouth_envelope(np.concatenate([np.zeros(int(round(lag * SR)), dtype=np.int16), full.astype(np.int16)]))
    bad = bca.verify_video(dec, out)
    dst = os.path.join(AUDIO, job["out"])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as fh:
        fh.write(mp3)
    timing = {"key": job["key"], "file": job["out"], "v": hashlib.sha1(mp3).hexdigest()[:10], "duration": round(len(dec) / SR, 3), "fps": bca.FPS, "mouth": mouth, "beats": out}
    with open(os.path.join(TIMING, job["key"] + ".json"), "w") as fh:
        json.dump(timing, fh, separators=(",", ":"))
    nmark = sum(len(o.get("timing", [])) for o in out)
    nword = sum(len(b.get("words") or []) for b in beats)
    print(f"  ✓ {job['id']}: {timing['duration']:.1f}s · {len(beats)} đoạn · mốc từ {nmark}/{nword} · {'✓ đồng bộ' if not bad else f'⚠ {bad} chỗ lệch'} · {len(mp3) // 1024} KB", flush=True)
    return bad


def built(j):
    t = os.path.join(TIMING, j["key"] + ".json")
    return os.path.exists(t) and os.path.exists(os.path.join(AUDIO, j["out"]))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    if not os.path.exists(MANIFEST):
        sys.exit("Chưa có manifest — chạy node scripts/build-grammar.mjs trước")
    with open(MANIFEST) as fh:
        jobs = json.load(fh)
    want = set(a.only.split(",")) if a.only else None
    todo = [j for j in jobs if (not want or j["id"] in want) and not built(j)]
    print(f"{len(todo)} bài cần sinh audio / {len(jobs)} trong manifest", flush=True)
    sem = asyncio.Semaphore(a.jobs)
    bad = 0

    async def run(j):
        nonlocal bad
        try:
            r = await build_job(j, sem)
            bad += r
        except Exception as e:  # noqa: BLE001 — một bài hỏng không được kéo sập cả lượt build
            print(f"  ✗ {j['id']}: {e}", flush=True)
            bad += 1

    await asyncio.gather(*(run(j) for j in todo))
    print(f"xong · {'không lệch' if not bad else f'{bad} cảnh báo lệch'}")


if __name__ == "__main__":
    asyncio.run(main())
