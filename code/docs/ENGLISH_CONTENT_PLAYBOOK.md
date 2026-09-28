# Học liệu tiếng Anh — Playbook

Công thức chung cho **Reading · Stories · Video** của app. Video có playbook kỹ thuật riêng:
[`ENGLISH_VIDEO_PLAYBOOK.md`](ENGLISH_VIDEO_PLAYBOOK.md). Tài liệu này chỉ ghi nguyên tắc lâu dài —
số liệu hiện tại xem `npm run content:report`.

## 1. Ba loại học liệu — ba vai trò

| | Reading | Story | Video |
|---|---|---|---|
| Mục tiêu | Đọc hiểu, gặp từ, kiến thức phổ thông → học thuật | Đọc rộng, nhớ từ qua nhân vật/sự kiện | Nghe hiểu, khẩu ngữ, phản xạ giao tiếp |
| Dạng | Thông tin, giải thích, miêu tả, so sánh, nhân–quả; C1–C2 phân tích/lập luận; A1–B1 thêm văn bản thực dụng (thông báo, email, lịch, menu) | Nhân vật + thoại + vấn đề/xung đột + diễn biến + kết; nhiều chương | Hội thoại tự nhiên 2–3 người (C1–C2 thêm phỏng vấn, thảo luận, tranh luận, trao đổi chuyên môn) |
| Số lượng | **Nhiều nhất** | = số Video | **1 Video / Story** |
| Audio | 1 track/bài, giọng kể | 1 track/chương, giọng kể | 1 track/bài, mỗi nhân vật một giọng |

Quan hệ: `Vocabulary/SRS → Reading → Story → Video`. Ba loại **bổ sung nhau, không lặp nguyên văn**:
Reading cho kiến thức và từ trong văn viết; Story đặt từ vào tình huống có người; Video lấy tình huống,
nhân vật, từ và chủ đề của Story rồi nói lại bằng tiếng Anh nói tự nhiên.

- Story **không phải** Reading gắn thêm tên người: phải có nhân vật muốn gì, gặp trở ngại gì, thay đổi ra sao.
- Video **không đọc lại** Story: chọn MỘT khoảnh khắc có lý do giao tiếp thật (hỏi, nhờ, từ chối, thuyết
  phục, xin lỗi, thương lượng, giải thích, tranh luận) và viết thoại mới.

## 2. Cấp độ

App học từ theo 4 cấp B1–C2 (`LEVELS`) + bộ nền A1–A2 chỉ để tra cứu. Học liệu dùng **đủ 6 cấp CEFR**
(`CONTENT_LEVELS` trong `lib/levels.ts`, khoá `a1…c2`) — tách **cấp học liệu** khỏi **band dữ liệu từ**
(bài học từ app HSK): A1/A2 cùng tra trong bộ nền, tách A1 ↔ A2 theo nhãn CEFR-J.

| Cấp | Reading (từ) | Câu TB | Từ đúng cấp ≥ | Vượt cấp ≤ | Story | Video | Tốc độ TTS |
|---|---|---|---|---|---|---|---|
| A1 | 80–150 | 4–10,5 | — | 1,2% | 3 chương · 280–520 từ | 8–12 lượt, ≤ 10 từ/lượt | −15% |
| A2 | 120–220 | 6–13,5 | 7% | 2% | 4 chương · 380–820 | 10–14 lượt, ≤ 14 | −10% |
| B1 | 180–320 | 9–16,5 | 5% | 3% | 5 chương · 600–1.100 | 12–18 lượt, ≤ 20 | −5% |
| B2 | 250–450 | 12–20,5 | 5% | 4% | 5–6 chương · 800–1.450 | 14–22 lượt, ≤ 26 | 0 |
| C1 | 350–650 | 15–24,5 | 4,5% | 5% | 5–6 chương · 1.000–1.800 | 16–24 lượt, ≤ 32 | 0 |
| C2 | 450–800 | 17–28,5 | 3,5% | — | 5–7 chương · 1.100–2.000 | 18–28 lượt, ≤ 36 | 0 |

