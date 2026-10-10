// Thông số theo cấp + taxonomy dùng chung cho check/coverage/build (docs/ENGLISH_CONTENT_PLAYBOOK.md §2, §5).
// Số ở đây là MỐC CẢNH BÁO (không chặn build) — chỉnh khi số liệu thật cho thấy mốc sai.

export const TOPICS = [
  "daily-life", "family", "travel", "food", "education", "work", "technology", "science", "health", "psychology",
  "history", "geography", "environment", "society", "economics", "business", "communication", "culture", "art",
  "literature", "philosophy", "ethics", "media", "cities", "nature", "innovation",
];

export const GENRES = [
  "description", "narrative", "informational", "explanation", "how-to", "comparison", "cause-effect", "biography",
  "news", "interview", "opinion", "review", "argument", "analysis", "case-study", "practical", "letter",
];

// words = số từ bài đọc; sent = câu trung bình (từ/câu) [min, max]; over = tỉ lệ token vượt cấp tối đa;
// density = tỉ lệ token ĐÚNG cấp tối thiểu (bài "dễ hơn cấp" thì cảnh báo); wpm = tốc độ đọc ước lượng;
// quiz = độ dài tối đa (số từ) của câu hỏi đọc hiểu / mỗi phương án (scripts/lib/quiz-check.mjs).
export const SPEC = {
  a1: { words: [80, 150], sent: [4, 10.5], over: 0.012, density: 0, wpm: 70, rate: "-15%", story: { ch: [3, 3], words: [280, 520] }, video: { lines: [8, 12], rate: "-12%" }, topics: 12, quiz: { q: 10, opt: 8 } },
  a2: { words: [120, 220], sent: [6, 13.5], over: 0.02, density: 0.07, wpm: 90, rate: "-10%", story: { ch: [4, 4], words: [380, 820] }, video: { lines: [10, 14], rate: "-8%" }, topics: 12, quiz: { q: 13, opt: 10 } },
  b1: { words: [180, 320], sent: [9, 16.5], over: 0.03, density: 0.05, wpm: 110, rate: "-5%", story: { ch: [5, 5], words: [600, 1100] }, video: { lines: [12, 18], rate: "-4%" }, topics: 18, quiz: { q: 16, opt: 13 } },
  b2: { words: [250, 450], sent: [12, 20.5], over: 0.04, density: 0.05, wpm: 130, rate: "+0%", story: { ch: [5, 6], words: [800, 1450] }, video: { lines: [14, 22], rate: "+0%" }, topics: 18, quiz: { q: 20, opt: 16 } },
  c1: { words: [350, 650], sent: [15, 24.5], over: 0.05, density: 0.045, wpm: 150, rate: "+0%", story: { ch: [5, 6], words: [1000, 1800] }, video: { lines: [16, 24], rate: "+0%" }, topics: 18, quiz: { q: 24, opt: 18 } },
  c2: { words: [450, 800], sent: [17, 28.5], over: 1, density: 0.035, wpm: 170, rate: "+0%", story: { ch: [5, 7], words: [1100, 2000] }, video: { lines: [18, 28], rate: "+0%" }, topics: 18, quiz: { q: 28, opt: 20 } },
};

