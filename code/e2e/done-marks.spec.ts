import { test, expect, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Đánh dấu ĐÃ / CHƯA ở cả bốn mục (Bài đọc · Truyện · Video · Ngữ pháp): ô tích trên danh sách (tích / bỏ tích tại chỗ,
// không mở bài), nút trạng thái trong trang bài, thanh lọc theo trạng thái — và hai bên luôn khớp nhau. Bài đọc / truyện
// tự lên Đã đọc khi làm xong câu hỏi cuối bài (chương cuối) đúng từ 70%, không phải khi cuộn tới cuối.

type LibMeta = { id: string; level: string; title_en?: string; title?: { en: string } };
const lib = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", "library", name), "utf8")) as LibMeta[];
const grammarLessons = () =>
  (JSON.parse(readFileSync(join(process.cwd(), "public", "data", "grammar", "index.json"), "utf8")) as { lessons: { id: string; lv: string; t: string }[] }).lessons;

const pill = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const tick = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });

type QuizQ = { opts: { en: string }[]; a: number };
type ReadingDoc = { id: string; quiz: QuizQ[] };
type StoryDoc = { id: string; chapters: { quiz: QuizQ[] }[] };
const doc = <T>(dir: string, id: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", "library", dir, `${id}.json`), "utf8")) as T;

// Trả lời lần lượt từng câu: right[i] = chọn đáp án đúng hay một phương án sai. Nút phương án là nút có <span> con
// (nút từ bấm-tra trong câu hỏi chỉ có chữ).
async function answer(page: Page, quiz: Locator, qs: QuizQ[], right: boolean[]) {
  for (const [i, q] of qs.entries()) {
    const oi = right[i] ? q.a : (q.a + 1) % q.opts.length;
    await quiz
      .getByRole("listitem")
      .nth(i)
      .getByRole("button")
      .filter({ has: page.getByText(q.opts[oi].en, { exact: true }) })
      .click();
  }
}

test("bài đọc: tích / bỏ tích ngay trên danh sách, lọc Chưa đọc · Đã đọc, còn nguyên sau tải lại", async ({ page }) => {
  const [first, second] = lib("readings-index.json").filter((r) => r.level === "b1");
  await page.goto("/bai-doc/b1");
  const t1 = tick(page, `Đã đọc: ${first.title_en}`);
  await expect(t1).toHaveAttribute("aria-checked", "false");
  await t1.click();
  await expect(t1).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/\/bai-doc\/b1$/); // tích không mở bài

  await page.getByRole("radio", { name: /Đã đọc/ }).click();
  await expect(t1).toBeVisible();
  await expect(tick(page, `Đã đọc: ${second.title_en}`)).toHaveCount(0);
  await page.getByRole("radio", { name: /Chưa đọc/ }).click();
  await expect(t1).toHaveCount(0);
  await expect(tick(page, `Đã đọc: ${second.title_en}`)).toBeVisible();

  await page.reload();
  await expect(t1).toHaveAttribute("aria-checked", "true");
  await t1.click();
  await expect(t1).toHaveAttribute("aria-checked", "false");
});

