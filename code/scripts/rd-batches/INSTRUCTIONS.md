# Hướng dẫn dịch bài đọc (Phase E5)

Bài đọc lấy từ **nguồn mở**: Simple English Wikipedia (CC BY-SA) và Wikinews (CC BY 2.5).
Câu tiếng Anh đã có sẵn — **việc của bạn CHỈ LÀ DỊCH sang tiếng Việt**, không viết lại,
không thêm/bớt/gộp/tách câu.

Mỗi batch là file `{cefr}-{nn}.json`:

```json
[{
  "id": "wiki-user-guide",
  "level": 2,
  "src": "simplewiki",
  "url": "https://simple.wikipedia.org/wiki/User_guide",
  "title_en": "User guide",
  "sentences": ["A user guide, also called a user manual, is a book about how to use something.", "..."]
}]
```

Ghi kết quả vào `../rd-done/` với **cùng tên file**:

```json
[{
  "id": "wiki-user-guide",
  "title_vi": "Sách hướng dẫn sử dụng",
  "vi": [
    "Sách hướng dẫn sử dụng, còn gọi là cẩm nang người dùng, là cuốn sách chỉ cách dùng một thứ gì đó.",
    "..."
  ]
}]
```

## Quy tắc

1. **`vi` phải có ĐÚNG số phần tử bằng `sentences`** — dịch câu nào ra câu nấy, theo đúng thứ tự.
   Câu tiếng Anh dài thì bản dịch cũng là một câu (có thể dùng dấu phẩy), KHÔNG tách thành 2 phần tử.
2. Dịch **tự nhiên như người Việt viết**, không word-by-word, không dịch máy. Ưu tiên câu gọn,
   dễ hiểu — người đọc đang học tiếng Anh, bản dịch là để đối chiếu.
3. **Giữ nguyên tên riêng** (người, địa danh, tổ chức, thương hiệu) ở dạng gốc tiếng Anh.
   Tên nước/thành phố quen thuộc thì dùng tên Việt thông dụng (United States → Mỹ, London → London).
4. **Số liệu, đơn vị, năm tháng giữ nguyên**; có thể đổi định dạng ngày cho tự nhiên tiếng Việt.
5. `title_vi`: dịch tiêu đề ngắn gọn, tự nhiên (không cần bám sát từng chữ).
6. Thuật ngữ chuyên ngành: dùng thuật ngữ Việt phổ biến, mở ngoặc thuật ngữ Anh nếu cần
   ở lần xuất hiện đầu — ví dụ "hiệu ứng nhà kính (greenhouse effect)".
7. KHÔNG sửa/kiểm duyệt nội dung gốc. Nếu bài có chi tiết nhạy cảm thì dịch trung tính, đúng nghĩa.

## Định dạng đầu ra

JSON hợp lệ tuyệt đối — mảng các object, **đủ 100% bài trong batch**, mỗi object đúng 3 khoá
`id` / `title_vi` / `vi`. Không markdown, không lời dẫn, không copy lại `sentences`.
