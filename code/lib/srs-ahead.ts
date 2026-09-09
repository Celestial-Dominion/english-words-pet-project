// ---- ÔN SỚM (ahead): chọn thẻ CHƯA tới hạn để ôn trước lịch — phần THUẦN ----
// Chỉ import ts-fsrs (bare specifier) + type, không Dexie, không import tương đối runtime →
// unit test chạy thẳng bằng node (pattern srs-pure.ts).
//
// Bản cũ (db.getAheadReviews) xếp theo due gần nhất → toàn thẻ đang ở BƯỚC HỌC TRONG NGÀY
// (10m/1h/12h): từ vừa học / vừa quên chiếm hết chỗ, còn chấm sớm chỉ đẩy sang bước kế bất kể
// thời gian (ts-fsrs 5.4.1: Good sau 1 phút hay đúng hạn 10 phút cho cùng stability, cùng bước —
// đã kiểm bằng script) nên ba lượt ôn sớm liền là CÙNG nhóm từ đi hết các bước trong 20 phút;
// thẻ cũ (due tính bằng ngày) không bao giờ lọt. Bộ lọc & thứ tự mới:
//   • bỏ Learning/Relearning: chúng tự đến hạn trong vài giờ, phiên "đến hạn" lo. Chỉ LOẠI hai
//     trạng thái này (không đòi state === Review) để bản ghi cũ thiếu trường không biến mất;
//   • bỏ thẻ đã ôn trong NGÀY — ngày theo UTC, đúng cách next() của ts-fsrs tính elapsed_days
//     (dateDiffInDays theo ngày UTC → ranh giới 7h sáng giờ VN). Cùng ngày → elapsed 0 → R = 1
//     → stability KHÔNG đổi: ôn lại vô ích với lịch;
//   • xếp theo khả năng nhớ R (đường cong quên) TĂNG dần = "sắp quên nhất trước", tự trộn thẻ
//     cũ/mới theo phần kỳ hạn đã trôi. KHÔNG dùng get_retrievability của ts-fsrs: nó tính elapsed
//     theo floor 24h (lệch với next()) và ném lỗi khi thẻ thiếu last_review. Thẻ cùng đợt học có
//     R bằng nhau → lấy poolMult×limit thẻ đầu rồi rút ngẫu nhiên, tránh một lượt toàn thẻ của
//     1–2 ngày học.
import { dateDiffInDays, State } from "ts-fsrs";

export interface AheadCard {
  due: Date | string;
  state: number; // 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review?: Date | string;
  stability: number;
  scheduled_days: number;
}

// Số ngày (lịch UTC) từ lần ôn cuối tới `now` — cùng quy tắc next() của ts-fsrs.
// Thiếu last_review (bản ghi cũ) → ước từ due & scheduled_days, tối thiểu 1 để không
// bị loại oan là "đã ôn hôm nay".
export function elapsedDaysFor(rec: AheadCard, now: Date): number {
  if (rec.last_review) return Math.max(0, dateDiffInDays(new Date(rec.last_review), now));
  const left = Math.ceil((new Date(rec.due).getTime() - now.getTime()) / 86400000);
  return Math.max(1, (rec.scheduled_days ?? 0) - left);
}

export function isAheadEligible(rec: AheadCard, now: Date): boolean {
  if (new Date(rec.due) <= now) return false;
  if (rec.state === State.Learning || rec.state === State.Relearning) return false;
  return elapsedDaysFor(rec, now) >= 1;
}

// Chọn `limit` thẻ ôn sớm: lọc đủ điều kiện → R tăng dần → lấy poolMult×limit đầu →
// xáo (rnd truyền vào để test tất định) → cắt limit. `curve` = forgetting_curve của
// scheduler đang dùng (cùng tham số/decay với lúc chấm — lib/srs.ts forgettingCurve).
export function pickAhead<T extends AheadCard>(
  recs: T[],
  now: Date,
  limit: number,
  curve: (elapsedDays: number, stability: number) => number,
  rnd: () => number = Math.random,
  poolMult = 2,
): T[] {
  if (limit <= 0) return [];
  const pool = recs
    .filter((r) => isAheadEligible(r, now))
    .map((r) => ({ r, R: curve(elapsedDaysFor(r, now), r.stability) }))
    .sort((a, b) => a.R - b.R)
    .slice(0, limit * Math.max(1, poolMult))
    .map((x) => x.r);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}