test("bài đọc: câu hỏi cuối bài quyết định Đã đọc — sai thì nhắc, đạt 3/4 thì đánh dấu, làm lại sai vẫn giữ", async ({ page }) => {
  const r = lib("readings-index.json")
    .filter((x) => x.level === "b1")
    .map((x) => doc<ReadingDoc>("readings", x.id))
    .find((d) => d.quiz.length === 4)!;
  await page.goto(`/bai-doc/b1/${r.id}`);
  const quiz = page.getByRole("region", { name: "Câu hỏi đọc hiểu" });
  await expect(quiz.getByText("đúng từ 3/4 câu là tính Đã đọc", { exact: false })).toBeVisible();

  // Cuộn qua hết bài tới câu hỏi mà chưa làm → vẫn Chưa đọc.
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");

  // 2/4 → chưa đạt: giữ Chưa đọc + lời nhắc.
  await answer(page, quiz, r.quiz, [true, true, false, false]);
  await expect(quiz.getByText("Đúng 2/4 câu")).toBeVisible();
  await expect(quiz.getByText("Cần đúng từ 3/4 câu để tính bài Đã đọc")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");

  // Làm lại 3/4 → đạt: tự đánh dấu.
  await quiz.getByRole("button", { name: "Làm lại" }).click();
  await answer(page, quiz, r.quiz, [true, false, true, true]);
  await expect(pill(page, "Đã đọc")).toHaveAttribute("aria-pressed", "true");
  await expect(quiz.getByText("Đã đánh dấu bài: Đã đọc")).toBeVisible();
  await expect(quiz.getByText(/Cần đúng/)).toHaveCount(0);

  // Đã Đã đọc, làm lại sai hết → không tự bỏ đánh dấu.
  await quiz.getByRole("button", { name: "Làm lại" }).click();
  await answer(page, quiz, r.quiz, [false, false, false, false]);
  await expect(quiz.getByText("Đúng 0/4 câu")).toBeVisible();
  await expect(quiz.getByText("Đã đánh dấu bài: Đã đọc")).toBeVisible();
  await expect(pill(page, "Đã đọc")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(pill(page, "Đã đọc")).toHaveAttribute("aria-pressed", "true");
});

test("truyện: câu hỏi chương 1 không đổi trạng thái, chương cuối đạt mới Đã đọc", async ({ page }) => {
  const s = lib("stories-index.json")
    .filter((x) => x.level === "b1")
    .map((x) => doc<StoryDoc>("stories", x.id))
    .find((d) => d.chapters.length >= 2)!;
  const n = s.chapters.length;
  await page.goto(`/truyen/b1/${s.id}`);
  const quiz1 = page.getByRole("region", { name: "Câu hỏi · Chương 1" });
  await expect(quiz1.getByText(/là tính Đã đọc/)).toHaveCount(0);
  await answer(page, quiz1, s.chapters[0].quiz, s.chapters[0].quiz.map(() => true));
  await expect(quiz1.getByText(/Đúng \d+\/\d+ câu/)).toBeVisible();
  await expect(quiz1.getByText(/Đã đánh dấu|Cần đúng/)).toHaveCount(0);
  await page.waitForTimeout(500);
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("navigation", { name: "Chương" }).getByRole("button", { name: String(n), exact: true }).click();
  const quizN = page.getByRole("region", { name: `Câu hỏi · Chương ${n}` });
  const last = s.chapters[n - 1].quiz;
  // Cuộn tới cuối chương cuối mà chưa làm câu hỏi → vẫn Chưa đọc.
  await quizN.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");
  // Sai hết → nhắc, chưa đổi; làm lại đúng hết → Đã đọc.
  await answer(page, quizN, last, last.map(() => false));
  await expect(quizN.getByText(/Cần đúng .* để tính truyện Đã đọc/)).toBeVisible();
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");
  await quizN.getByRole("button", { name: "Làm lại" }).click();
  await answer(page, quizN, last, last.map(() => true));
  await expect(pill(page, "Đã đọc")).toHaveAttribute("aria-pressed", "true");
  await expect(quizN.getByText("Đã đánh dấu truyện: Đã đọc")).toBeVisible();
});

test("truyện: nút Chưa đọc ⇄ Đã đọc trong trang truyện, danh sách khớp theo", async ({ page }) => {
  const s = lib("stories-index.json").find((x) => x.level === "b1")!;
  await page.goto(`/truyen/b1/${s.id}`);
  await pill(page, "Chưa đọc").click();
  await expect(pill(page, "Đã đọc")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/truyen/b1");
  const t = tick(page, `Đã đọc: ${s.title_en}`);
  await expect(t).toHaveAttribute("aria-checked", "true");
  await t.click();
  await expect(t).toHaveAttribute("aria-checked", "false");
  await page.goto(`/truyen/b1/${s.id}`);
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");
});

test("video: nút Chưa xem ⇄ Đã xem + ô tích và lọc trên danh sách", async ({ page }) => {
  const v = lib("videos-index.json").find((x) => x.level === "a2")!;
  await page.goto(`/video/a2/${v.id}`);
  await pill(page, "Chưa xem").click();
  await expect(pill(page, "Đã xem")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/video/a2");
  const t = tick(page, `Đã xem: ${v.title!.en}`);
  await expect(t).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /Đã xem/ }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await t.click();
  await expect(page.getByText(/Chưa có bài nào đã xem/)).toBeVisible();
});

test("ngữ pháp: tích đã học trên danh sách (không xếp lịch ôn), trang bài khớp và bỏ được", async ({ page }) => {
  const g = grammarLessons().find((x) => x.lv === "a1")!;
  await page.goto("/ngu-phap/a1");
  const t = tick(page, `Đã học: ${g.t}`);
  await expect(t).toHaveAttribute("aria-checked", "false");
  await t.click();
  await expect(t).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /Đã học/ })).toContainText("1");
  await page.goto(`/ngu-phap/a1/${g.id}`);
  await expect(pill(page, "Đã học")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Tích tay · không xếp lịch ôn")).toBeVisible();
  await expect(page.getByText(/Ôn lại:|Đến hạn ôn/)).toHaveCount(0);
  await pill(page, "Đã học").click();
  await expect(pill(page, "Chưa học")).toHaveAttribute("aria-pressed", "false");
});
