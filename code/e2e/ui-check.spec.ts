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

test("thẻ từ: khối 'gặp lại trong ngữ cảnh' chạy bằng chỉ mục từ→bài", async ({ page }) => {
  // Trước đây khối này tải TOÀN BỘ ~4MB bài đọc; giờ đọc public/data/word-readings/{n}.json.
  await page.goto("/hoc/1");
  await page.getByPlaceholder(/Tìm từ hoặc nghĩa/).fill("season");
  await page.getByRole("button", { name: /^season/ }).first().click();
  await expect(page.getByText(/GẶP LẠI TRONG NGỮ CẢNH/i)).toBeVisible({ timeout: 5000 });
});

test("bài đọc: mở bài KHÔNG tự đánh dấu đã đọc", async ({ page }) => {
  await page.goto("/bai-doc");
  await page.getByRole("button", { name: /B1 · Trung cấp/ }).click();
  await page.getByRole("button", { name: /Air travel/ }).first().click();
  await expect(page.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeVisible();
});

test("bài đọc: đọc tới cuối bài thì tự đánh dấu đã đọc", async ({ page }) => {
  await page.goto("/bai-doc");
  await page.getByRole("button", { name: /B1 · Trung cấp/ }).click();
  await page.getByRole("button", { name: /Air travel/ }).first().click();
  await page.getByTestId("reading-end").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /Đã đọc/ })).toBeVisible({ timeout: 5000 });
});

test("audio bài đọc: lần chạm tốc độ đầu tiên tăng từ 1× lên 1,25×", async ({ page }) => {
  await page.goto("/bai-doc?open=news-black-box-found-near-crash-site-of-ethio");
  const normalSpeed = page.getByRole("button", { name: "Tốc độ nghe: 1×" });
  await expect(normalSpeed).toBeVisible();
  await normalSpeed.click();
  await expect(page.getByRole("button", { name: "Tốc độ nghe: 1.25×" })).toBeVisible();
});

test("tin Wikinews hiện ngày đăng gốc (phần lớn là tin đã cũ)", async ({ page }) => {
  await page.goto("/bai-doc?open=news-black-box-found-near-crash-site-of-ethio");
  await expect(page.getByText(/Tin gốc đăng ngày 8\/2\/2010/)).toBeVisible();
});

test("lưới cấp: số từ khớp dữ liệu thật, không phải số dự kiến của kế hoạch", async ({ page }) => {
  await page.goto("/hoc");
  await expect(page.getByText("2.276 từ")).toBeVisible();
});

test("hub đọc: tab CNTT gom bài đọc + hội thoại IT theo cấp", async ({ page }) => {
  const index = JSON.parse(
    readFileSync(join(process.cwd(), "public", "data", "readings-index.json"), "utf8"),
  ) as { topic?: string; dialogue?: boolean }[];
  const nIt = index.filter((m) => m.topic === "it").length;
  test.skip(nIt === 0, "chưa có nội dung IT trong dữ liệu");

  await page.goto("/bai-doc");
  await page.getByRole("button", { name: /CNTT/ }).click();
  await expect(page.getByText(new RegExp(`/${nIt} bài`))).toBeVisible();
  // hội thoại IT phải nằm TRONG tab này (khác tab Công việc)
  const nItDlg = index.filter((m) => m.topic === "it" && m.dialogue).length;
  if (nItDlg > 0) {
    await page.getByRole("button", { name: /B1 · Trung cấp/ }).click();
    await expect(page.getByRole("button", { name: /Asking about the timesheet tool/ })).toBeVisible();
  }
});
