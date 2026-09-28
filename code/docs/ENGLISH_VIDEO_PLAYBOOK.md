# Video — Playbook

Video = **hội thoại hoạt hình tương tác** luyện nghe hiểu và nói: cảnh 2D SVG + audio tự nhiên nhiều giọng
+ transcript đồng bộ. **Không phải MP4**: một bài = `lesson JSON + 1 audio`; player, rig nhân vật, bối cảnh,
đạo cụ, bong bóng dùng chung và tải lười theo bài. Kiến trúc chuyển từ app HSK (`chinese_hsk_words`
`docs/VIDEO_PLAYBOOK.md`), nội dung viết mới cho tiếng Anh. Nguyên tắc chung: `ENGLISH_CONTENT_PLAYBOOK.md`.

## 1. Từ Story sang Video

- **Mỗi Story đúng một Video** (`st-b1-x` ↔ `vd-b1-x`, bộ kiểm bắt cặp). Video lấy tình huống, nhân vật, từ và
  chủ đề của truyện, chọn **một khoảnh khắc** có lý do giao tiếp thật và viết **thoại mới** — không kể lại
  truyện, không chép câu (bộ kiểm chặn câu trùng nguyên văn, cảnh báo trùng 5-gram > 25%).
- Được đổi chi tiết nhỏ / địa điểm cho lời nói tự nhiên; giữ chủ đề, từ quan trọng, nhân vật, mục tiêu học.
  Chuyện đã xảy ra trong truyện đưa vào bằng lời kể + bong bóng, không đổi cảnh.
- Mỗi bài một **trọng tâm nói** (`focus:`) — chức năng giao tiếp + mẫu câu, xuất hiện ≥ 2 lần tự nhiên,
  **không lặp trong cùng cấp**. A1–A2: chào hỏi, hỏi giá, xin phép, rủ rê, chỉ đường, hỏi ý thích. B1–B2: khuyên,
  gợi ý, kể trải nghiệm, phàn nàn lịch sự, đồng ý/phản đối, thương lượng, giải thích vấn đề. C1–C2: rào đón
  (hedging), nhượng bộ, thách thức lập luận, làm rõ, tóm lược ý người khác, ngắt lời lịch sự, phỏng vấn.
- Một chức năng được lặp **xoắn ốc** giữa các cấp chỉ khi cấp trên dùng exponent cao hơn: B2 "I'll grant you
  that / Suppose… / must have" → C2 "I stand corrected · Be that as it may / For the sake of argument… /
  In all likelihood…". Không lấy mẫu câu cấp dưới làm tiêu đề hay trọng tâm của video cấp trên.

## 2. Lời thoại theo cấp

| Cấp | Lượt | Từ/lượt tối đa | Dạng |
|---|---|---|---|
| A1 | 8–12 | 10 | hỏi–đáp đời thường, 2 người, cảnh rõ |
| A2 | 10–14 | 14 | 2–3 người, việc hằng ngày, lời mời/đề nghị |
| B1 | 12–18 | 20 | giải thích, kể trải nghiệm, xin lời khuyên |
| B2 | 14–22 | 26 | đồng ý/phản đối, giải quyết vấn đề, nhiều lượt qua lại |
| C1 | 16–24 | 32 | thảo luận, phỏng vấn, trao đổi chuyên môn |
| C2 | 18–28 | 36 | tranh luận, sắc thái, lập luận ngầm, mỉa mai nhẹ |

- **Tiếng Anh nói thật**: rút gọn (I'm, don't, gonna chỉ khi nhân vật hợp), tiếng đệm có chừng mực (Well, Oh,
  Hmm, I mean, you know), câu hỏi đuôi, câu hụt chủ ngữ ("Sounds good."), đáp ngắn ("Me too."), tự sửa lời.
  Không biến thành bài đọc nhiều giọng: không câu dài kiểu văn viết, không liệt kê kiến thức.
- Gọi tên nhau sớm; một lượt một ý; kết bài hay bằng câu **gọi lại** chi tiết đầu bài (dễ nhớ, có tiếng cười).
- Lượt quá dài thì tách thành 2 lượt cùng người (nghỉ 0,45 s). Tách lượt làm dịch chỉ số → sửa `from=`/`until=`
  của các vai phía sau (bộ kiểm báo "nói khi chưa vào / đã rời cảnh").
- Nghĩa Việt: giọng Bắc tự nhiên, **xưng hô cố định theo quan hệ** suốt bài (bố–con, anh–em, cậu–tớ, chị–em).
- Từ ≤ cấp bài (bộ kiểm dùng chung với Reading/Story); `words:` 4–8 từ/cụm đích — phần lớn lấy từ truyện nguồn,
  là **headword** của bộ từ, có mặt trong thoại; video phải chung ≥ 3 từ đúng cấp với truyện (bộ kiểm).

