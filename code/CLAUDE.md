@AGENTS.md

## Deploy

Luôn deploy bằng `scripts/deploy.sh` (= `npm run deploy`) và đọc `DEPLOY.md` mục "Deploy nhanh và an toàn" trước:
các bước giữ chất lượng bắt buộc, theo dõi bằng `scripts/deploy-watch.sh`, và mục "Chọn số luồng" — AI được tự chọn
`CONC` (4–200) theo kế hoạch của `scripts/deploy-plan.mjs` + lịch sử đo ở `.firebase/deploy-history.tsv`.
