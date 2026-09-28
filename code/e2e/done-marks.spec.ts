import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Đánh dấu ĐÃ / CHƯA ở cả bốn mục (Bài đọc · Truyện · Video · Ngữ pháp): ô tích trên danh sách (tích / bỏ tích tại chỗ,
// không mở bài), nút trạng thái trong trang bài, thanh lọc theo trạng thái — và hai bên luôn khớp nhau.

type LibMeta = { id: string; level: string; title_en?: string; title?: { en: string } };
const lib = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", "library", name), "utf8")) as LibMeta[];
const grammarLessons = () =>
  (JSON.parse(readFileSync(join(process.cwd(), "public", "data", "grammar", "index.json"), "utf8")) as { lessons: { id: string; lv: string; t: string }[] }).lessons;

const pill = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const tick = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });

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

test("bài đọc: bỏ đánh dấu lúc cuối bài đang hiện thì giữ nguyên Chưa đọc", async ({ page }) => {
  // Trước đây bỏ đánh dấu xong, mốc cuối bài vẫn trong tầm nhìn → tự đánh dấu lại ngay lập tức.
  const r = lib("readings-index.json").find((x) => x.level === "b1")!;
  await page.goto(`/bai-doc/b1/${r.id}`);
  await page.getByTestId("reading-end").scrollIntoViewIfNeeded();
  await expect(pill(page, "Đã đọc")).toHaveAttribute("aria-pressed", "true", { timeout: 5000 });
  await pill(page, "Đã đọc").click();
  await expect(pill(page, "Chưa đọc")).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(1500);
  await expect(pill(page, "Chưa đọc")).toBeVisible();
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
