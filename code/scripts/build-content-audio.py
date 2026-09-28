#!/usr/bin/env python3
"""Audio học liệu (docs/ENGLISH_CONTENT_PLAYBOOK.md §7, docs/ENGLISH_VIDEO_PLAYBOOK.md §3).

Đọc scripts/out/content-audio.json (do build-content.mjs ghi) → MP3 vào public/audio/library/**
+ mốc thời gian scripts/.content-audio/{key}.json. Job đã có mốc (cùng key) thì bỏ qua → chạy lại
được bất cứ lúc nào, chỉ sinh phần mới/đổi.

  passage: bài đọc / chương truyện = MỘT request edge-tts cho cả bài (ngữ điệu liền mạch), MP3
           48 kbps CBR giữ nguyên (không mã hoá lại), mốc câu = WordBoundary (edge-tts bù offset
           giữa các chunk theo số byte CBR nên chính xác cả với bài dài).
  video:   từng lượt một giọng nhân vật (cache theo giọng+tốc độ+pitch+chữ) → cắt lặng → cân RMS
           giữa các giọng → đồng thanh thì trộn → ghép, nghỉ 0,7 s khi đổi người / 0,45 s cùng người
           → MP3 CBR 64 kbps mono 24 kHz; start/end đo trên PCM, mốc từ = WordBoundary, đường bao
           miệng 25 khung/s; giải mã lại để bù trễ encoder và kiểm lời nằm đúng [start, end].

Chạy (trong code/):  scripts/.venv-tts/bin/python scripts/build-content-audio.py [--kind passage|video]
                     [--only <tiền tố id>] [--jobs 6] [--verify]
Cần: scripts/.venv-tts (edge-tts, lameenc, numpy); giải mã MP3 bằng afconvert (macOS) hoặc ffmpeg.
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

import edge_tts
import lameenc
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
MANIFEST = os.path.join(HERE, "out", "content-audio.json")
TIMING = os.path.join(HERE, ".content-audio")
LINE_CACHE = os.path.join(HERE, ".video-tts-cache")
AUDIO = os.path.join(ROOT, "public", "audio", "library")

SR = 24000
PASSAGE_KBPS = 48  # đúng bitrate edge-tts trả về → giữ nguyên byte, không suy hao
VIDEO_KBPS = 64  # video phải mã hoá lại sau khi ghép: 64 kbps để không nghe thấy suy hao thế hệ 2
LEAD_IN, TAIL = 0.5, 1.0
GAP_OTHER, GAP_SAME = 0.7, 0.45
PRE, POST = 0.03, 0.06
FPS = 25
TARGET_RMS_DB, PEAK_DB, SILENCE_DB = -19.0, -1.5, -45.0

for d in (TIMING, LINE_CACHE, AUDIO):
    os.makedirs(d, exist_ok=True)


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower().replace("’", "'"))


# ---------- TTS ----------

async def tts_stream(text, voice, rate, pitch="+0Hz"):
    """→ (mp3 bytes, [[giây, thời lượng, chữ]]). Thử lại khi mạng chập chờn."""
    for attempt in range(5):
        try:
            data = bytearray()
            bounds = []
            async for c in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch or "+0Hz", boundary="WordBoundary").stream():
                if c["type"] == "audio":
                    data.extend(c["data"])
                elif c["type"] == "WordBoundary":
                    bounds.append([c["offset"] / 1e7, c["duration"] / 1e7, c["text"]])
            if not data:
                raise RuntimeError("không có audio")
            # edge-tts đôi khi đóng stream sớm mà không báo lỗi → audio cụt: đối chiếu chữ đã có mốc với văn bản
            want, got = len(norm(text)), sum(len(norm(b[2])) for b in bounds)
            if want > 40 and got < 0.9 * want:
                raise RuntimeError(f"audio cụt, mốc phủ {got}/{want} ký tự")
            # …hoặc đủ mốc chữ nhưng thiếu byte audio ở đuôi (mốc cuối vượt độ dài file, gặp 2/1417 track)
            secs = len(data) * 8 / (PASSAGE_KBPS * 1000)
            if bounds and secs < bounds[-1][0] + bounds[-1][1] - 0.05:
                raise RuntimeError(f"audio cụt đuôi, {secs:.1f}s < mốc cuối {bounds[-1][0] + bounds[-1][1]:.1f}s")
            return bytes(data), bounds
        except Exception as e:  # noqa: BLE001
            print(f"  TTS lỗi ({e}), thử lại {attempt + 1}…", flush=True)
            await asyncio.sleep(2 * (attempt + 1))
    raise SystemExit(f"TTS thất bại: {voice} {text[:60]}")


def decode_mp3(path):
    """MP3 → np.int16 mono 24 kHz (afconvert trên macOS, ffmpeg nếu có)."""
    if shutil.which("ffmpeg"):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], check=True, capture_output=True).stdout
        return np.frombuffer(raw, dtype=np.int16).copy()
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "x.wav")
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "1", path, wav], check=True)
        with wave.open(wav) as w:
            assert w.getframerate() == SR and w.getnchannels() == 1
            return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).copy()


def decode_bytes(b):
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as fh:
        fh.write(b)
        p = fh.name
    try:
        return decode_mp3(p)
    finally:
        os.remove(p)


# ---------- PCM ----------

def frames_rms(a, n):
    m = len(a) // n
    if m == 0:
        return np.zeros(0)
    x = a[: m * n].astype(np.float64).reshape(m, n) / 32768.0
    return np.sqrt((x * x).mean(axis=1))


def speech_bounds(a):
    n = SR // 100
    r = frames_rms(a, n)
    on = np.nonzero(r > 10 ** (SILENCE_DB / 20))[0]
    if not len(on):
        return 0, len(a)
    return int(on[0]) * n, min(len(a), (int(on[-1]) + 1) * n)


def trim(a):
    s, e = speech_bounds(a)
    s0 = max(0, s - int(PRE * SR))
    e0 = min(len(a), e + int(POST * SR))
    out = a[s0:e0].astype(np.float64)
    fade = min(int(0.008 * SR), len(out) // 2)
    if fade:
        g = np.linspace(0, 1, fade)
        out[:fade] *= g
        out[-fade:] *= g[::-1]
    return out, s0 / SR


def normalize(x):
    n = SR // 100
    r = frames_rms(x.astype(np.int16) if x.dtype != np.int16 else x, n)
    act = r[r > 10 ** (SILENCE_DB / 20)]
    rms = float(np.sqrt((act * act).mean())) if len(act) else 1e-3
    peak = max(1.0, float(np.abs(x).max())) / 32768.0
    g = min(10 ** ((TARGET_RMS_DB - 20 * np.log10(max(rms, 1e-9))) / 20), 10 ** (PEAK_DB / 20) / peak)
    return np.clip(x * g, -32768, 32767)


def mix(clips):
    n = max(len(c) for c in clips)
    acc = np.zeros(n)
    for c in clips:
        acc[: len(c)] += c * 0.72
    return normalize(np.clip(acc, -32768, 32767))


def mouth_envelope(a):
    n = SR // FPS
    r = frames_rms(np.concatenate([a, np.zeros(n - len(a) % n, dtype=np.int16)]) if len(a) % n else a, n)
    out, prev = [], 0.0
    for v in r:
        x = (20 * np.log10(max(v, 1e-9)) + 46) / 30
        x = max(0.0, min(1.0, x))
        x = max(x, prev * 0.55)
        prev = x
        out.append(str(int(round(x * 9))))
    return "".join(out)


def encode(a, kbps):
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(SR)
    enc.set_out_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = np.clip(a, -32768, 32767).astype(np.int16).tobytes()
    return bytes(enc.encode(pcm) + enc.flush())


def measure_lag(src, dec):
    s, _ = speech_bounds(src)
    w = SR // 2
    ref = np.abs(src[s : s + w].astype(np.float64))[::4]
    best, lag = -1.0, 0
    for d in range(0, 3000, 8):
        seg = dec[s + d : s + d + w]
        if len(seg) < w:
            break
        c = float((ref * np.abs(seg.astype(np.float64))[::4]).sum())
        if c > best:
            best, lag = c, d
    return lag


# ---------- passage ----------

def align_sentences(sentences, bounds):
    """WordBoundary → (starts, ends, lệch). Tiêu thụ tuần tự theo chữ đã chuẩn hoá."""
    n = len(sentences)
    starts, ends = [None] * n, [None] * n
    rems = [norm(s) for s in sentences]
    si, rem, miss = 0, rems[0] if n else "", 0
    for off, dur, txt in bounds:
        t = norm(txt)
        if not t:
            continue
        while si < n and not rem:
            si += 1
            rem = rems[si] if si < n else ""
        if si >= n:
            break
        k = rem.find(t)
        if k < 0 or k > 12:
            nxt = rems[si + 1] if si + 1 < n else ""
            if nxt.find(t) == 0:
                si += 1
                rem, k = nxt, 0
            else:
                miss += 1
                continue
        if starts[si] is None:
            starts[si] = off
        ends[si] = off + dur
        rem = rem[k + len(t):]
    # câu không có mốc (hiếm) → nội suy giữa hai câu kề
    for i in range(n):
        if starts[i] is None:
            prev_end = ends[i - 1] if i and ends[i - 1] is not None else 0.0
            nxt = next((starts[j] for j in range(i + 1, n) if starts[j] is not None), prev_end + 1.0)
            starts[i], ends[i] = prev_end + 0.05, max(prev_end + 0.1, nxt - 0.05)
            miss += 1
    return [round(x, 3) for x in starts], [round(x, 3) for x in ends], miss


async def build_passage(job, sem, verify):
    sentences = [s for p in job["paras"] for s in p]
    text = "\n".join(" ".join(p) for p in job["paras"])
    async with sem:
        mp3, bounds = await tts_stream(text, job["voice"], job["rate"])
    starts, ends, miss = align_sentences(sentences, bounds)
    out = os.path.join(AUDIO, job["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as fh:
        fh.write(mp3)
    duration = round(len(mp3) * 8 / (PASSAGE_KBPS * 1000), 3)
    bad = 0
    if verify:
        dec = decode_mp3(out)
        duration = round(len(dec) / SR, 3)
        n = SR // 100
        r = frames_rms(dec, n)
        th = 10 ** (SILENCE_DB / 20)
        for s in starts:
            i0, i1 = max(0, int((s - 0.2) * 100)), int((s + 0.25) * 100)
            if not (r[i0:i1] > th).any():
                bad += 1
    timing = {"key": job["key"], "file": job["out"], "v": hashlib.sha1(mp3).hexdigest()[:10], "duration": duration, "starts": starts, "ends": ends}
    with open(os.path.join(TIMING, job["key"] + ".json"), "w") as fh:
        json.dump(timing, fh, separators=(",", ":"))
    flag = "" if not (miss or bad) else f"  ⚠ lệch {miss} từ, {bad} câu không thấy tiếng ở mốc"
    print(f"  ✓ {job['out']} {duration:.1f}s {len(sentences)} câu{flag}", flush=True)
    return miss + bad


# ---------- video ----------

async def line_tts(text, voice, rate, pitch, sem):
    tag = f"{voice}|{rate}|{pitch}|{text}"
    key = hashlib.sha1(tag.encode()).hexdigest()[:16]
    mp3p = os.path.join(LINE_CACHE, key + ".mp3")
    meta = os.path.join(LINE_CACHE, key + ".json")
    if not (os.path.exists(mp3p) and os.path.exists(meta)):
        async with sem:
            mp3, bounds = await tts_stream(text, voice, rate, pitch)
        with open(mp3p, "wb") as fh:
            fh.write(mp3)
        with open(meta, "w") as fh:
            json.dump(bounds, fh)
    with open(meta) as fh:
        bounds = json.load(fh)
    return decode_mp3(mp3p), bounds


def word_marks(words, bounds, t0):
    """WordBoundary (giây trong clip) → [[chỉ số từ, giây tuyệt đối]]."""
    marks, wi = [], 0
    nw = [norm(w) for w in words]
    for off, _dur, txt in bounds:
        t = norm(txt)
        if not t:
            continue
        j = wi
        while j < len(nw) and not (nw[j] == t or nw[j].startswith(t) or t.startswith(nw[j])):
            j += 1
        if j >= len(nw) or j - wi > 3:
            continue
        marks.append([j, round(t0 + off, 3)])
        wi = j + 1
    return marks


async def build_video(job, sem, verify):
    lines = job["lines"]
    # TTS mọi lượt song song (mỗi giọng một clip)
    tasks = [[line_tts(l["text"], v["voice"], v["rate"], v["pitch"], sem) for v in l["voices"]] for l in lines]
    results = [await asyncio.gather(*t) for t in tasks]
    pcm = [np.zeros(int(LEAD_IN * SR))]
    cur = int(LEAD_IN * SR)
    out_lines = []
    for i, (l, res) in enumerate(zip(lines, results)):
        clips, bounds0, cut0 = [], None, 0.0
        for a, bounds in res:
            t, cut = trim(a)
            clips.append(normalize(t))
            if bounds0 is None:
                bounds0, cut0 = bounds, cut
        clip = clips[0] if len(clips) == 1 else mix(clips)
        if i > 0:
            gap = l.get("pause", GAP_SAME if l.get("same") else GAP_OTHER)
            pcm.append(np.zeros(int(gap * SR)))
            cur += int(gap * SR)
        t0 = cur / SR
        pcm.append(clip)
        cur += len(clip)
        start, end = round(t0 + PRE, 3), round(cur / SR - POST, 3)
        marks = [[w, min(max(t, start), end)] for w, t in word_marks(l["words"], bounds0, t0 - cut0)]
        out_lines.append({"start": start, "end": end, "timing": marks})
    pcm.append(np.zeros(int(TAIL * SR)))
    full = np.concatenate(pcm)
    mp3 = encode(full, VIDEO_KBPS)
    dec = decode_bytes(mp3)
    lag = measure_lag(full.astype(np.int16), dec) / SR
    if lag:
        for l in out_lines:
            l["start"] = round(l["start"] + lag, 3)
            l["end"] = round(l["end"] + lag, 3)
            l["timing"] = [[w, round(t + lag, 3)] for w, t in l["timing"]]
    mouth = mouth_envelope(np.concatenate([np.zeros(int(round(lag * SR)), dtype=np.int16), full.astype(np.int16)]))
    bad = verify_video(dec, out_lines)
    out = os.path.join(AUDIO, job["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as fh:
        fh.write(mp3)
    timing = {"key": job["key"], "file": job["out"], "v": hashlib.sha1(mp3).hexdigest()[:10], "duration": round(len(dec) / SR, 3), "fps": FPS, "mouth": mouth, "lines": out_lines}
    with open(os.path.join(TIMING, job["key"] + ".json"), "w") as fh:
        json.dump(timing, fh, separators=(",", ":"))
    nmark = sum(len(l["timing"]) for l in out_lines)
    nword = sum(len(l["words"]) for l in lines)
    print(f"  ✓ {job['out']} {timing['duration']:.1f}s {len(lines)} lượt · mốc từ {nmark}/{nword} · {'✓ đồng bộ' if not bad else f'⚠ {bad} chỗ lệch'} · {len(mp3) // 1024} KB", flush=True)
    return bad


def verify_video(dec, lines):
    n = SR // 100
    r = frames_rms(dec, n)
    th = 10 ** (SILENCE_DB / 20)
    bad = 0
    for i, l in enumerate(lines):
        s, e = int(l["start"] * 100), int(l["end"] * 100)
        seg = np.nonzero(r[max(0, s - 20): e + 20] > th)[0]
        if not len(seg):
            bad += 1
            continue
        on, off = (seg[0] + max(0, s - 20)) / 100, (seg[-1] + 1 + max(0, s - 20)) / 100
        if abs(on - l["start"]) > 0.05 or abs(off - l["end"]) > 0.06:
            bad += 1
        if i + 1 < len(lines):
            g0, g1 = e + 8, int(lines[i + 1]["start"] * 100) - 6
            if g1 > g0 and (r[g0:g1] > th).any():
                bad += 1
    return bad


# ---------- main ----------

def built(j):
    """Đã có audio + mốc hợp lệ. Bài đọc/chương có mốc câu cuối vượt độ dài file (audio cụt) → sinh lại."""
    t = os.path.join(TIMING, j["key"] + ".json")
    if not (os.path.exists(t) and os.path.exists(os.path.join(AUDIO, j["out"]))):
        return False
    if j["kind"] != "passage":
        return True
    with open(t) as fh:
        d = json.load(fh)
    return bool(d.get("ends")) and d["ends"][-1] <= d["duration"] + 0.05


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["passage", "video"])
    ap.add_argument("--only", default="")
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    with open(MANIFEST) as fh:
        jobs = json.load(fh)
    todo = [j for j in jobs if (not a.kind or j["kind"] == a.kind) and os.path.basename(j["out"]).startswith(a.only) and not built(j)]
    if a.limit:
        todo = todo[: a.limit]
    print(f"{len(todo)} track cần sinh / {len(jobs)} trong manifest", flush=True)
    sem = asyncio.Semaphore(a.jobs)
    bad = 0

    async def run(j):
        nonlocal bad
        try:
            r = await (build_passage(j, sem, a.verify) if j["kind"] == "passage" else build_video(j, sem, a.verify))
            bad += r  # cộng SAU await: `bad += await …` đọc bad trước khi chờ → các job song song ghi đè nhau
        except SystemExit as e:
            print(f"  ✗ {j['out']}: {e}", flush=True)
            bad += 1

    # passage: song song theo job; video: mỗi job đã song song các lượt bên trong
    await asyncio.gather(*(run(j) for j in todo))
    print(f"xong · {'không lệch' if not bad else f'{bad} cảnh báo lệch'}")


if __name__ == "__main__":
    asyncio.run(main())