## 3. Audio & đồng bộ

- 1 audio/bài: TTS từng lượt theo giọng nhân vật (cache theo giọng+tốc độ+pitch+chữ) → cắt lặng → cân RMS
  giữa giọng → đồng thanh trộn giọng → ghép, nghỉ 0,7 s khi đổi người / 0,45 s cùng người, `pause=` cho nhịp
  kịch → MP3 **CBR 64 kbps** mono 24 kHz. start/end đo trên PCM; mốc từ = WordBoundary; giải mã lại để bù trễ
  encoder và kiểm lời nằm đúng [start, end] ("✓ đồng bộ").
- **Chỉ giọng en-US** (GA, khớp IPA bộ từ). Vai → giọng (đổi `rate`/`pitch` để tách vai cùng giọng; bộ kiểm cấm
  hai vai trùng hẳn giọng):

  | Vai | Giọng gợi ý |
  |---|---|
  | phụ nữ trẻ / bạn bè | Ava, Emma, Jenny |
  | phụ nữ trung niên, chuyên môn | Michelle, Jenny (−5%) |
  | đàn ông trẻ / bạn bè | Brian, Andrew |
  | bố, người đàn ông năng nổ | Guy |
  | sếp, bác sĩ, MC, chuyên gia | Christopher, Eric, Steffan |
  | ông | Roger (−8%, −4Hz), Christopher (−10%, −8Hz) |
  | bà | Michelle (−10%, −6Hz), Jenny (−12%, −8Hz) |
  | bé gái / bé trai | Ana / Ana (−12Hz) |
  | thiếu niên | Emma (+6Hz), Brian (+10Hz) |
- Tốc độ nền theo cấp: A1 −12% · A2 −8% · B1 −4% · B2 trở lên 0 (người học vẫn chỉnh 0,75× / 1,25×).
- "⚠ chỗ lệch" = đầu/cuối lượt đo trên PCM lệch mốc > 50–60 ms hoặc có tiếng trong khoảng nghỉ — highlight
  lệch nhẹ, không mất lời; soát lại nếu một bài có ≥ 3 chỗ.
- Giọng kể `en-US-AriaNeural` dành cho Reading/Story — không dùng làm nhân vật video.

## 4. Transcript & luyện tập

- Lớp độc lập **English · IPA · Việt**; tắt hết = **Luyện nghe**. IPA = ruby theo từ, GA dạng từ điển của bộ từ
  (biến hình đều suy theo luật -s/-ed/-ing/-er/-ly; bất quy tắc lấy mục US của kaikki; không có dữ liệu thì để
  trống). Heteronym khai IPA theo nghĩa trong câu: `[ipa=read:rɛd]`, xác nhận dạng từ điển `[ipa=close:=]`.
- Câu đang nói highlight, từ đang đọc tô vàng, tự cuộn (nhường 4 s khi người dùng cuộn), bấm câu = tua,
  lặp câu, tốc độ 0,75/1/1,25, phím Space/←/→/R.
- **Nói theo** (shadowing): dừng sau mỗi câu một nhịp ≈ 1,15 × độ dài câu. **Nhập vai**: chọn vai; tới lượt vai đó
  thì dừng, hiện nghĩa Việt (+ gợi ý tiếng Anh), che chữ lượt của vai trong transcript, hết giờ phát câu mẫu.
- Xem hết bài → đánh dấu đã xem (`reads`, id `vd-…`; không tính vào huy hiệu bài đọc).

## 5. Nhân vật, cảnh, đạo cụ

- Rig SVG tham số (`components/video/rig.ts`): preset mom, dad, grandma, grandpa, man, woman, teenboy, teengirl,
  boy, girl, parrot + `style.*` (top, topShade, collar, accent, hair, hairColor, outfit, hat, scarf, glasses,
  sleeve, scale, **skin/skinShade** — nhân vật đa dạng sắc tộc như bối cảnh nói tiếng Anh thật). `accent` các vai
  trong bài khác nhau. Không thêm preset cho từng vai.
- Hoạt động suy từ timeline: nói (miệng theo đường bao âm lượng), nghe (quay về người nói), chớp mắt tất định;
  mọi chuyển động là **hàm thuần của t** (`pose.ts`) → tạm dừng/tua đúng khung, xuất MP4 sau này chỉ cần gọi lại.
