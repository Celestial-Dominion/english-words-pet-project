# Triển khai (Phase E7)

App chạy hoàn chỉnh **offline không cần Firebase** — Firebase chỉ để đồng bộ tiến độ giữa
thiết bị. Toàn bộ hạ tầng nằm trong hạn mức miễn phí (Spark), **không cần gắn thẻ**.

## 1. Tạo Firebase project (làm trên console — cần tài khoản Google của bạn)

1. Vào <https://console.firebase.google.com> → **Add project** → đặt tên, ví dụ `english-words`.
   Tắt Google Analytics cho gọn.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** → Save.
3. **Build → Firestore Database → Create database** → chọn **Production mode** → vùng gần bạn
   (`asia-southeast1`).
4. **⚙ Project settings → Your apps → Web (`</>`)** → đặt nickname → **Register app** →
   copy khối `firebaseConfig`.

## 2. Điền cấu hình

```bash
cp .env.local.example .env.local
```

Điền 6 giá trị từ `firebaseConfig` vào `.env.local`. Để trống `NEXT_PUBLIC_OWNER_UID` ở bước này.

> Config web Firebase là **công khai theo thiết kế** (bị inline vào bản build tĩnh).
> Bảo mật thật nằm ở Auth + Firestore Rules, không phải ở việc giấu config.

## 3. Trỏ CLI vào project

```bash
npx firebase-tools login
npx firebase-tools use --add    # chọn project vừa tạo, alias: default
```

## 4. Deploy lần đầu

```bash
npm run check     # typecheck + lint + unit test
npm run deploy    # = scripts/deploy.sh: build tĩnh + kiểm config Firebase trong bundle + đẩy hosting
```

Lần đầu **rất lâu** vì có ~70.000 file audio (~3 GB).

`scripts/deploy.sh` (log: `scripts/.deploy.log`, theo dõi: `scripts/deploy-watch.sh`) giữ deploy sau đó nhanh:

- Mã build băm từ mã nguồn (`next.config.ts` → `generateBuildId`), không tính `public/`, `content/` và
  `lib/library-labels.ts` → đợt chỉ thêm nội dung thì chỉ trang đổi phải tải lại; sửa code thì mã đổi.
- `scripts/out-mtime.py` trả ngày sửa gốc cho file chép từ `public/` → firebase-tools không băm lại audio.
- Số luồng tự chọn theo kế hoạch (8 / 32 / 100), AI được ép `CONC=…` — xem mục ngay dưới. `SKIP_BUILD=1` dùng
  `out/` có sẵn.

### Deploy nhanh và an toàn — các bước giữ chất lượng (không được bỏ)

Luôn deploy bằng `scripts/deploy.sh` (= `npm run deploy`), không gọi thẳng `firebase deploy`:

```bash
npm run deploy                    # build → kiểm → kế hoạch → tải → kiểm bản live → ghi lịch sử
SKIP_BUILD=1 scripts/deploy.sh    # dùng out/ vừa build
PLAN=1 scripts/deploy.sh          # build + kế hoạch + số luồng đề xuất rồi DỪNG (không deploy)
CONC=150 scripts/deploy.sh        # ép số luồng (4–200)
ACCOUNT=<email> scripts/deploy.sh # chỉ rõ tài khoản Firebase (chạy từ bản sao ở thư mục khác)
scripts/deploy-watch.sh           # lệnh Monitor: mỗi pha + mỗi 5% tải + lỗi tải + kết quả kiểm live, tự thoát
```

1. **Config Firebase trong bundle** — phải có cả authDomain lẫn API key; thiếu là DỪNG.
2. **Giữ mtime** (`scripts/out-mtime.py`) — firebase-tools không phải băm lại audio.
3. **Kế hoạch** (`scripts/deploy-plan.mjs`) — so `out/` với bộ nhớ đệm băm của firebase-tools
   (`.firebase/hosting.b3V0.cache`) đúng cách firebase-tools làm (gzip 9 + sha256) → biết trước số file sẽ tải,
   bao nhiêu MB, bao nhiêu file lớn (≥256 KB), số luồng đề xuất. Danh sách file đổi: `scripts/.deploy-changed.txt`.
4. **Tải** — Firebase chỉ phát hành khi đã tải ĐỦ file; lỗi giữa chừng thì bản live không đổi. Gặp lỗi tải
   (timeout, HTTP 5xx/429…), script tự hạ còn ¼ số luồng (tối thiểu 4) và thử lại MỘT lần; file đã lên server
   được giữ. firebase-tools đôi khi báo "Timed out" SAU khi đã "Deploy complete!" → coi là xong.
