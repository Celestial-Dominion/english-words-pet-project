# Học liệu tiếng Anh — Playbook

Công thức chung cho **Reading · Stories · Video** của app. Video có playbook kỹ thuật riêng:
[`ENGLISH_VIDEO_PLAYBOOK.md`](ENGLISH_VIDEO_PLAYBOOK.md). Tài liệu này chỉ ghi nguyên tắc lâu dài —
số liệu hiện tại xem `npm run content:report`.

## 1. Ba loại học liệu — ba vai trò

| | Reading | Story | Video |
|---|---|---|---|
| Mục tiêu | Đọc hiểu, gặp từ, kiến thức phổ thông → học thuật | Đọc rộng, nhớ từ qua nhân vật/sự kiện | Nghe hiểu, khẩu ngữ, phản xạ giao tiếp |
| Dạng | Thông tin, giải thích, miêu tả, so sánh, nhân–quả; C1–C2 phân tích/lập luận; A1–B1 thêm văn bản thực dụng (thông báo, email, lịch, menu) | Nhân vật + thoại + vấn đề/xung đột + diễn biến + kết; nhiều chương | Hội thoại tự nhiên 2–3 người (C1–C2 thêm phỏng vấn, thảo luận, tranh luận, trao đổi chuyên môn) |
| Số lượng | **Nhiều nhất** | = số Video (+ truyện phỏng theo nguồn mở, §14) | **1 Video / Story tự viết** |
| Audio | 1 track/bài, giọng kể | 1 track/chương, giọng kể | 1 track/bài, mỗi nhân vật một giọng |
| Câu hỏi đọc hiểu | 4 câu/bài (A1 có thể 3) | 3 câu/chương | — |

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

26 chủ đề (`TOPICS` trong `lib/library-labels.ts`): daily-life · family · travel · food · education · work ·
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
chỉ lạ, người nói vắng mặt, từ đích không có trong thoại, heteronym chưa khai IPA, trùng nguyên văn; bài đọc /
chương truyện **chưa có câu hỏi đọc hiểu** và câu hỏi sai luật (§13) — `--draft` chỉ nới Video + câu hỏi cho lô
đang viết dở. Truyện có `source:` (§14) không bắt buộc Video.

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
- [ ] `npm run content:quiz -- --level <cấp> --long` không lỗi, không cờ "dài:"; mọi bài/chương mới đều có câu hỏi.
- [ ] `npm run content:coverage` — ghi số mới vào checkpoint; `content:gaps` cho lô sau.
- [ ] Đọc lại bằng mắt ≥ 2 bài/lô (tự nhiên? đúng cấp? dịch đúng?), 1 truyện, 1 video.
- [ ] Audio: build in "✓ đồng bộ"; nghe thử đầu/cuối một bài.
- [ ] Cuối cấp: `npm run content:build` + `npm run check` + xem UI ở 390 px và desktop.
- [ ] Cuối đợt: `npm run content:report` (số liệu báo cáo) + quét cặp truyện giống nhau giữa các cấp.

## 13. Câu hỏi đọc hiểu

Theo app HSK: cuối **mỗi bài đọc** (4 câu; A1 có thể 3) và **mỗi chương truyện** (3 câu) có câu hỏi trắc nghiệm
4 phương án, chọn là chấm ngay (`components/library/quiz.tsx`): đáp án đúng tô xanh, chọn sai tô đỏ, lộ bản
dịch mọi phương án + lời giải thích trích nguyên văn câu trong bài; phương án xáo lại mỗi lần mở / Làm lại;
không lưu điểm.

File riêng `content/quiz/{cấp}/{trùng tên file bài/truyện}.txt`, mỗi khối một bài hoặc một chương:

```
=== rd-c2-lost-in-the-maze            ← bài đọc;  "=== st-… 2" = chương 2 (đếm từ 1) của truyện
? Why was Harris sure the maze would be easy? | Vì sao Harris chắc rằng mê cung sẽ dễ?
+ He had studied a map of it beforehand. | Anh đã nghiên cứu bản đồ của nó từ trước.
- He had visited it often as a boy. | Hồi nhỏ anh đã đến đó nhiều lần.
- The keeper had given him directions. | Người trông coi đã chỉ đường cho anh.
- His cousin knew the way perfectly. | Người anh họ biết rõ đường đi.
> Bài đọc: «Harris had studied a map of the maze beforehand and concluded…»
```

