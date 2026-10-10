// Bảng nhãn của thư viện: chủ đề, thể loại, giấy phép nguồn mở (khoá PHẢI khớp scripts/lib/content-spec.mjs).
// CHỈ chứa dữ liệu — next.config.ts không tính file này vào mã build, nên đợt nội dung thêm chủ đề/giấy phép
// không làm mọi trang phải tải lại khi deploy. Logic để ở lib/library.ts.

// Taxonomy chủ đề.
export const TOPICS: Record<string, string> = {
  "daily-life": "Đời sống",
  family: "Gia đình",
  travel: "Du lịch",
  food: "Ẩm thực",
  education: "Giáo dục",
  work: "Công việc",
  technology: "Công nghệ",
  science: "Khoa học",
  health: "Sức khỏe",
  psychology: "Tâm lý",
  history: "Lịch sử",
  geography: "Địa lý",
  environment: "Môi trường",
  society: "Xã hội",
  economics: "Kinh tế",
  business: "Kinh doanh",
  communication: "Giao tiếp",
  culture: "Văn hóa",
  art: "Nghệ thuật",
  literature: "Văn học",
  philosophy: "Triết học",
  ethics: "Đạo đức",
  media: "Truyền thông",
  cities: "Đô thị",
  nature: "Thiên nhiên",
  innovation: "Đổi mới",
};

export const GENRES: Record<string, string> = {
  description: "Miêu tả",
  narrative: "Tự sự",
  informational: "Thông tin",
  explanation: "Giải thích",
  "how-to": "Hướng dẫn",
  comparison: "So sánh",
  "cause-effect": "Nhân – quả",
  biography: "Tiểu sử",
  news: "Tin tức",
  interview: "Phỏng vấn",
  opinion: "Quan điểm",
  review: "Đánh giá",
  argument: "Lập luận",
  analysis: "Phân tích",
  "case-study": "Tình huống",
  practical: "Văn bản thực dụng",
  letter: "Thư / email",
};

// Giấy phép: khoá = header license: của bài → nhãn + liên kết bản tóm tắt giấy phép.
export const LICENSES: Record<string, { label: string; url: string }> = {
  "public domain": { label: "Phạm vi công cộng", url: "https://creativecommons.org/publicdomain/mark/1.0/deed.vi" },
  "CC0 1.0": { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/deed.vi" },
  "CC BY 3.0": { label: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/deed.vi" },
  "CC BY 4.0": { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.vi" },
  "CC BY-NC 4.0": { label: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/deed.vi" },
  "CC BY-NC-SA 4.0": { label: "CC BY-NC-SA 4.0", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.vi" },
  "CC BY-SA 3.0": { label: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/deed.vi" },
  "CC BY-SA 4.0": { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/deed.vi" },
};
