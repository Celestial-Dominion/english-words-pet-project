# Từ vựng tiếng Anh (B1–C2)

Web app cá nhân học từ vựng tiếng Anh trung cấp → thành thạo bằng phương pháp lặp lại
ngắt quãng (FSRS), offline-first (IndexedDB là nguồn sự thật), xuất tĩnh hoàn toàn,
đồng bộ đa thiết bị qua Firebase. Kế thừa kiến trúc từ app HSK + app tiếng Pháp.

Kế hoạch chi tiết: [`../plan/english_plan.md`](../plan/english_plan.md)

## Chạy local

```bash
npm install
npm run dev
```

App chạy đầy đủ offline, không cần Firebase (chỉ cần khi bật đồng bộ — Phase E7).

## Lệnh

- `npm run dev` — phát triển local
- `npm run build` — xuất tĩnh ra `out/`
- `npm run lint` — eslint
- `npm run test:e2e` — Playwright smoke test

## Cấu trúc

- `app/` — Next.js App Router (routes tiếng Việt: /hoc, /on-tap, /bai-doc, /tien-do, /tu-luyen…)
- `lib/` — logic thuần: FSRS (`srs.ts`), Dexie (`db.ts`), sync (`sync-data.ts`), gamify (Hải trình)
- `components/` — UI (review-runner là trái tim app)
- `scripts/` — pipeline dữ liệu (adapt từ app Pháp ở Phase E1–E2)
- `public/data/` — từ vựng/ví dụ/bài đọc (JSON tĩnh, sinh bằng pipeline)
- `public/audio/` — MP3 edge-tts giọng `en-US-AriaNeural` (build ở E2)

## Sinh lại dữ liệu tĩnh

Chạy theo thứ tự khi đổi bộ từ hoặc kho bài đọc (mọi script đều chạy lại được, không hỏng dữ liệu cũ):

```bash
node scripts/build-assemble.mjs      # words/ + word-levels + lemma-map (đã gồm luật dọn dạng bịa)
node scripts/build-readings.mjs      # readings/ + readings-index (lọc theo readings-blocklist.json)
node scripts/build-word-readings.mjs # chỉ mục từ→bài cho "Gặp lại trong ngữ cảnh" — chạy SAU build-readings
node scripts/build-audio-manifest.mjs
python3 scripts/build-audio.py out/audio-sentences.json ../public/audio/sentences   # chạy trong scripts/
```
