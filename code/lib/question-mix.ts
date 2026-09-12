// Tỉ trọng các DẠNG câu hỏi trong phiên ôn — hàm thuần, không phụ thuộc gì (unit-test thẳng).
// Tách khỏi review-session.ts vì file đó import ts-fsrs nên không chạy được ngoài trình duyệt.
import type { SrsConfig } from "./types";
import type { CardStage } from "./srs-pure";

export type QuestionKind = "recog" | "recall" | "listen" | "cloze" | "spell";

/**
 * Ramp 3 giai đoạn theo độ chín của thẻ (cardStage) — chống "vòng lặp tap 1/4 nhàm" bằng cách
 * đưa GÕ CHÍNH TẢ (sản sinh thật, không có sẵn đáp án) vào SỚM nhưng không quá sớm:
 *  - young  (mới gặp 1–2 lần):  30 nhận diện · 30 nhớ lại · 20 cloze · 20 nghe — CHƯA gõ (gõ từ
 *                               vừa thấy vài lần → sai liên tục → nản, phản tác dụng).
 *  - growing (≥3 lần / bền ≥7 ngày): 30 cloze · 20 GÕ · 20 nhớ lại · 10 nhận diện · 20 nghe —
 *                               gõ chính tả xuất hiện, cắt mạnh nhận diện dễ.
 *  - mature (nhớ bền ≥21 ngày): 35 cloze · 30 GÕ · 15 nhớ lại · 20 nghe — nặng sản sinh, bỏ nhận diện.
 * Người học tắt được nghe/cloze/gõ trong Cài đặt → bỏ khỏi danh sách rồi CHUẨN HOÁ lại trọng số.
 * Tắt ÂM THANH (soundEnabled) cũng bỏ câu nghe dù listenEnabled còn bật — không có tiếng thì không làm được.
 * Luôn còn "nhớ lại" (young/growing còn cả "nhận diện") nên tắt hết dạng phụ vẫn ôn được.
 */
export function questionMix(config: SrsConfig, stage: CardStage): [QuestionKind, number][] {
  const on = (flag: boolean | undefined, weight: number) => (flag !== false ? weight : 0);
  const listenOk = config.listenEnabled !== false && config.soundEnabled !== false;
  const mix: [QuestionKind, number][] =
    stage === "mature"
      ? [
          ["cloze", on(config.clozeEnabled, 35)],
          ["spell", on(config.spelling, 30)],
          ["recall", 15],
          ["listen", on(listenOk, 20)],
        ]
      : stage === "growing"
        ? [
            ["cloze", on(config.clozeEnabled, 30)],
            ["spell", on(config.spelling, 20)],
            ["recall", 20],
            ["recog", 10],
            ["listen", on(listenOk, 20)],
          ]
        : [
            // young — chưa đưa gõ chính tả, nhưng đã trộn cloze + nghe để bớt đơn điệu.
            ["recog", 30],
            ["recall", 30],
            ["cloze", on(config.clozeEnabled, 20)],
            ["listen", on(listenOk, 20)],
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
