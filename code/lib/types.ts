// Kiểu dữ liệu dùng chung cho toàn app học từ vựng tiếng Anh (B1–C2).

export interface Word {
  id: string; // lemma chính tả Mỹ, có thể đa từ ("give up")
  ipa: string; // General American, khớp giọng TTS (vd /ˈwɔːtɚ/)
  pos: string[]; // n, v, adj, adv, phr-v, idiom… (map lib/pos.ts)
  irregular?: {
    past: string; // went
    participle: string; // gone
  };
  plural?: string; // chỉ danh từ bất quy tắc (child → children)
  variants?: string[]; // chính tả Anh ("colour"), dạng viết khác
  register?: string[]; // formal | informal | academic | literary | slang | dated
  family?: string[]; // họ từ: id các lemma cùng gốc có trong bộ từ
  collocations?: string[]; // "make a decision", "heavy rain" (3–5 cụm)
  meaning_vi: string;
  meaning_en: string[]; // nghĩa/định nghĩa EN (Wiktionary)
  level: number; // 0 = nền (A1–A2, chỉ tra cứu), 1..4 = B1..C2
  frequency: number; // hạng tần suất wordfreq
  forms?: string[]; // mọi dạng biến hình để tra ngược (goes, went, gone, going)
  search: string; // chuỗi thường-hoá (gồm cả variants) để tìm kiếm
}

// Chỉ mục từ rút gọn: id -> [ipa, meaning_vi]
export type WordIndex = Record<string, [string, string]>;

// Câu ví dụ (≥2 câu/từ, mục tiêu 3 cho B1–B2). public/data/examples/…
export interface Example {
  wordId: string;
  en: string;
  vi: string;
}

// ---- SRS ----

// Bản ghi ôn tập (1 thẻ / mỗi wordId). Lưu đủ tham số FSRS (Card).
export interface ReviewRecord {
  wordId: string;
  level: number;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number; // 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review?: Date;
  introducedOn: string; // "YYYY-MM-DD" (giờ địa phương)
}

export type ReviewDirection = "en2vi" | "vi2en"; // Anh→nghĩa / nghĩa→Anh

export interface SrsConfig {
  newPerDay: number;
  reviewPerSession: number; // giới hạn thẻ đến hạn mỗi phiên ôn (0 = không giới hạn)
  direction: ReviewDirection;
  newLevel: number; // 0 = tự động (cấp thấp nhất còn từ chưa học); 1..4 = cố định
  arrangePerWord: number; // số câu "sắp xếp câu" mỗi từ (0 = tắt). Mặc định 1.
  recallFirst: boolean; // ẩn đáp án, bắt "nhớ lại" trước khi hiện.
  spelling: boolean; // xen câu GÕ CHÍNH TẢ từ thẻ đang bền (≥3 lần gặp / bền ≥7 ngày) trở đi.
  listenEnabled: boolean; // cho phép dạng NGHE → chọn nghĩa trong bài chính.
  clozeEnabled: boolean; // CŨ: bật/tắt điền câu. Giữ để config đã sync tương thích ngược.
  // Số câu điền mỗi từ (0 = tắt), như arrangePerWord. Không đặt trong DEFAULT:
  // config cũ chỉ có clozeEnabled, nơi dùng suy ra true→1 / false→0 để không
  // ghi đè lựa chọn tắt của người dùng cũ.
  clozePerWord?: number;
  autoAdvance: boolean; // trả lời ĐÚNG → tự sang thẻ kế.
  sentenceVi: boolean; // hiện NGHĨA câu ngay từ đầu ở điền từ & ghép câu; TẮT (mặc định) = làm xong mới hiện.
  // Trộn các đợt của mọi từ; cùng một từ được giãn cách ≥3 đợt.
  interleave?: boolean;
  // Tỉ lệ token đã biết tối thiểu khi ưu tiên câu điền/ghép. 0 = tắt.
  // Nếu không có câu đạt ngưỡng, vẫn lấy câu có tỉ lệ cao nhất thay vì bỏ bài.
  sentenceKnownMin: number;
  // 🔊 Công tắc ÂM THANH tổng: tự đọc từ/câu khi hiện thẻ & sau khi trả lời, câu hỏi NGHE, nhạc chúc mừng,
  // bài Nghe & gõ câu. TẮT khi học ở nơi không mở tiếng được — nút loa bấm tay vẫn phát (chủ ý người dùng).
  soundEnabled: boolean;
}

export const DEFAULT_SRS_CONFIG: SrsConfig = {
  newPerDay: 5,
  reviewPerSession: 0,
  direction: "en2vi",
  newLevel: 0,
  arrangePerWord: 1,
  recallFirst: true,
  spelling: true,
  listenEnabled: true,
  clozeEnabled: true,
  autoAdvance: true,
  sentenceVi: false, // ẩn nghĩa lúc đang làm — không bị bản dịch mớm đáp án
  interleave: true,
  sentenceKnownMin: 0.7,
  soundEnabled: true,
};

// ---- Nhật ký từng lượt chấm (revlog — như HSK) ----
// Bảng reviews chỉ giữ trạng thái MỚI NHẤT của thẻ; revlog giữ lịch sử TỪNG lượt —
// nguyên liệu để sau này tối ưu tham số FSRS cá nhân hoá. Chỉ nằm local (không sync),
// có trong tệp sao lưu để đổi máy không mất; giữ 2 năm, phần cũ hơn tự dọn.
export interface RevlogRow {
  id?: number; // ++id tự tăng (Dexie)
  wordId: string;
  at: number; // ms epoch — thời điểm chấm
  rating: number; // 1=Lại 2=Khó 3=Được 4=Dễ
  state: number; // trạng thái thẻ TRƯỚC lượt chấm (New/Learning/Review/Relearning)
  elapsed_days: number;
  scheduled_days: number;
  stability: number; // SAU khi chấm
  difficulty: number;
}

// ---- Tiến độ & chuỗi ngày ----

export interface DailyStat {
  date: string; // "YYYY-MM-DD"
  reviews: number;
  newCount: number;
  again: number;
}

export interface ReadRow {
  id: string;
  readAt: string; // ISO
  removedAt?: string; // ISO — bỏ đánh dấu sau khi đã đọc (tombstone để sync không "hồi sinh")
}

export interface NoteRow {
  wordId: string;
  text: string; // "" = đã xoá (tombstone cho sync)
  at?: number; // ms — lần sửa cuối (máy sửa sau thắng khi sync)
}

export interface GamifyRow {
  key: string; // "state"
  xp: number;
  freezes?: number; // 🧊 lượt đóng băng chuỗi còn lại
  frozenDates?: string[]; // các ngày đã được đóng băng (tính như có học)
  grantStreak?: number; // mốc chuỗi đã tặng freeze lần cuối (tặng mỗi mốc 7 ngày)
  maxCombo?: number; // 💥 chuỗi trả lời đúng liên tiếp dài nhất trong một phiên (max-merge)
  questsDone?: string[]; // nhiệm vụ ngày ĐÃ NHẬN thưởng, khoá "YYYY-MM-DD:qid" (union-merge, dọn >14 ngày)
}
