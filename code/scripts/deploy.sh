#!/bin/zsh
# Deploy app lên Firebase Hosting: build → kiểm bundle có config Firebase → giữ mtime file tĩnh → ƯỚC LƯỢNG
# khối lượng + chọn số luồng → deploy → KIỂM BẢN LIVE → ghi số liệu vào .firebase/deploy-history.tsv.
# Cách chọn số luồng / đọc lịch sử / xử lý sự cố: DEPLOY.md mục "Deploy nhanh và an toàn".
# Tiến trình ghi vào scripts/.deploy.log (dòng "uploading new files [x/y] (p%)") — xem: scripts/deploy-watch.sh
# (in mỗi +5% rồi tự thoát; dùng làm lệnh Monitor khi deploy chạy nền).
#
#   npm run deploy                   build lại rồi deploy (= scripts/deploy.sh), số luồng tự chọn
#   SKIP_BUILD=1 scripts/deploy.sh   dùng out/ có sẵn (vừa build xong)
#   PLAN=1 scripts/deploy.sh         build + ước lượng + đề xuất số luồng rồi DỪNG (không deploy)
#   ACCOUNT=<email> scripts/deploy.sh   chỉ rõ tài khoản Firebase (khi chạy từ bản sao ở thư mục khác)
#   UPLINK_MBPS=50 scripts/deploy.sh    đợt nhiều file lớn: dùng số này thay vì đo tải lên (~15 s)
#   CONC=N scripts/deploy.sh         ép N luồng (4–200) — AI cân nhắc theo DEPLOY.md
#
# Mã build lấy từ băm mã nguồn (next.config.ts) → deploy chỉ có nội dung chỉ tải trang đổi + dữ liệu + MP3 mới.
set -e
cd "$(dirname "$0")/.."
LOG=scripts/.deploy.log
HIST=.firebase/deploy-history.tsv
mkdir -p .firebase
T0=$(date +%s)

if [[ -z "$SKIP_BUILD" ]]; then
  echo "▸ build…"
  rm -rf .next
  npm run build > scripts/.build.log 2>&1 || { tail -30 scripts/.build.log; echo "✗ build lỗi"; exit 1; }
  echo "  mã build: $(cat .next/BUILD_ID) ($(( $(date +%s) - T0 )) giây)"
fi

# Bắt buộc: bundle phải có authDomain VÀ API key — build thiếu .env.local vẫn chạy được nhưng tắt đồng bộ mà không báo lỗi
grep -rqF "english-words-pet.firebaseapp.com" out/_next/static/chunks/ || { echo "✗ bundle thiếu authDomain Firebase — DỪNG, kiểm .env.local"; exit 1; }
K=$(grep -E '^NEXT_PUBLIC_FIREBASE_API_KEY=' .env.local | cut -d= -f2-)
[[ -n "$K" ]] && grep -rqF "$K" out/_next/static || { echo "✗ bundle thiếu API key Firebase — DỪNG, kiểm .env.local rồi build lại"; exit 1; }
echo "▸ bundle có config Firebase ✓"

python3 scripts/out-mtime.py

# Kế hoạch: bao nhiêu file đổi, bao nhiêu file lớn → số luồng đề xuất (lý do: DEPLOY.md)
node scripts/deploy-plan.mjs > scripts/.deploy-plan.txt || { cat scripts/.deploy-plan.txt; echo "✗ không ước lượng được"; exit 1; }
grep -v '^PLAN ' scripts/.deploy-plan.txt
P=$(grep '^PLAN ' scripts/.deploy-plan.txt)
pv() { echo "$P" | grep -oE "$1=[0-9.]+" | cut -d= -f2 }
AUTO=$(pv conc)
if [[ -z "$CONC" ]]; then
  CONC=$AUTO
  echo "▸ số luồng: $CONC (tự chọn)"
else
  echo "▸ số luồng: $CONC (ép; tự chọn sẽ là $AUTO)"
fi
(( CONC >= 4 && CONC <= 200 )) || { echo "✗ CONC phải trong khoảng 4–200"; exit 1; }
[[ -n "$PLAN" ]] && { echo "▸ PLAN=1 → dừng ở đây, chưa deploy"; exit 0; }

[[ -f $HIST ]] || print -r -- $'thời điểm\tmã build\tluồng\tfile dự kiến\tMB\tfile ≥256KB\tfile đã tải\tthử lại\tlỗi tải\tHTTP lỗi\tphút tải\tfile/giây\tkết quả\tkiểm live\tMbps lên' > $HIST
# lịch sử cũ (14 cột) → thêm cột "Mbps lên" (tốc độ tải lên đo lúc lập kế hoạch; - = không đo)
head -1 $HIST | grep -q 'Mbps lên' || { awk -F'\t' 'BEGIN { OFS = "\t" } NR == 1 { print $0, "Mbps lên"; next } { print $0, "-" }' $HIST > $HIST.tmp && mv $HIST.tmp $HIST; }