- Biểu cảm: neutral happy surprised thinking confused sad tired tearful angry shy worried sick. Cử chỉ: nod shake
  point (chỉ `@đạo-cụ`) wave cheer fall bow shrug explain.
- Chọn `look` đúng tuổi/giới: người 24 tuổi dùng `man`/`woman`, không `teenboy`; nữ + `hair=short` dễ đọc thành
  nam → dùng bob/bun/ponytail/long. Đạo cụ lớn (tranh trên giá) không che biển/màn hình của bối cảnh.
- Bố cục: tâm hai nhân vật cùng lúc trong cảnh cách nhau **≥ 230** đơn vị (bộ kiểm cảnh báo); đạo cụ nhắc tới đặt
  gần người chỉ; bong bóng của người ở ô gọi dễ bị đọc nhầm là của người đứng gần — đặt bong bóng ở lượt của
  người trong cảnh.
- Vào/rời cảnh `from=`/`until=` (chỉ số lượt); người ở đầu dây `call` (+ `call.bg=`). Đạo cụ `prop:` (x, y, back,
  scale, from, until); `@id` trong lượt = đạo cụ được nhắc (nảy / được chỉ). Bong bóng `~id` / `~clock:7:30`,
  `~money:25`, `~person:anna`, `~call:mom`, `~photo:tom,anna`, `~message:3` ≤ 2–3 bong bóng/bài.
- Bối cảnh: home-evening home-day home-lake kitchen classroom campus-gate library office service-hall hospital
  supermarket market cafe restaurant street train car airport park riverside village snow-yard mountain-night
  sea-dawn stage. Asset mới = thêm id ở `lib/video-assets.ts` + vẽ trong module tương ứng (TypeScript bắt thiếu).

## 6. Nguồn bài (`content/videos/{cấp}/vd-*.txt`)

```text
=== vd-b1-the-lost-key
title: Have You Seen My Keys? | Có ai thấy chìa khoá của bố không?
source: st-b1-the-lost-key
summary: Sáng thứ Hai, bố cuống cuồng tìm chìa khoá… (tiếng Việt, 1 câu)
scene: home-day
prop: laptop x=980
cast: tom name=Tom vi=Bố look=dad x=430 voice=en-US-GuyNeural
cast: anna name=Anna look=teengirl x=1160 voice=en-US-EmmaNeural pitch=+6Hz style.hairColor=#8B5A2B
words: pocket; in a hurry = đang vội
focus: Hỏi đồ vật ở đâu và gợi ý chỗ tìm
pattern: Have you seen…? · Did you check…? · It might be in/under…
explain: … (tiếng Việt)
keys: have you seen / did you check / might be

tom: Anna, have you seen my keys? | Anna, con có thấy chìa khoá của bố không? [worried]
anna: Did you check your jacket pocket? | Bố xem túi áo khoác chưa? [thinking @laptop tom:confused]
```

Build: `npm run content:build` → `public/data/library/videos/{id}.json`, `videos-index.json`,
`public/audio/library/videos/{id}.mp3` (bài chưa có audio chưa được xuất bản).

## 7. Hiệu năng

- Không thêm thư viện runtime. Chunk route `/video` = player + rig; bối cảnh/đạo cụ/bong bóng là chunk riêng tải
  theo bài (1–4 KB gzip mỗi chunk), cache 1 năm; bài sau cùng asset vẽ ngay.
- Lesson JSON ~10–25 KB; audio 64 kbps ≈ 8 KB/giây, `?v=<hash>`, `preload="metadata"`: mở bài = JSON + asset + 1
  Range lấy metadata; bấm phát mới tải.

## 8. Checklist

- [ ] `npm run content:check` không ✗ (heteronym, người nói vắng mặt, asset lạ, từ đích vắng, focus thiếu).
- [ ] Build in "✓ đồng bộ" mọi bài; mốc từ ≥ 95% số từ.
- [ ] Soát hình: `BASE=http://localhost:3012 node scripts/video-frames.mjs [id…|--level c2]` → contact sheet cảnh
      giữa từng câu: ai vào/ra đúng câu, cử chỉ không vắt ngang người khác, đạo cụ/bong bóng rõ, không ai bị cắt
      mép, ngoại hình hợp tuổi/giới. Bài mới lần đầu có thể "không tải được cảnh" (dev server đang biên dịch) →
      chạy lại riêng bài đó; chạy song song thì mỗi tiến trình một `PORT`.
- [ ] Phát thật ở 390 px + desktop: highlight câu/từ, tự cuộn, bấm câu, lặp, tốc độ, luyện nghe, nói theo, nhập vai,
      `scrollWidth == clientWidth`.
