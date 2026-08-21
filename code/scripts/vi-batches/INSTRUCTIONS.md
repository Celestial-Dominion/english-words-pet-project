# Hướng dẫn dịch nghĩa Việt (stage 2 của Phase E1)

Mỗi batch là một file JSON `lv{level}-{nnn}.json` trong thư mục này, dạng:

```json
[{ "id": "achieve", "pos": ["v"], "en": ["to succeed in reaching a goal"], "reg": ["formal"] }]
```

Agent dịch phải ghi kết quả vào `../vi-done/` với **cùng tên file**, dạng:

```json
{
  "achieve": {
    "vi": "đạt được; giành được",
    "coll": ["achieve a goal", "achieve success", "achieve results"]
  }
}
```

## Quy tắc dịch `vi`

1. **1–4 nghĩa, cách nhau "; ", nghĩa PHỔ BIẾN NHẤT đứng TRƯỚC** — app cắt phần trước dấu ";"
   làm phương án trắc nghiệm, nên nghĩa đầu phải ngắn (≤6 âm tiết) và đặc trưng cho từ.
2. Dịch kiểu **từ điển học tập** (ngắn, tự nhiên, người Việt hay dùng), KHÔNG dịch word-by-word
   định nghĩa tiếng Anh. `en` chỉ để tham khảo nghĩa nào phổ biến.
3. Đúng **từ loại** trong `pos` (n → danh từ, v → động từ…). Từ đa loại: nghĩa theo loại phổ
   biến nhất trước (vd "increase" v+n → "tăng; sự gia tăng").
4. `phr-v` (phrasal verb) dịch nghĩa CỦA CỤM, không dịch từng từ ("give up" → "từ bỏ; bỏ cuộc").
5. Có `reg` (register) thì nghĩa phải khớp sắc thái: formal → trang trọng, slang → chọn từ Việt
   suồng sã tương ứng, dated → chú "(cũ)" cuối nghĩa nếu cần.
6. KHÔNG thêm chú thích dài, KHÔNG đánh số, KHÔNG xuống dòng trong `vi`.

## Quy tắc `coll` (collocations)

- 3–5 cụm tiếng Anh **thật và phổ biến** chứa đúng từ đó (động từ + tân ngữ quen thuộc,
  tính từ + danh từ quen thuộc…). Không bịa cụm hiếm.
- Batch `lv0-*` (từ nền A1–A2) **bỏ qua coll** (để `"coll": []`).

## Định dạng đầu ra

- JSON hợp lệ tuyệt đối, key = đúng `id` trong batch (100% từ trong batch phải có mặt).
- Không thêm key lạ, không markdown, không lời dẫn.

## QA (đợt soát riêng)

Agent QA đọc ngẫu nhiên ≥30 từ/batch, đối chiếu `vi` với nghĩa thật của từ (theo hiểu biết +
`en`), sửa trực tiếp file trong `vi-done/` nếu sai nghĩa/sai từ loại/nghĩa đầu không phải nghĩa
phổ biến nhất, và ghi số lỗi tìm thấy ra báo cáo.