Luật bộ kiểm (`scripts/lib/quiz-check.mjs`, chạy trong `content:check` và `content:quiz`):

- Đúng 4 phương án, đúng 1 dòng `+`; mọi câu/phương án có nghĩa Việt; phương án Việt dài hơn 2 chữ phải có dấu.
- `> giải thích` tiếng Việt có ít nhất một «trích dẫn» là **chuỗi con nguyên văn** của một (hoặc hai câu liền
  nhau) trong bài/chương đó; nhiều trích dẫn nối bằng " — ". Mở đầu quen dùng: `Bài đọc:`, `Chương N:`,
  `Tên nói:` / `Tên viết:`. Trích đoạn có ngoặc kép bên trong thì chỉ trích phần lời thoại cho chắc.
- Từ vựng câu hỏi + phương án ≤ cấp bài, hoặc có trong chính bài / `names:` / `gloss:`; chữ viết hoa giữa câu phải
  là tên đã khai. Độ dài tối đa (số từ) theo cấp: `SPEC[cấp].quiz` (`q` câu hỏi, `opt` phương án).
- `--long`: báo đáp án đúng dài ≥ 1,3 lần phương án sai dài nhất (khi > 12 ký tự) — người học đoán được nhờ độ dài.
  Giữ phương án sai cùng dạng ngữ pháp, dài xấp xỉ (≥ ~80% đáp án), hợp lý nhưng sai rõ theo bài; không "all of
  the above", không bẫy chữ.
- Loại câu: ý chính, chi tiết, lý do/nhân quả, từ vựng trong ngữ cảnh; C1–C2 thêm suy luận và thái độ tác giả
  (vẫn phải trích được câu làm căn cứ).

Lệnh: `npm run content:quiz -- --level c1 [--long] [--missing]` — in lỗi/cảnh báo và độ phủ theo cấp; `--missing`
liệt kê bài/chương còn thiếu câu hỏi.

## 14. Phỏng theo nguồn mở

Bài đọc / truyện có thể **kể lại** từ nguồn mở trên GitHub — nhận **phạm vi công cộng, CC0, CC BY**; vì app dùng
cá nhân, phi thương mại nên nhận thêm **CC BY-NC, CC BY-NC-SA** (truyện tranh African Storybook / LIDA); **không nhận
ND** (cấm phái sinh). Nhãn hợp lệ = khoá `LICENSES` (`scripts/lib/content-spec.mjs`, khớp `lib/library-labels.ts`):

| Nguồn | Giấy phép | Hợp cấp |
|---|---|---|
| `standardebooks/*` (Aesop, Andersen, Grimm, Kipling, Wilde, O. Henry, Saki, Chekhov–Garnett, Doyle, Jerome, Franklin, Thoreau, Mill, Hazlitt, Emerson, Joyce, Leacock, Twain, Chesterton…) | public domain (+ CC0) | A2–C2 |
| `GITenberg/*` (Project Gutenberg, vd. Baldwin *Fifty Famous Stories*) | public domain | B1–B2 |
| `global-asp/asp-source`, `pb-source`, `lida-source` (African Storybook, Pratham StoryWeaver; `sbc-source` = Storybooks Canada, có thư mục `vi/` dịch sẵn 40 truyện) | CC BY 4.0 / CC BY-NC 4.0 / CC BY-NC-SA 4.0 — ghi đúng giấy phép từng truyện (dòng `* License:` cuối file) | A1–A2 |
| `openstax/osbooks-*` (Tâm lý, Xã hội học, Triết học, Lịch sử, Thiên văn, Sinh học) | CC BY 4.0 (soát từng sách) | B2–C1 |
| Web (từ 10/2026): VOA Learning English (trừ bài/ảnh AP–Reuters–AFP) | public domain | A2–B1 |
| Web: Frontiers for Young Minds, eLife digests, Our World in Data (trừ dữ liệu bên thứ ba) | CC BY 4.0 | B1–C1 |
| Web: Global Voices | CC BY 3.0 | B2–C1 |
| Web: Wikipedia / Simple English Wikipedia / Wikivoyage — chỉ làm nguồn dữ kiện, kể lại hoàn toàn | CC BY-SA 4.0 | A2–C1 |

