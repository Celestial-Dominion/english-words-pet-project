import { test, expect, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Câu hỏi đọc hiểu cuối bài đọc / chương truyện (components/library/quiz.tsx): chọn là chấm ngay và khoá câu đó,
// lộ bản dịch + lời giải thích «trích nguyên văn», tổng điểm và Làm lại; truyện có bộ câu hỏi riêng từng chương.
// Bài phỏng theo nguồn mở hiện dòng ghi nguồn (tên gốc, giấy phép, liên kết GitHub).

type Q = { q: { en: string; vi: string }; opts: { en: string; vi: string }[]; a: number; why: string };
type Source = { title: string; url: string };
const doc = <T,>(kind: "readings" | "stories", id: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", "library", kind, `${id}.json`), "utf8")) as T;

// Phương án là nút chứa nguyên câu tiếng Anh (chữ trong câu hỏi cũng là nút tra từ, nhưng chỉ chứa một từ).
const option = (item: Locator, text: string) => item.getByRole("button").filter({ hasText: text });

test("bài đọc: chấm ngay, khoá câu đã chọn, giải thích trích bài, tổng điểm và Làm lại", async ({ page }) => {
  const id = "rd-c2-lost-in-the-maze";
  const d = doc<{ quiz: Q[]; source: Source }>("readings", id);
  const n = d.quiz.length;
  await page.goto(`/bai-doc/c2/${id}`);

  await expect(page.getByText(`«${d.source.title}»`)).toBeVisible();
  await expect(page.getByRole("link", { name: /Nguồn GitHub/ })).toHaveAttribute("href", d.source.url);

  const quiz = page.getByRole("region", { name: "Câu hỏi đọc hiểu" });
  await expect(quiz.getByText(`0/${n}`, { exact: true })).toBeVisible();
  const items = quiz.locator("ol > li");
  await expect(items).toHaveCount(n);

  // Câu 1 chọn đúng: báo Đúng., hiện bản dịch câu hỏi + lời giải thích, mọi phương án bị khoá.
  const q1 = items.nth(0);
  await expect(q1.getByText(d.quiz[0].q.vi)).toHaveCount(0);
  await option(q1, d.quiz[0].opts[d.quiz[0].a].en).click();
  await expect(q1.getByText("Đúng.", { exact: true })).toBeVisible();
  await expect(q1.getByText(d.quiz[0].q.vi)).toBeVisible();
  const quote = /«([^»]+)»/.exec(d.quiz[0].why)![1];
  await expect(q1.getByText(`«${quote}»`)).toBeVisible();
  for (const o of d.quiz[0].opts) await expect(option(q1, o.en)).toBeDisabled();
  await expect(quiz.getByText(`1/${n}`, { exact: true })).toBeVisible();

  // Câu 2 chọn sai: báo Chưa đúng., không đổi được nữa.
  const q2 = items.nth(1);
  const wrong = d.quiz[1].opts.findIndex((_, k) => k !== d.quiz[1].a);
  await option(q2, d.quiz[1].opts[wrong].en).click();
  await expect(q2.getByText("Chưa đúng.", { exact: true })).toBeVisible();
  await expect(option(q2, d.quiz[1].opts[d.quiz[1].a].en)).toBeDisabled();

  for (let i = 2; i < n; i++) await option(items.nth(i), d.quiz[i].opts[d.quiz[i].a].en).click();
  await expect(quiz.getByText(`Đúng ${n - 1}/${n} câu`)).toBeVisible();

  await quiz.getByRole("button", { name: /Làm lại/ }).click();
  await expect(quiz.getByText(`0/${n}`, { exact: true })).toBeVisible();
  await expect(q1.getByText("Đúng.", { exact: true })).toHaveCount(0);
  await expect(option(q1, d.quiz[0].opts[0].en)).toBeEnabled();
});

test("truyện: mỗi chương một bộ câu hỏi, đổi chương là bộ mới chưa trả lời", async ({ page }) => {
  const id = "st-c2-tobermory";
  const d = doc<{ chapters: { quiz: Q[] }[]; source: Source }>("stories", id);
  await page.goto(`/truyen/c2/${id}`);
  await expect(page.getByRole("link", { name: /Nguồn GitHub/ })).toHaveAttribute("href", d.source.url);

  const c1 = d.chapters[0].quiz;
  const quiz1 = page.getByRole("region", { name: "Câu hỏi · Chương 1" });
  await expect(quiz1.locator("ol > li")).toHaveCount(c1.length);
  await option(quiz1.locator("ol > li").nth(0), c1[0].opts[c1[0].a].en).click();
  await expect(quiz1.getByText(`1/${c1.length}`, { exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Chương" }).getByRole("button", { name: "2", exact: true }).click();
  const c2 = d.chapters[1].quiz;
  const quiz2 = page.getByRole("region", { name: "Câu hỏi · Chương 2" });
  await expect(quiz2.getByText(`0/${c2.length}`, { exact: true })).toBeVisible();
  await expect(option(quiz2.locator("ol > li").nth(0), c2[0].opts[c2[0].a].en)).toBeEnabled();
  await expect(page.getByRole("region", { name: "Câu hỏi · Chương 1" })).toHaveCount(0);
});
