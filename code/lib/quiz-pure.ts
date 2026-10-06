// Logic thuần của câu hỏi đọc hiểu (components/library/quiz.tsx) — có test: scripts/test-content.mjs.

// Thứ tự hiện phương án: xáo Fisher–Yates mỗi lần mở/làm lại (đáp án đúng không đứng cố định).
// rand tiêm vào được để test tất định.
export function shuffledOrder(n: number, rand: () => number = Math.random): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Điểm: picks[i] = chỉ số phương án GỐC đã chọn cho câu i (undefined = chưa chọn).
export function quizScore(
  answers: readonly number[],
  picks: readonly (number | undefined)[],
): { done: number; correct: number; total: number } {
  let done = 0;
  let correct = 0;
  answers.forEach((a, i) => {
    if (picks[i] === undefined) return;
    done++;
    if (picks[i] === a) correct++;
  });
  return { done, correct, total: answers.length };
}

// Lời giải thích: tách «trích dẫn nguyên văn» để tô riêng → [{text, quote}].
export function splitQuotes(why: string): { text: string; quote: boolean }[] {
  const out: { text: string; quote: boolean }[] = [];
  let last = 0;
  for (const m of why.matchAll(/«([^»]+)»/g)) {
    if (m.index > last) out.push({ text: why.slice(last, m.index), quote: false });
    out.push({ text: m[1], quote: true });
    last = m.index + m[0].length;
  }
  if (last < why.length) out.push({ text: why.slice(last), quote: false });
  return out;
}
