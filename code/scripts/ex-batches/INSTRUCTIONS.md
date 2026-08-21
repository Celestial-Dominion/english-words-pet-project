# Hướng dẫn viết câu ví dụ (Phase E2)

Mỗi batch là file JSON `lv{level}-{nnn}.json`, dạng:

```json
[{ "id": "achieve", "pos": ["v"], "vi": "đạt được; giành được", "coll": ["achieve a goal"] }]
```

Ghi kết quả vào `../ex-done/` với **cùng tên file**, dạng:

```json
{
  "achieve": [
    "She worked hard to achieve her goal.|Cô ấy đã làm việc chăm chỉ để đạt được mục tiêu.",
    "You can achieve anything if you keep trying.|Bạn có thể đạt được bất cứ điều gì nếu tiếp tục cố gắng.",
    "The team achieved record sales last quarter.|Đội đã đạt doanh số kỷ lục quý trước."
  ]
}
```

Mỗi phần tử là một chuỗi `"câu tiếng Anh|bản dịch tiếng Việt"` (ngăn bằng ký tự `|`).

## Quy tắc

1. **3 câu mỗi từ** (B1/B2). Câu phải chứa **đúng từ đó** (dạng chia bất kỳ: *achieve/achieved/achieving*).
   Phrasal verb: dùng cả cụm, có thể tách (*gave it up*) ở 1 câu.
2. **Ngắn, tự nhiên, đời thường** — 6–14 từ. Văn phong người bản ngữ nói/viết thật, KHÔNG sách giáo khoa,
   KHÔNG câu bịa gượng ép.
3. **Đa dạng ngữ cảnh** giữa 3 câu: đừng lặp cùng một khung câu. Ưu tiên 1 câu dùng collocation trong `coll`.
4. Nếu từ đa nghĩa (`vi` có nhiều nghĩa cách nhau `;`): câu 1 dùng **nghĩa đầu**, các câu sau có thể minh
   hoạ nghĩa khác.
5. Bản dịch tiếng Việt **tự nhiên**, không dịch máy, không word-by-word.
6. Từ có sắc thái (formal/slang/academic): đặt câu đúng ngữ cảnh đó.
7. KHÔNG dùng ký tự `|` trong nội dung câu (nó là dấu ngăn).
8. Chính tả **Anh-Mỹ** (color, organize, center).

## Định dạng đầu ra

JSON hợp lệ tuyệt đối, key = đúng `id` trong batch (100% từ phải có mặt), mỗi value là mảng 3 chuỗi.
Không markdown, không lời dẫn.
