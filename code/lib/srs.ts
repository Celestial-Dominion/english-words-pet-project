// SRS bằng ts-fsrs — cấu hình CHẶT cho người hay quên (giữ đúng tinh thần app HSK).
import { ratingValueFromSpeed, type SpeedMode } from "./srs-pure";
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { ReviewRecord } from "./types";

// request_retention 0.97 (giữ 97%), tối đa 120 ngày; learning steps phút→giờ→12h.
export const FSRS_PARAMS = generatorParameters({
  request_retention: 0.97,
  maximum_interval: 120,
  learning_steps: ["1m", "10m", "1h", "12h"],
  relearning_steps: ["10m", "1h"],
  enable_fuzz: true,
  enable_short_term: true,
});

const f = fsrs(FSRS_PARAMS);

// Ôn tập trắc nghiệm tự chấm: đúng = Good, sai = Again (không có nút Khó/Dễ thủ công).
export const RATING = { wrong: Rating.Again as Grade, right: Rating.Good as Grade };

/** Thẻ mới (chưa học). */
export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

/** Lên lịch lại một thẻ sau khi trả lời. */
export function schedule(card: Card, correct: boolean, now: Date): Card {
  const { card: next } = f.next(card, now, correct ? RATING.right : RATING.wrong);
  return next;
}

/** Lên lịch với mức chấm cụ thể (Lại/Khó/Được/Dễ). */
export function scheduleRated(card: Card, rating: Grade, now: Date): Card {
  const { card: next } = f.next(card, now, rating);
  return next;
}

// Từ "hay quên" (leech) và từ "đã chín" — dùng để chọn loại câu hỏi + thẻ ôn lại kỹ.


/** ReviewRecord (lưu DB) → Card (ts-fsrs). */
export function recordToCard(r: ReviewRecord): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    learning_steps: r.learning_steps,
    state: r.state,
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  } as Card;
}

/** Card → phần FSRS của ReviewRecord (giữ nguyên wordId/level/introducedOn ở nơi gọi). */
export function cardToRecordFields(c: Card) {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: c.learning_steps ?? 0,
    state: c.state,
    last_review: c.last_review,
  };
}

// ---- phần THUẦN (test được không cần ts-fsrs/Dexie) — xem lib/srs-pure.ts ----
export { isLeech, isMature, cardStage, LEECH_LAPSES, MATURE_STABILITY, type CardStage } from "./srs-pure";

/** Chấm theo tốc độ, trả về Grade của ts-fsrs (logic thuần nằm ở srs-pure). */
export function ratingFromSpeed(correct: boolean, ms: number, mode?: SpeedMode): Grade {
  return ratingValueFromSpeed(correct, ms, mode) as Grade;
}
