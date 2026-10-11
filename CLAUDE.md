# Bản đồ dự án tiếng Anh (đọc trước, đỡ phải mò)

- Repo git là thư mục này. App ở `code/`, kế hoạch ở `plan/` (`plan/english_plan.md`).
- App Next.js 16 xuất tĩnh: `code/app`, `code/components`, `code/lib` (logic thuần). Nội dung nguồn: `code/content/` (grammar, quiz, readings, stories, videos).
- Pipeline nội dung + test: `code/scripts/*.mjs` (Node). File `.py` chạy bằng venv trong `code/scripts/.venv-tts` hoặc `code/scripts/.venv`.
- Làm nội dung: đọc playbook tương ứng trong `code/docs/ENGLISH_*_PLAYBOOK.md`.
- Deploy: chỉ dùng `npm run deploy` (= `code/scripts/deploy.sh`), đọc `code/DEPLOY.md` trước (chi tiết ở `code/CLAUDE.md`).

## Lệnh (chạy trong `code/`)

- Kiểm tra toàn bộ sau khi sửa: `npm run check` (tsc + eslint + test).
- Một test: `node --experimental-strip-types --no-warnings scripts/test-<tên>.mjs` (script Node thuần, import thẳng file `.ts`).
- E2E: `npm run test:e2e` (Playwright, cần dev server) — chỉ chạy khi được yêu cầu.

## Tránh

- Dữ liệu lớn: `code/public/data` (2k file JSON, có trong git), `code/public/audio`, `code/scripts/out`, `code/out`, `code/.next`.
- Tìm code thì giới hạn thư mục: `rg -n 'X' code/app code/components code/lib code/scripts`.
- File JSON dữ liệu: dùng `jq` lấy đúng phần cần, không Read cả file.