Nguồn sự thật là `scripts/lib/content-spec.mjs` (bảng trên chép lại). Story: tỉ lệ đúng cấp ≥ 60% mốc Reading.
Độ dài là mốc tham khảo, không kéo dài bằng câu đệm. Lên cấp phải tăng **cả** độ khó từ vựng (tỉ lệ từ
đúng cấp), cú pháp (mệnh đề phụ, danh hoá, bị động), diễn ngôn (liên kết, đối lập, nhượng bộ),
độ trừu tượng và **suy luận** (C1–C2: người đọc phải tự rút ý, không được nói hết).

Chủ đề phát triển theo cấp, không lặp nội dung (ladder `series:`): *A Rainy Day (A1) → Why Cities Flood
(B1) → How Urban Drainage Works (B2) → Climate Adaptation in Cities (C1) → The Economics of Resilient
Infrastructure (C2)*. Hai bậc kề nhau không trùng câu chữ; series ≤ 15% thư viện.

## 3. Kiểm soát từ vựng

- **Nguồn sự thật:** bộ từ của app (`public/data/words/*.json`, `word-levels.json`, `lemma-map.json`).
- Từ được phép ở cấp L = mọi từ cấp ≤ L (luỹ kế). Từ vượt cấp: A1 ≤ 1% token · A2 ≤ 2% · B1 ≤ 3% ·
  B2 ≤ 4% · C1 ≤ 5%; khai `gloss:` nếu thật sự cần (thuật ngữ, tên món ăn). Tên riêng khai `names:`.
- **Hình thái học tiếng Anh** (`scripts/lib/en-vocab.mjs`): số nhiều, chia động từ, quá khứ/phân từ,
  so sánh hơn/nhất, rút gọn (`don't`, `we'll`), sở hữu, phái sinh thường gặp (`-ly -ness -ful -less -er
  un- re- dis-…`), từ ghép (`bookshop`, `well-known`) và **cụm động từ tách được** (`picked it up` →
  *pick up*) đều quy về lemma — không tính là từ mới.
- Tỉ lệ từ **đúng cấp** (band = L) là thước đo độ khó chính; mỗi bài có mục tiêu tối thiểu theo cấp
  (validator cảnh báo bài "dễ hơn cấp").
- Bản nháp đầu ở C1–C2 thường chỉ đạt ~1–2% từ đúng cấp: **cài từ đích ngay lúc viết** (lấy từ `content:gaps`,
  ~20 từ/bài đọc, ~25–30 từ/truyện), rồi đo và vá. Câu quá dài thì tách câu, không cắt ý.
- Bộ từ là chính tả Mỹ: chính tả Anh (favoured, colours, analysed) và từ ngoài bộ từ phải khai `gloss:`.
  `words:` của Video phải là **headword** có trong bộ từ (dạng phái sinh như *colloquialism* không nhận).

## 4. Coverage — đo, không đoán

Theo từng cấp (`npm run content:coverage`): số từ đích, raw coverage (≥1 lần), weighted coverage (trọng số
tần suất), số từ ở ≥2 và ≥3 **ngữ cảnh khác nhau** (bài/chương/video), coverage riêng Reading / Story /
Video và gộp; số từ xuất hiện ở ≥2 **modality**.

- Một lần xuất hiện ≠ đã phủ tốt. Ưu tiên từ tần suất cao xuất hiện ở cả Reading + Story + Video.
- Không nhồi từ hiếm vào bài không hợp chỉ để đạt 100%; phần thiếu cuối cùng nên là từ hiếm/khó.
- Quy trình 2 pass mỗi cấp:
  1. **Chất lượng & đa dạng**: Reading theo taxonomy, Story tự nhiên, Video từ Story → đo coverage.
  2. **Lấp khoảng trống**: `content:gaps` in từ chưa gặp/quá ít (theo tần suất) + chủ đề/thể loại thiếu →
     viết bài nhắm đích (nhóm từ theo trường nghĩa, chọn chủ đề chứa được chúng tự nhiên). Story mới ⇒
     Video mới. Lặp `generate → validate → measure → gaps` tới khi phần thiếu chủ yếu là từ hiếm.