- Header bắt buộc: `source: Tên gốc | tác giả, tuyển tập (năm), nơi lấy` · `license: public domain | CC0 1.0 |
  CC BY 4.0 | CC BY-NC 4.0 | CC BY-NC-SA 4.0 | CC BY-SA 3.0 | CC BY-SA 4.0` · `source-url: https://…` (GitHub hoặc trang gốc). Trang bài
  hiện dòng ghi nguồn (`source-note.tsx`): tên gốc, tác giả, giấy phép kèm liên kết, liên kết nguồn, "đã biên soạn lại theo
  cấp độ và dịch" — đủ ghi công CC BY. Không dùng nguồn có bản quyền (Breaking News English, News in Levels, CommonLit,
  Newsela) hay CC BY-ND (The Conversation).
- **Kể lại theo cấp**, không chép: giữ cốt truyện/ý chính, câu chữ mới đúng mốc §2–§3; bài đọc C1–C2 thêm đoạn
  bình luận ngắn (bối cảnh, ý nghĩa, liên hệ hôm nay) để đủ từ đúng cấp. Ghi chú ở dòng `//` đầu file: nguồn,
  chương đã dùng, chi tiết đã đổi.
- **Bạo lực làm nhẹ hoặc bỏ**: giết người, đánh đập, đầu độc, tự tử, xác chết… đổi thành hướng nhẹ (bỏ đi biệt
  tích, bị nhốt, ngã xuống ao, doạ suông) hoặc bỏ hẳn; không giữ máu me/miêu tả thương tích.
- Không trùng nội dung đã có: soát tiêu đề + cốt truyện ở **mọi cấp** (một tác phẩm chỉ dùng ở một cấp), tránh
  tiền đề đã có (vd. "After Twenty Years" ↔ truyện hẹn gặp sau 20 năm).
- Truyện phỏng theo nguồn **không bắt buộc Video**. Tác phẩm dài tách thành nhiều truyện cùng cấp với
  `series: <id-chuỗi> <thứ-tự>` (thứ tự liền 1..n, bộ kiểm chặn trùng/lệch cấp).
- Tên riêng phổ biến (London, American, German, Christmas…) ≤ 2 truyện/cấp — đổi cách nói ("the capital",
  "a foreign gentleman") thay vì khai thêm.


## 15. Mục tiêu theo cấp — "học hết là đủ lên cấp"

Câu hỏi: học hết thẻ từ + ngữ pháp + thư viện của cấp L thì đủ sang L+1 chưa? Thẻ từ dạy nghĩa (B1–C2: mỗi từ
5 câu ví dụ, ôn theo SRS), ngữ pháp có bài riêng; thư viện lo **gặp lại từ trong ngữ cảnh** và **khối lượng đọc**.
Số mục tiêu nằm ở `TARGETS` (`scripts/lib/content-spec.mjs`); đo bằng `npm run content:coverage -- --targets`.

**Mục tiêu 2.0** (10/2026 — bản đầu chỉ vừa chạm mốc, ~1/3 từ B1–C1 mới gặp đúng 1 bài):

| Cấp | Từ của cấp gặp ≥ 1 bài | ≥ 3 bài | ≥ 5 bài | Giờ đọc (bài đọc + truyện) | Mỗi chủ đề | Thể loại bắt buộc (mỗi loại ≥ … bài đọc) |
|---|---|---|---|---|---|---|
| A1 | 98% | 90% | 65% | ≥ 8 | ≥ 2 bài đọc | narrative, description, informational, practical, letter, how-to, news (≥ 3) |
| A2 | 97% | 80% | 40% | ≥ 12 | ≥ 2 | như A1 + review, biography (≥ 4) |
| B1 | 96% | 70% | 35% | ≥ 20 | ≥ 3 | narrative, explanation, informational, news, opinion, how-to, letter, biography, review, interview (≥ 5) |
| B2 | 90% | 60% | 30% | ≥ 20 | ≥ 3 | narrative, explanation, analysis, argument, news, opinion, review, interview, case-study, biography, letter, comparison (≥ 5) |
| C1 | 87% | 50% | 25% | ≥ 21 | ≥ 3 | narrative, analysis, argument, explanation, opinion, review, case-study, biography, interview, comparison, description (≥ 5) |

Bản đầu (đạt 10/2026): ≥ 3 bài A1 85 · A2 70 · B1 60 · B2 50 · C1 40%; giờ 6,5 / 9 / 16 / 16 / 17. `--targets` in thêm "thiếu ngữ
cảnh" = tổng số lần từ đích phải gặp thêm để đạt cả ba ngưỡng (lấp từ gần ngưỡng trước).

