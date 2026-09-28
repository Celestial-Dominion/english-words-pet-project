import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Hồi quy cho đợt sửa 11/08/2026 — mỗi ca ứng với một lỗi đã sửa, không phải kiểm thử chung.

test("thẻ từ: chỉ hiện 2 nghĩa tiếng Anh, bấm mới xem hết", async ({ page }) => {
  // Wiktionary trả cả nghĩa cực hiếm; đổ hết ra là nhiễu, người học tưởng đó là nghĩa chính.
  await page.goto("/hoc/1");
  await page.getByPlaceholder(/Tìm từ hoặc nghĩa/).fill("season");
  await page.getByRole("button", { name: /^season/ }).first().click();
  const more = page.getByRole("button", { name: /nghĩa nữa/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect(more).toBeHidden();
});

test("thẻ từ: khối 'gặp lại trong ngữ cảnh' chạy bằng chỉ mục từ→học liệu", async ({ page }) => {
  // Không tải cả thư viện: chỉ đọc public/data/library/word-refs/{n}.json của từ đang mở.
  await page.goto("/hoc/1");
  await page.getByPlaceholder(/Tìm từ hoặc nghĩa/).fill("season");
  await page.getByRole("button", { name: /^season/ }).first().click();
  await expect(page.getByText(/GẶP LẠI TRONG NGỮ CẢNH/i)).toBeVisible({ timeout: 5000 });
});

type Meta = { id: string; level: string; title_en: string };
const libIndex = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "public", "data", "library", name), "utf8")) as Meta[];
const firstB1 = () => libIndex("readings-index.json").find((r) => r.level === "b1")!;

test("bài đọc: mở bài KHÔNG tự đánh dấu đã đọc", async ({ page }) => {
  const r = firstB1();
  await page.goto(`/bai-doc/b1/${r.id}`);
  await expect(page.getByRole("heading", { name: r.title_en })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeVisible();
});

test("bài đọc: đọc tới cuối bài thì tự đánh dấu đã đọc", async ({ page }) => {
  const r = firstB1();
  await page.goto(`/bai-doc/b1/${r.id}`);
  await expect(page.getByRole("heading", { name: r.title_en })).toBeVisible();
  await page.getByTestId("reading-end").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /Đã đọc/ })).toBeVisible({ timeout: 5000 });
});

test("audio bài đọc: lần chạm tốc độ đầu tiên tăng từ 1× lên 1,25×", async ({ page }) => {
  await page.goto(`/bai-doc/b1/${firstB1().id}`);
  await page.evaluate(() => localStorage.removeItem("en.readRate"));
  await page.reload();
  const normalSpeed = page.getByRole("button", { name: "Tốc độ nghe: 1×" });
  await expect(normalSpeed).toBeVisible();
  await normalSpeed.click();
  await expect(page.getByRole("button", { name: "Tốc độ nghe: 1.25×" })).toBeVisible();
});

test("lưới cấp: số từ khớp dữ liệu thật, không phải số dự kiến của kế hoạch", async ({ page }) => {
  await page.goto("/hoc");
  await expect(page.getByText("2.276 từ")).toBeVisible();
});

test("hub thư viện: số bài đọc / truyện / video lấy từ chỉ mục thật", async ({ page }) => {
  await page.goto("/doc");
  await expect(page.getByText(`${libIndex("readings-index.json").length} bài theo chủ đề`, { exact: false })).toBeVisible();
  await expect(page.getByText(`${libIndex("stories-index.json").length} truyện nhiều chương`, { exact: false })).toBeVisible();
  await expect(page.getByText(`${libIndex("videos-index.json").length} hội thoại hoạt hình`, { exact: false })).toBeVisible();
});