- Số bài mỗi cấp **suy từ số liệu**: kích thước bộ từ ÷ mức tăng coverage trung bình/bài (đo sau lô đầu),
  cộng yêu cầu đa dạng chủ đề. Không dừng vì "đủ số" khi coverage còn thấp; không sinh bài na ná để tăng số.

## 5. Taxonomy chủ đề

26 chủ đề (`TOPICS` trong `lib/library.ts`): daily-life · family · travel · food · education · work ·
technology · science · health · psychology · history · geography · environment · society · economics ·
business · communication · culture · art · literature · philosophy · ethics · media · cities · nature ·
innovation.

- A1–A2 nghiêng về đời sống, gia đình, ăn uống, đi lại, trường, việc làm, sức khoẻ, thiên nhiên, thành phố.
- B1–B2 mở rộng khoa học, lịch sử, địa lý, môi trường, xã hội, truyền thông, kinh tế, công nghệ, nghệ thuật.
- C1–C2 bắt buộc có tâm lý, kinh tế, triết học, đạo đức, văn học, liên ngành, lập luận nhiều chiều.
- Một chủ đề ≤ 15% số Reading của một cấp; mỗi cấp phủ ≥ 18 chủ đề (A1–A2 ≥ 12).
- Thể loại (`genre`) đa dạng: description · narrative · informational · explanation · how-to · comparison ·
  cause-effect · biography · news · interview · opinion · review · argument · analysis · case-study ·
  practical (thông báo, email, lịch, menu, quảng cáo).

## 6. Viết nội dung

- Tiếng Anh tự nhiên trước, kiểm soát cấp sau: viết lại câu chứ không nhét từ. Không calque từ tiếng Việt.
- Fact-check với nội dung thực chứng (khoa học, lịch sử, kinh tế): chỉ viết điều chắc chắn đúng, không số
  liệu bịa, không trích dẫn giả; dùng cách nói thận trọng khi cần ("researchers estimate…").
- Bản dịch tiếng Việt tự nhiên (giọng Bắc), đủ ý, nhất quán xưng hô trong truyện/thoại; tên riêng giữ
  nguyên; thuật ngữ quen dùng tiếng Anh thì giữ (CEO, email, app).
- Tránh khuôn: mở bài "Have you ever…", "Many people…", kết bài bằng lời răn/"In conclusion" lặp lại;
  ngôi thứ nhất ≤ 30% Reading A1–B1, ≤ 15% C1–C2; câu hỏi tu từ không mở quá 10% bài.
- Story: mỗi truyện một mô-típ riêng trong cấp (không hai truyện "mất đồ rồi tìm thấy"), nhân vật chính
  không trùng tên trong cấp, kết thúc không luôn có hậu; từ B2 có động cơ/cảm xúc rõ, C1–C2 có tầng nghĩa
  và chi tiết buộc người đọc suy luận.
- **Không lặp cốt truyện giữa các cấp** (C1 phòng nghị án ↔ C2 phòng nghị án là trùng, dù khác câu chữ); chủ đề
  được lặp xoắn ốc (leo núi B1 → cứu hộ núi B2) nhưng tình huống phải khác. Không trùng **họ tên đầy đủ** nhân
  vật trong toàn thư viện; một tên riêng ≤ 2 truyện/cấp (bộ kiểm cảnh báo).
- Không để 3 bài cùng cấp mở bằng cùng 2 từ đầu (số quy về "in a…"); tiêu đề không trùng ở mọi cấp (lỗi).

## 7. Phát âm & audio

- **Giọng Mỹ (General American) cho toàn bộ series**: IPA từ điển là GA, audio edge-tts `en-US-*`.
  Giọng kể Reading/Story: `en-US-AriaNeural` (cùng giọng từ/câu ví dụ). Video: mỗi nhân vật một giọng en-US
  (bảng giọng trong Video Playbook). Không trộn giọng Anh/Úc giữa các bài.