5. **Kiểm bản live** (`scripts/deploy-verify.mjs`) — tải về trang chủ, trang Ôn tập và 40 file ngẫu nhiên trong
   số file vừa đổi, so sha256 với `out/`. Lệch là báo ✗.
6. **Ghi lịch sử** vào `.firebase/deploy-history.tsv` (chỉ ở máy deploy, không commit): số luồng, file dự
   kiến/đã tải, MB, file lớn, **thử lại**, **lỗi tải**, **HTTP lỗi**, phút tải, **file/giây**, kết quả, kiểm
   live. Số thử lại/lỗi lấy từ thống kê hàng đợi của firebase-tools (chạy với `DEBUG=true`, nên log có dòng
   debug mở đầu `[2026-…Z]`; `deploy-watch.sh` đã bỏ qua chúng).

### Chọn số luồng — AI được tự cân nhắc

Mục tiêu: tải **nhanh nhất mà không làm tăng thử lại/lỗi**. AI (Claude) được tự chọn `CONC` trong khoảng
4–200 mà không cần hỏi, với điều kiện chạy qua `scripts/deploy.sh` (đủ 6 bước trên) và khi báo user thì nói
rõ số luồng đã chọn + lý do + số liệu cuối (file/giây, thử lại, kiểm live).

**Bước 1 — xem kế hoạch:** `PLAN=1 scripts/deploy.sh` (hoặc đọc phần kế hoạch đầu output khi deploy luôn).
Dòng máy đọc: `PLAN files=… mb=… large=… mp3=… conc=… up=…` (up = Mbps tải lên đo được, 0 = không đo), kèm 5 dòng lịch sử gần nhất.

**Bước 2 — mặc định của script** (đủ tốt cho phần lớn lần deploy):

| Khối lượng sắp tải | Luồng | Vì sao |
|---|---|---|
| > 20 file ≥256 KB (MP3 bài đọc/chương, video mới) | tốc độ tải lên (KB/s) ÷ 150, kẹp 4–100 — script tự đo bằng `networkQuality` (~15 s; `UPLINK_MBPS=…` để khỏi đo; không đo được → 8) | Nghẽn **băng thông** tải lên. firebase-tools cho mỗi file thời gian chờ max(30 s, 20 ms/KB) → mỗi luồng cần ≥ 50 KB/s; chia 150 là chừa gấp 3. App HSK 28/09: 200 luồng trên đường ~5,5 MB/s = 27 KB/s mỗi luồng → quá hạn chờ hàng loạt. Mạng 44–57 Mbps (đo 11/10) → 36–47 luồng; trước đây cố định 8 nên cả phần file nhỏ trong đợt (câu ví dụ, trang, JSON) chỉ chạy ~7 file/giây. |
| ≤ 20 file lớn (chủ yếu trang HTML/RSC, JSON nhỏ, MP3 câu ví dụ ~18 KB) | 100 | Nghẽn ở **độ trễ từng file**, không phải băng thông (app HSK 11/10: 16.575 trang ~200 MB ở 32 luồng mất 13 phút, ~21 file/giây; ở 100 luồng 4 phút, 68 file/giây, thử lại 0,05%, 0 lỗi). |

**Bước 3 — điều chỉnh theo lịch sử** (so với lần trước CÙNG loại khối lượng):

- Thử lại < 1% số file đã tải, lỗi tải 0, HTTP lỗi 0 → được tăng ×1,5 (trần 200) để thăm dò.
- Tăng luồng mà file/giây gần như không tăng → đã chạm trần mạng/server: quay về mức trước.
- Thử lại 1–5% → giữ nguyên.
- Thử lại > 5%, có HTTP 429/503, hoặc dòng "lỗi tải" → lần sau giảm còn ½.
- Dưới ~500 file cần tải → không đáng tối ưu, để mặc định.

firebase-tools mặc định 200 luồng; Firebase không công bố giới hạn — lịch sử đo được là căn cứ duy nhất.

### Khi có sự cố

- **✗ deploy lỗi (bản live chưa đổi)** — chạy lại `SKIP_BUILD=1 CONC=<thấp hơn> scripts/deploy.sh`; chỉ phần
  còn thiếu phải tải.