**C2 không đặt mục tiêu** (chủ app quyết 10/2026): người học C2 cần chuyển sang văn bản thật (CEFR: "hầu như mọi loại
văn bản"), thư viện C2 chỉ là phần mở đầu.

**Trạng thái 10/2026**: A1–C1 đạt mốc bản đầu; đang làm Mục tiêu 2.0. Mỗi cấp A2–C1 có thêm một tác phẩm dài chia nhiều
phần (`series:`): Oz (A2), The Story of the Treasure Seekers (B1), Around the World in Eighty Days (B2), The Time Machine (C1). Cách lấp nhanh nhất: bài đọc tự biên soạn theo cụm
chủ đề nhắm đúng từ đang gặp 2 bài (mỗi lần gặp thêm kéo một từ lên ≥ 3) và từ chưa gặp (kéo ≥ 1), 15–30 từ thiếu/bài;
truyện nguồn mở chủ yếu để đủ giờ đọc (một truyện kể lại "tự nhiên" chỉ phủ thêm ~10 từ thiếu).

Cách đếm: "bài" = một bài đọc / một truyện / một video ở cấp **≤ L** (người học đi từ dưới lên — bài cấp trên chưa
đọc tới); từ = lemma theo `profileOf` (gộp mọi dạng biến hình); danh sách cấp = `targetWords(band)`. Không đếm qua
`word-refs` (mỗi từ chỉ giữ tối đa 12 bài). Giờ đọc = số chữ ÷ `SPEC[cấp].wpm`.

**Căn cứ nghiên cứu** (số liệu của tác giả):
- *Độ phủ từ đã biết*: đọc hiểu không trợ giúp cần ~98% token là từ đã biết (Hu & Nation 2000); ngưỡng tối thiểu
  ~95%, tối ưu 98% (Laufer & Ravenhorst-Kalovski 2010). → giới hạn vượt cấp §2–§3 (≤ 1,2–5% token, phần còn lại
  khai `gloss:`) giữ mọi bài ở vùng 95–98%+ với người đã học hết từ cấp ≤ L.
- *Số lần gặp*: từ gặp dưới 8 lần trong sách phân cấp gần như không còn nhớ nghĩa sau 3 tháng (Waring & Takaki
  2003); ~10 lần gặp mới có tiến bộ rõ trên nhiều mặt kiến thức từ (Webb 2007); số lần gặp là yếu tố dự báo quan
  trọng nhưng không duy nhất (Uchihara, Webb & Yanagisawa 2019).
- *Quy mô từ theo CEFR*: A1 < 1.500 · A2 1.500–2.500 · B1 2.500–3.250 · B2 3.250–3.750 · C1 3.750–4.500 · C2
  4.500–5.000 lemma trong 5.000 từ thường gặp nhất (Milton & Alexiou 2009). Danh sách app luỹ kế A1 1.052 → A2
  2.289 → B1 4.565 → B2 7.147 → C1 10.185 → C2 12.597 lemma — đủ so với mốc này.
- *Giờ học có hướng dẫn* luỹ kế (Cambridge English): A2 ~180–200 · B1 ~350–400 · B2 ~500–600 · C1 ~700–800 ·
  C2 ~1.000–1.200.
- *Khối lượng đọc rộng*: ~1 sách phân cấp/tuần ở bậc 2–3, 1,5–2 cuốn/tuần ở bậc 4–6 mới đủ gặp lại từ (Nation &
  Wang 1999; Oxford Bookworms bậc 1–6 dài trung bình 5.200 → 30.000 chữ/cuốn); ~200.000 chữ/năm (Beglar & Hunt
  2014); đọc ở vùng ≥ 98% từ đã biết, 150–200 từ/phút (Extensive Reading Foundation).
- *Thể loại* (CEFR Companion Volume 2020): A1–A2 văn bản ngắn, cụ thể (thông báo, tin nhắn, thực đơn, lịch, tin
  ngắn, truyện đơn giản); B1 văn bản thông tin rõ ràng, bài báo đơn giản, thư cá nhân, hướng dẫn; B2 bài báo/báo
  cáo có quan điểm, văn xuôi đương đại; C1 văn bản dài, phức tạp, văn học, chuyên ngành; C2 hầu như mọi loại.

**Ước lượng của nhóm soạn** (không phải số nghiên cứu):
- *≥ 3 bài*: thẻ từ B1–C2 cho 5 ngữ cảnh + ≥ 3 bài khác nhau = ≥ 8 lần gặp có ngữ cảnh (ngưỡng Waring & Takaki); *≥ 5 bài* →
  ≥ 10 lần (Webb 2007), và với A1–A2 (thẻ không có câu ví dụ) mới gần ngưỡng.
  A1–A2 không có câu ví dụ trên thẻ, nhưng từ A1–A2 lặp lại dày đặc ở mọi cấp trên (Nation & Wang 1999).
- *Tỉ lệ giảm dần theo cấp* (85% → 40%): danh sách cấp cao dài hơn và hiếm dần (Zipf trung vị A1 ≈ 5,0 → C1 ≈ 3,6);
  phần đuôi hiếm học có chủ đích qua thẻ, không nhồi vào bài (§4). Phần đạt ≥ 3 bài là phần thường gặp nhất.
- *Giờ đọc* ≈ 7–10% giờ học có hướng dẫn của bậc. Thư viện là phần lõi có kiểm soát — không thay được khối lượng đọc
  rộng ngoài app.
- *Lấp khoảng trống*: ưu tiên tác phẩm nguồn mở hợp cấp chứa nhiều từ còn thiếu (§14); từ hiện đại mà văn cổ không
  có (công nghệ, kinh tế, xã hội…) → bài đọc tự biên soạn nhắm đúng nhóm từ (không cần Video); truyện tranh dài
  > 650 chữ → truyện A2.

**Nguồn**: Hu, M. & Nation, P. (2000), *Reading in a Foreign Language* 13(1) · Laufer, B. & Ravenhorst-Kalovski,
G. C. (2010), *RFL* 22(1) · Nation, P. (2006), *Canadian Modern Language Review* 63(1) · Waring, R. & Takaki, M.
(2003), *RFL* 15(2) · Webb, S. (2007), *Applied Linguistics* 28(1) · Uchihara, T., Webb, S. & Yanagisawa, A.
(2019), *Language Learning* 69(3) · Milton, J. & Alexiou, T. (2009), *Vocabulary Studies in First and Second
Language Acquisition* (Palgrave) · Nation, P. & Wang, K. (1999), *RFL* 12(2) · Beglar, D. & Hunt, A. (2014), *RFL*
26(1) · Cambridge English, *Guided learning hours* · Council of Europe (2020), *CEFR Companion Volume* · Extensive
Reading Foundation, *Guide to Extensive Reading*.


## 16. Soạn nhanh, ít token

Tiếng Việt chiếm 55–75% token của một file bài/truyện/câu hỏi — để máy dịch nháp, người soạn chỉ viết tiếng Anh rồi
đọc soát. Công cụ (không cài thêm phần mềm):

- `npm run content:kit -- need <cấp> [k] [N] [--re <nghĩa>]` — từ đang gặp < k bài (gần ngưỡng trước), lọc theo trường nghĩa để
  gom một bài theo cụm chủ đề; `dens <id>…` — mật độ, vượt cấp, ngoài từ điển, số từ thiếu bài đó phủ; `names <cấp>` — tên đã
  dùng ≥ 2 truyện.
- `npm run content:src -- wiki|url|se|gt …` — lấy văn bản nguồn (Wikipedia/Simple/Wikivoyage, trang web, Standard Ebooks,
  GITenberg) ra văn bản thuần; nguồn web dài thì đọc bằng công cụ tóm tắt trước khi kể lại.
- Viết file bài **chỉ tiếng Anh** (câu, `title:`, `## Chương`, `summary:` tiếng Anh) và file câu hỏi chỉ `? / + / -` tiếng Anh, giải
  thích ghi `> ~cụm từ trong câu làm căn cứ` → `npm run content:mt -- fill <file bài> <file câu hỏi>` điền tiếng Việt (Google
  Translate) và sinh `> Bài đọc: «câu nguyên văn»` / `> Chương N: «…»`.
- `content:mt -- vi <file>` in "số-dòng|VI" để soát; sửa bằng `content:mt -- fix <file>` (stdin "số-dòng|VI mới"). Lỗi máy hay gặp:
  xưng hô ("bạn", "anh ấy" → theo vai), số chữ thành số ("eleven" → "11" — giữ chữ để khớp bộ kiểm), từ miền Nam (chén → bát,
  trái → quả), đảo/gộp ngoặc kép (dòng có ngoặc kép lẻ được báo), câu cứng kiểu "nó tồn tại".
