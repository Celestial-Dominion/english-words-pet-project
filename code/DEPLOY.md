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
npm run check     # typecheck + lint + 98 unit test
npm run deploy    # build tĩnh + đẩy hosting
```

Lần đầu **rất lâu** vì có ~60.000 file audio (~1,5 GB).

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