- **✗ bản live khác out/** — chạy lại `node scripts/deploy-verify.mjs 80`. Vẫn lệch → `SKIP_BUILD=1
  scripts/deploy.sh`. Vẫn lệch nữa → xoá `.firebase/hosting.*.cache` (băm lại toàn bộ) rồi deploy.
- **✗ bundle thiếu config Firebase** — kiểm `.env.local`, build lại. Đừng bao giờ deploy bản này.
- **Đang có việc dở chưa commit** trong thư mục (của mình hoặc phiên khác) — đừng build/deploy từ đó: bản
  build sẽ mang theo phần dở. Muốn thử deploy thì dùng `SKIP_BUILD=1` với `out/` đã kiểm bằng `PLAN=1` là 0 file
  đổi, hoặc chạy từ bản sao ngoài thư mục đang làm (`cp -c -p -R out …`, kèm `firebase.json`, `.firebaserc`,
  `.env.local`, `.firebase/`, `.next/BUILD_ID`, `scripts/`, symlink `node_modules`) với `ACCOUNT=<email>` —
  firebase-tools gắn tài khoản Google theo thư mục, bản sao không biết tài khoản của thư mục gốc
  (`npx firebase login:list`).

## 5. Hai chế độ truy cập

### Đang dùng: MỞ (nhiều người)

Ai đăng nhập Google cũng dùng được. Dữ liệu vẫn **tách biệt tuyệt đối**: Firestore Rules chỉ
cho mỗi tài khoản đọc/ghi dưới `users/{uid}` của chính họ, không ai xem được tiến độ người khác.

- `.env.local`: `NEXT_PUBLIC_OWNER_UID=` (để trống)
- `firestore.rules`: chỉ kiểm tra `request.auth.uid == uid`

### Khi muốn KHOÁ về một tài khoản (như app HSK)

1. Lấy UID: Firebase Console → **Authentication → Users** → cột User UID.
2. Dán UID vào 2 chỗ:
   - `.env.local` → `NEXT_PUBLIC_OWNER_UID=<uid>`
   - `firestore.rules` → bỏ comment dòng `&& request.auth.uid == "…"` và điền UID
3. Đẩy lại:

```bash
npx firebase-tools deploy --only firestore:rules
npm run deploy
```

Từ đó tài khoản khác bị chặn ở **cả hai lớp**: AuthGate (giao diện) và Firestore Rules (dữ liệu).

## 6. Nghiệm thu 2 thiết bị (bắt buộc — DoD của E7)

Phần **logic** đã được nghiệm thu tự động: `scripts/test-sync-2devices.mjs` (11 ca, chạy trong
`npm test`) mô phỏng 2 máy + 1 Firestore trong bộ nhớ và chạy đúng giao thức của `sync-data.ts`
— hội tụ 2 chiều, vị trí đọc LWW (S2), kéo về khi remote đổi (S3), trạng thái lỗi (S6),
tombstone mẹo nhớ/bài đọc, cắt chunk 1.500 thẻ, "không đổi thì chỉ tốn 1 getDoc", và
**trả lời thẻ ngay giữa lúc sync đang chờ mạng** (race từng làm mất câu trả lời, sửa 11/08).

Phần **I/O thật** (đăng nhập Google + Firestore) vẫn phải kiểm bằng tay một lần, vì test không
đăng nhập được thay bạn:

| Kiểm tra | Cách làm | Kỳ vọng |
|---|---|---|
| Tiến độ ôn | Máy A học vài từ → máy B mở app | Máy B thấy đúng số thẻ |
| **Vị trí đọc truyện (S2)** | Máy A đọc tới chương 3 → mở máy B | Máy B mở đúng chương 3 |
| **Pull khi quay lại (S3)** | Để tab máy B mở, học trên máy A, quay lại tab B | Tab B tự cập nhật (không cần F5) |
| **Chỉ báo lỗi (S6)** | Ngắt mạng rồi bấm "Đồng bộ ngay" vài lần | Chấm đỏ trên avatar + dòng cảnh báo trong menu |
| Chuỗi ngày / huy hiệu | So sánh trang Tiến độ + Hải trình hai máy | Khớp nhau |

## Ghi chú vận hành

- **Chi phí: $0/tháng.** Firestore 1 người dùng nằm sâu trong hạn mức Spark
  (50K đọc / 20K ghi mỗi ngày); sync dùng mô hình "1 doc + chunks" nên mỗi lần mở app
  không đổi gì chỉ tốn **1 lượt đọc**.
- **Đổi giọng TTS = build lại toàn bộ audio.** Giọng đã chốt: `en-US-AriaNeural`.
- Sinh thêm audio thì chạy lại `build-audio.py` (resume được, bỏ qua file đã có) rồi deploy lại.
- Muốn sao lưu thủ công: menu tài khoản → app có sẵn `exportData()/importData()` trong `lib/db.ts`.