# Deploy từ BẢN SAO ở thư mục khác (vd thử deploy khi thư mục chính đang có việc dở): firebase-tools gắn tài
# khoản Google theo thư mục nên phải chỉ rõ — ACCOUNT=<email> (xem `npx firebase login:list`).
acct=(); [[ -n "$ACCOUNT" ]] && acct=(--account "$ACCOUNT")
# DEBUG=true: firebase-tools ghi log debug (gồm thống kê hàng đợi tải: thử lại, lỗi, thời gian) — để đo chất lượng.
deploy_once() {
  rm -f firebase-debug.log
  DEBUG=true FIREBASE_HOSTING_UPLOAD_CONCURRENCY=$1 npx firebase deploy $acct --only hosting --non-interactive > $LOG 2>&1
}
# firebase-tools đôi khi ném "Timed out" SAU khi đã "Deploy complete!" (tác vụ phụ sau release — app Pháp
# 2026-10-10) → bản đã lên rồi; chỉ coi là lỗi khi log KHÔNG có dòng hoàn tất.
released() { grep -q "Deploy complete!" $LOG }
# Một dòng lịch sử cho lần chạy vừa xong: $1 = luồng, $2 = kết quả, $3 = kiểm live
record() {
  local F=$(grep -F "[hosting][upload queue][FINAL]" $LOG | tail -1 | grep -oE '\{.*\}')
  jv() { echo "$F" | grep -oE "\"$1\":[0-9.]+" | cut -d: -f2 }
  local total=$(jv total) retried=$(jv retried) errored=$(jv errored) ms=$(jv elapsed)
  local http=$(grep -cE "HTTP ERROR [0-9]+" $LOG || true)
  local mins=- rate=-
  # 0 file phải tải → firebase-tools báo elapsed tính từ mốc 0 (vô nghĩa) → bỏ
  if (( ${total:-0} == 0 )); then mins=0
  elif [[ -n "$ms" ]] && (( ms > 0 )); then
    mins=$(printf '%.1f' $(( ms / 60000.0 )))
    rate=$(printf '%.1f' $(( ${total:-0} * 1000.0 / ms )))
  fi
  local up=$(pv up); [[ -z "$up" || "$up" == 0 ]] && up=-
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date '+%Y-%m-%d %H:%M')" \
    "$(cat .next/BUILD_ID 2>/dev/null || echo -)" "$1" "$(pv files)" "$(pv mb)" "$(pv large)" \
    "${total:--}" "${retried:--}" "${errored:--}" "$http" "$mins" "$rate" "$2" "$3" "$up" >> $HIST
  echo "  số liệu: tải ${total:-0} file trong $mins phút ($rate file/giây) · thử lại ${retried:-0} · lỗi ${errored:-0} · HTTP lỗi $http"
}
# 28/09 (app HSK) lỗi quá hạn chờ hiện thành "Timed out" / "Converting circular structure to JSON"
UPLOAD_ERR='HTTP ERROR [0-9]+|Timed out|Unexpected error while uploading|circular structure|AbortError|ECONNRESET|ETIMEDOUT|socket hang up|RESOURCE_EXHAUSTED'

START=$(date +%s)
echo "▸ deploy (log: $LOG)…"
if ! deploy_once $CONC; then
  if released; then
    echo "⚠ firebase-tools báo lỗi sau khi đã release xong — bỏ qua ($(grep -m1 -o 'Error: .*' $LOG | cut -c1-200))"
  # Lỗi trong lúc TẢI thì bản live chưa đổi (Firebase chỉ phát hành khi tải đủ) → hạ luồng thử lại một lần;
  # file đã lên được server giữ, lần sau chỉ tải phần thiếu.
  elif grep -qE "$UPLOAD_ERR" $LOG; then
    tail -5 $LOG | cut -c1-300
    record $CONC "lỗi tải" -
    LOW=$(( CONC / 4 )); (( LOW < 4 )) && LOW=4
    echo "▸ lỗi khi tải ở $CONC luồng (bản live CHƯA đổi) → thử lại một lần với $LOW luồng"
    CONC=$LOW
    if ! deploy_once $CONC && ! released; then
      tail -5 $LOG | cut -c1-300; record $CONC "lỗi tải" -; rm -f firebase-debug.log
      echo "✗ deploy lỗi (bản live chưa đổi)"; exit 1
    fi
  else
    tail -20 $LOG | cut -c1-300; rm -f firebase-debug.log
    echo "✗ deploy lỗi"; exit 1
  fi
fi
rm -f firebase-debug.log # trùng nội dung với $LOG
grep -E "found [0-9]+ files" $LOG | head -1
U=$(grep -E "uploading new files" $LOG | tail -1); echo "${U:-  0 file mới cần tải}"
END=$(date +%s)
echo "✓ deploy xong sau $(( (END - START) / 60 )) phút $(( (END - START) % 60 )) giây (cả build: $(( (END - T0) / 60 )) phút $(( (END - T0) % 60 )) giây)"

# Kiểm bản live: tải lại trang chủ + mẫu file vừa đổi, so byte với out/. Ghi cả vào log để
# deploy-watch.sh báo được kết quả cuối (nó thoát ở dòng "số liệu").
if V=$(node scripts/deploy-verify.mjs 40); then R=khớp; else R=LỆCH; fi
{ echo "$V"; record $CONC "xong" "$R"; } | tee -a $LOG
[[ $R == khớp ]] || { echo "✗ bản live khác out/ — xem DEPLOY.md mục Khi có sự cố"; exit 1; }
