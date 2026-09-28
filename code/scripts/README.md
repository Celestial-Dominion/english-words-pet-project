# Pipeline dữ liệu (Phase E1–E2)

Chạy theo thứ tự. Các bước nặng đều **resume được** / chạy lại an toàn.

## E1 — từ vựng

```sh
# 1. Nguồn (1 lần)
python3 scripts/dump-wordfreq.py                    # tần suất Zipf -> out/wordfreq-en.tsv
sh scripts/dump-proper-names.sh                     # danh từ riêng -> out/proper-names.txt
curl -sL "https://huggingface.co/datasets/DataDock/wiktextract/resolve/main/2026-07-06.jsonl.gz" \
  | python3 scripts/filter-kaikki.py --stdin        # Wiktextract -> out/kaikki-filtered.jsonl (~15 phút)

# 2. Gán cấp + enrich
node scripts/build-words-stage1.mjs                 # -> out/words-stage1.json
node scripts/fill-ipa.mjs                           # ghép IPA cho từ ghép/đa từ

# 3. Nghĩa Việt (agent dịch)
node scripts/prep-vi-batches.mjs 1                  # chia batch cho 1 cấp (0=nền,1=B1..4=C2)
#    -> agent đọc vi-batches/INSTRUCTIONS.md, ghi kết quả vào vi-done/
node scripts/check-vi.mjs                           # QA máy: độ phủ, format, nghĩa trùng

# 4. Xuất ra app
node scripts/build-assemble.mjs                     # -> public/data/{words,words-index,word-levels,lemma-map}
```

## E2 — câu ví dụ & audio

```sh
node scripts/prep-ex-batches.mjs 1                  # chia batch câu ví dụ (60 từ/batch)
#    -> agent đọc ex-batches/INSTRUCTIONS.md, ghi kết quả vào ex-done/
node scripts/build-examples.mjs                     # -> public/data/examples/{cefr}-{0..7}.json

node scripts/build-audio-manifest.mjs b1            # -> out/audio-{words,sentences}.json
python3 scripts/build-audio.py out/audio-words.json     ../public/audio/words
python3 scripts/build-audio.py out/audio-sentences.json ../public/audio/sentences
```

Giọng TTS **đã chốt: `en-US-AriaNeural`** — đổi giọng = build lại toàn bộ audio.
`build-audio.py` resume được (bỏ qua file đã có) nên chạy nhiều đợt thoải mái.

## E5 — Thư viện: bài đọc · truyện · video

Nguồn: `content/{readings,stories,videos}/{a1..c2}/*.txt` (định dạng + quy ước: `docs/ENGLISH_CONTENT_PLAYBOOK.md`,
`docs/ENGLISH_VIDEO_PLAYBOOK.md`). Thông số theo cấp nằm ở `lib/content-spec.mjs`.

```sh
node scripts/check-content.mjs [--level c2] [--id rd-…] [--draft]   # ✗ lỗi chặn build · ! cảnh báo
node scripts/content-coverage.mjs                    # độ phủ từ đích theo cấp (R/S/V, ≥2 ngữ cảnh, ≥2 loại)
node scripts/content-coverage.mjs --gaps b1 300      # từ đích chưa gặp / mới 1 ngữ cảnh, theo tần suất
node scripts/content-coverage.mjs --topics c1        # phân bố chủ đề / thể loại / độ dài
npm run content:build                                # = build-content → build-content-audio.py → build-content --prune
node scripts/content-report.mjs [--topics]           # số bài, coverage, phút audio, dung lượng → out/content-report.json
BASE=http://localhost:3012 node scripts/video-frames.mjs --level c2   # contact sheet soát hình video (dev server)
```

- `build-content-audio.py` resume được: bỏ qua track đã có mốc hợp lệ; bài có mốc câu cuối vượt độ dài file (luồng
  edge-tts bị cụt đuôi) tự sinh lại. `--kind passage|video`, `--only <tiền tố id>`, `--verify` (đo lại trên PCM).
- Cache: `scripts/.content-audio/` (mốc thời gian), `scripts/.video-tts-cache/` (từng lượt thoại) — xoá = sinh lại.

## Ghi chú

`patch-missing.py`: vá từ bị rớt khỏi dump lớn (tháng, thứ, ca lẻ) bằng kaikki per-word API.
Đầu vào là danh sách từ qua stdin.

## Nguồn & giấy phép

| File | Nguồn | Giấy phép |
|---|---|---|
| `cefrj-a1b2.csv` | CEFR-J Wordlist 1.5 (openlanguageprofiles) | CC BY-SA |
| `octanove-c1c2.csv` | Octanove Vocabulary Profile C1/C2 1.0 | CC BY-SA |
| `en_50k.txt` | FrequencyWords / OpenSubtitles 2018 | CC BY-SA |
| wordfreq | thư viện Python (Robyn Speer) | MIT |
| Wiktextract / kaikki.org | Wiktionary | CC BY-SA |
