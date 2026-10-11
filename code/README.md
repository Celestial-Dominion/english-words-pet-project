# Từ vựng tiếng Anh (A1–C2)

Web app cá nhân học từ vựng tiếng Anh từ A1 → thành thạo C2 bằng phương pháp lặp lại
ngắt quãng (FSRS), offline-first (IndexedDB là nguồn sự thật), xuất tĩnh hoàn toàn,
đồng bộ đa thiết bị qua Firebase. Kế thừa kiến trúc từ app HSK + app tiếng Pháp.

Kế hoạch chi tiết: [`../plan/english_plan.md`](../plan/english_plan.md)

6 cấp học A1–C2 (`lib/levels.ts`): người mới học từ A1, Cài đặt → "Bắt đầu từ cấp" để bỏ qua các cấp dưới
(chỉ còn tra cứu). Người học từ trước khi có A1/A2 (10/2026, có thẻ B1–C2 cũ) mặc định vẫn bắt đầu B1.

## Chạy local

```bash
npm install
npm run dev
```

App chạy đầy đủ offline, không cần Firebase (chỉ cần khi bật đồng bộ — Phase E7).

## Lệnh

- `npm run dev` — phát triển local
- `npm run build` — xuất tĩnh ra `out/`
- `npm run lint` — eslint · `npm run check` — tsc + eslint + test logic/sync/học liệu
- `npm run test:e2e` — Playwright smoke test
- `npm run content:check` — kiểm học liệu nguồn (`content/`) · `content:coverage` / `content:gaps b1` — độ phủ từ
- `npm run content:build` — build Thư viện: JSON từng bài + audio (edge-tts) + chỉ mục từ→học liệu
- `npm run content:report` — số bài theo cấp, chủ đề, coverage, thời lượng, dung lượng thực đo

## Cấu trúc

- `app/` — Next.js App Router (routes tiếng Việt: /hoc, /on-tap, /tien-do, /tu-luyen…; Thư viện /doc →
  /bai-doc · /truyen · /video, mỗi mục chia 6 cấp A1–C2)
- `lib/` — logic thuần: FSRS (`srs.ts`), Dexie (`db.ts`), sync (`sync-data.ts`), gamify (Hải trình)
- `components/` — UI (review-runner là trái tim app)
- `scripts/` — pipeline dữ liệu (adapt từ app Pháp ở Phase E1–E2)
- `content/` — nguồn học liệu `{readings,stories,videos}/{cấp}/*.txt` (dòng "EN | VI"); quy ước ở
  `docs/ENGLISH_CONTENT_PLAYBOOK.md` và `docs/ENGLISH_VIDEO_PLAYBOOK.md`
- `public/data/` — từ vựng/ví dụ (JSON tĩnh) + `library/` (bài đọc/truyện/video, mỗi bài một JSON)
- `public/audio/` — MP3 edge-tts giọng `en-US-*`: từ, câu ví dụ, `library/` (bài đọc, chương truyện, video)

## Sinh lại dữ liệu tĩnh

Chạy theo thứ tự khi đổi bộ từ hoặc học liệu (mọi script đều chạy lại được, không hỏng dữ liệu cũ):

```bash
node scripts/build-assemble.mjs      # words/ + word-levels + lemma-map (đã gồm luật dọn dạng bịa)
npm run content:check                # học liệu nguồn không lỗi (✗) trước khi build
npm run content:build                # Thư viện: JSON + audio còn thiếu + word-refs, dọn file thừa (--prune)
node scripts/build-audio-manifest.mjs
python3 scripts/build-audio.py out/audio-sentences.json ../public/audio/sentences   # chạy trong scripts/
```

`content:build` chỉ sinh audio cho bài mới/đã sửa (khoá = hash chữ + giọng); bài chưa có audio chưa được xuất
bản. Venv TTS: `python3 -m venv scripts/.venv-tts && scripts/.venv-tts/bin/pip install edge-tts lameenc numpy`.