- Một MP3 cho mỗi bài đọc / chương truyện / video, mốc câu (và mốc từ ở Video) lấy từ WordBoundary;
  file tĩnh, tải khi bấm nghe, `?v=<hash>` để cache 1 năm.
- Từ đa cách đọc (read, live, lead, close, record, present, object…) trong Video phải khai IPA theo
  ngữ cảnh câu (`ipa=read:rɛd`) — bộ kiểm chặn nếu chưa quyết định; không tin converter tuyệt đối.
- edge-tts có lúc trả **thiếu byte ở đuôi** dù đủ mốc WordBoundary (câu cuối bị cụt): build đối chiếu độ dài
  file với mốc cuối, tự thử lại; bài đã build mà mốc câu cuối vượt độ dài file được coi là chưa build.

## 8. Validation (`npm run content:check`)

Lỗi chặn build: sai schema/định dạng, id trùng/sai dạng, câu thiếu nghĩa Việt, tách từ hỏng (`end.Next`,
khoảng trắng kép), Story không có Video (và ngược lại), Video trỏ nguồn không tồn tại, asset/biểu cảm/cử
chỉ lạ, người nói vắng mặt, từ đích không có trong thoại, heteronym chưa khai IPA, trùng nguyên văn.

Cảnh báo cần soát: từ vượt cấp / ngoài từ điển, độ dài và câu TB lệch cấp, tỉ lệ từ đúng cấp thấp, số
khác nhau giữa Anh–Việt, bản dịch còn tiếng Anh/quá ngắn, near-duplicate (5-gram Jaccard), mở/kết bài
lặp, chủ đề vượt quota, Video giống Story quá nhiều (sao chép câu).

## 9. Chống trùng lặp & khuôn mẫu

Kiểm máy: tiêu đề trùng, thân bài gần trùng, chủ đề chồng lấn, mở/kết bài lặp, bộ từ trùng quá nhiều,
tên nhân vật/mô-típ truyện lặp, mẫu mở–kết thoại video lặp. Khi một lô bắt đầu "có mùi máy": **dừng lô →
sửa chiến lược chung (Playbook/checker) → viết lại phần bị ảnh hưởng**, không nhân lỗi ra hàng trăm bài.

## 10. Hiệu năng (Firebase Hosting)

- JSON tĩnh **một file mỗi bài** (`public/data/library/{readings,stories,videos}/{id}.json`) + chỉ mục nhẹ
  theo loại; không tải cả cấp để mở một bài. Chỉ mục từ → học liệu chia 8 shard (`word-refs/`).
- Audio chỉ tải khi bấm nghe (`preload="metadata"`), CBR để tua chính xác, không qua service worker.
- Video: `lesson JSON + 1 audio + asset SVG dùng chung tải lười` — không MP4, không GIF, không thư viện
  render nặng, không Base64 lớn; raster (nếu buộc có) WebP/AVIF.

## 11. Dữ liệu người dùng

Tiến độ đọc nằm trong bảng `reads` (id bài). Thay thư viện **không xoá** dòng cũ (vẫn tính huy hiệu
"reads", vẫn sync). Id mới có tiền tố loại: `rd-` bài đọc, `st-` truyện, `vd-` video — không va chạm id cũ.
Id đã phát hành là ổn định: sửa nội dung giữ id; thay hẳn chủ đề mới đổi id.

## 12. Checklist mỗi lô

- [ ] `npm run content:check` không lỗi; cảnh báo đã đọc và xử lý hoặc chấp nhận có lý do.
- [ ] `npm run content:coverage` — ghi số mới vào checkpoint; `content:gaps` cho lô sau.
- [ ] Đọc lại bằng mắt ≥ 2 bài/lô (tự nhiên? đúng cấp? dịch đúng?), 1 truyện, 1 video.
- [ ] Audio: build in "✓ đồng bộ"; nghe thử đầu/cuối một bài.
- [ ] Cuối cấp: `npm run content:build` + `npm run check` + xem UI ở 390 px và desktop.
- [ ] Cuối đợt: `npm run content:report` (số liệu báo cáo) + quét cặp truyện giống nhau giữa các cấp.
