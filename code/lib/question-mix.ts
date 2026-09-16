// Tỉ trọng các DẠNG câu hỏi trong phiên ôn — hàm thuần, không phụ thuộc gì (unit-test thẳng).
// Tách khỏi review-session.ts vì file đó import ts-fsrs nên không chạy được ngoài trình duyệt.
import type { SrsConfig } from "./types";
import type { CardStage } from "./srs-pure";

export type QuestionKind = "recog" | "recall" | "listen" | "spell";

/**
 * Ramp 3 giai đoạn cho BÀI CHÍNH duy nhất chấm FSRS. Điền câu đã trở
 * thành đợt luyện phụ riêng (0..5 câu/từ), không còn tranh một suất với bài
 * nhận biết/nhớ từ và không chấm lịch lần thứ hai.
 *  - young: 38 nhận diện · 37 nhớ lại · 25 nghe — chưa gõ.
 *  - growing: 14 nhận diện · 28 nhớ lại · 29 gõ · 29 nghe.
 *  - mature: 35 nhớ lại · 40 gõ · 25 nghe — nặng sản sinh.
 * Người học tắt được nghe/gõ; các dạng còn lại tự chia lại xác suất.
 * Tắt ÂM THANH (soundEnabled) cũng bỏ câu nghe dù listenEnabled còn bật — không có tiếng thì không làm được.
 * Luôn còn "nhớ lại" (young/growing còn cả "nhận diện") nên tắt hết dạng phụ vẫn ôn được.
 */
export function questionMix(config: SrsConfig, stage: CardStage): [QuestionKind, number][] {
  const on = (flag: boolean | undefined, weight: number) => (flag !== false ? weight : 0);
  const listenOk = config.listenEnabled !== false && config.soundEnabled !== false;
  const mix: [QuestionKind, number][] =
    stage === "mature"
      ? [
          ["recall", 35],
          ["spell", on(config.spelling, 40)],
          ["listen", on(listenOk, 25)],
        ]
      : stage === "growing"
        ? [
            ["recog", 14],
            ["recall", 28],
            ["spell", on(config.spelling, 29)],
            ["listen", on(listenOk, 29)],
          ]
        : [
            ["recog", 38],
            ["recall", 37],
            ["listen", on(listenOk, 25)],
          ];
  return mix.filter(([, weight]) => weight > 0);
}

/** Bốc một dạng theo trọng số. `rnd` ∈ [0,1) — truyền vào để test tất định. */
export function pickQuestionKind(config: SrsConfig, stage: CardStage, rnd = Math.random()): QuestionKind {
  const mix = questionMix(config, stage);
  const total = mix.reduce((s, [, weight]) => s + weight, 0);
  let left = rnd * total;
  for (const [kind, weight] of mix) {
    left -= weight;
    if (left <= 0) return kind;
  }
  return mix[mix.length - 1]?.[0] ?? "recall";
}