// Mục tiêu "học hết là đủ lên cấp" (docs/ENGLISH_CONTENT_PLAYBOOK.md §15) — đo: `npm run content:coverage -- --targets`.
// cov1 / cov3 / cov5 = tỉ lệ từ của danh sách cấp L gặp trong ≥ 1 / ≥ 3 / ≥ 5 bài KHÁC NHAU (đọc · truyện · video) ở cấp ≤ L;
// hours = giờ đọc bài đọc + truyện của cấp (theo wpm); topic = số bài đọc tối thiểu cho MỖI chủ đề TOPICS;
// genres = thể loại phải có, mỗi thể loại ≥ genreMin bài đọc. "Mục tiêu 2.0" (10/2026): nâng ≥3, thêm ≥5, +~20% giờ đọc.
// Ban đầu chỉ đặt cho A1–C1 (06/10/2026); 10/10/2026 chủ app mở thêm C2 theo đề xuất "Mục tiêu 2.0" (≥1 70%, ≥3 35%,
// 13 giờ; chủ đề/thể loại theo cách đặt của C1; không đặt mốc ≥5).
export const TARGETS = {
  a1: { cov1: 0.98, cov3: 0.9, cov5: 0.65, hours: 8, topic: 2, genreMin: 3, genres: ["narrative", "description", "informational", "practical", "letter", "how-to", "news"] },
  a2: { cov1: 0.97, cov3: 0.8, cov5: 0.4, hours: 12, topic: 2, genreMin: 4, genres: ["narrative", "description", "informational", "practical", "letter", "how-to", "news", "review", "biography"] },
  b1: { cov1: 0.96, cov3: 0.7, cov5: 0.35, hours: 20, topic: 3, genreMin: 5, genres: ["narrative", "explanation", "informational", "news", "opinion", "how-to", "letter", "biography", "review", "interview"] },
  b2: { cov1: 0.9, cov3: 0.6, cov5: 0.3, hours: 20, topic: 3, genreMin: 5, genres: ["narrative", "explanation", "analysis", "argument", "news", "opinion", "review", "interview", "case-study", "biography", "letter", "comparison"] },
  c1: { cov1: 0.87, cov3: 0.5, cov5: 0.25, hours: 21, topic: 3, genreMin: 5, genres: ["narrative", "analysis", "argument", "explanation", "opinion", "review", "case-study", "biography", "interview", "comparison", "description"] },
  c2: { cov1: 0.7, cov3: 0.35, hours: 13, topic: 3, genreMin: 5, genres: ["narrative", "analysis", "argument", "explanation", "opinion", "review", "case-study", "biography", "interview", "comparison", "description"] },
};

export const NARRATOR = "en-US-AriaNeural";

// Giọng en-US dùng cho nhân vật Video (GA — cùng chuẩn IPA của bộ từ). Không dùng giọng en-GB/AU.
export const VOICES = new Set([
  "en-US-AnaNeural", "en-US-AndrewNeural", "en-US-AriaNeural", "en-US-AvaNeural", "en-US-BrianNeural",
  "en-US-ChristopherNeural", "en-US-EmmaNeural", "en-US-EricNeural", "en-US-GuyNeural", "en-US-JennyNeural",
  "en-US-MichelleNeural", "en-US-RogerNeural", "en-US-SteffanNeural",
]);

export const minutesOf = (words, level) => Math.max(1, Math.round((words / SPEC[level].wpm) * 10) / 10);

// Giấy phép nhận cho bài phỏng theo nguồn mở (header license:) → nhãn + liên kết hiển thị (lib/library-labels.ts LICENSES
// phải khớp). Mặc định nhận PD / CC0 / CC BY. App chỉ dùng cá nhân, phi thương mại, nên chủ app cho nhận thêm
// CC BY-NC và CC BY-NC-SA (truyện tranh thiếu nhi African Storybook / LIDA), CC BY-SA (Wikipedia, Wikivoyage — bài phái
// sinh giữ cùng giấy phép). Không nhận ND (cấm phái sinh).
export const LICENSES = {
  "public domain": { label: "Phạm vi công cộng", url: "https://creativecommons.org/publicdomain/mark/1.0/deed.vi" },
  "CC0 1.0": { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/deed.vi" },
  "CC BY 3.0": { label: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/deed.vi" },
  "CC BY 4.0": { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.vi" },
  "CC BY-NC 4.0": { label: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/deed.vi" },
  "CC BY-NC-SA 4.0": { label: "CC BY-NC-SA 4.0", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.vi" },
  "CC BY-SA 3.0": { label: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/deed.vi" },
  "CC BY-SA 4.0": { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/deed.vi" },
};
