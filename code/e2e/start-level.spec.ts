import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Học từ A1 + "Bắt đầu từ cấp" (bỏ qua cấp) — lib/levels.ts. Bất biến quan trọng nhất: người đang học
// B1 từ trước (có thẻ B1–C2 tạo trước ngày ra mắt A1) KHÔNG thấy gì đổi — vẫn bắt đầu B1, A1/A2 chỉ
// để tra cứu như "bộ nền" cũ; người mới thì học từ A1.

type W = { id: string; level: number };
const foundation = JSON.parse(readFileSync(join(process.cwd(), "public", "data", "words", "foundation.json"), "utf8")) as W[];
const A1_FIRST5 = foundation.filter((w) => w.level === -1).slice(0, 5).map((w) => w.id);
const A2_WORD = "company"; // cấp A2 (level 0)
const A1_WORD = "people"; // cấp A1 (level -1)

async function freshStart(page: Page, path = "/") {
  await page.goto(path);
  await page.evaluate(async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await new Promise<void>((r) => {
      const req = indexedDB.deleteDatabase("english-words");
      req.onsuccess = req.onerror = req.onblocked = () => r();
    });
    localStorage.clear();
  });
  await page.goto(path);
}

/** Đọc/ghi thẳng bảng reviews của IndexedDB (DB đã được app tạo ở phiên bản hiện hành). */
async function reviewOf(page: Page, wordId: string) {
  return page.evaluate(
    (id) =>
      new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const open = indexedDB.open("english-words");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction("reviews").objectStore("reviews").get(id);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    wordId,
  );
}
async function allReviews(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ wordId: string; level: number }[]>((resolve, reject) => {
        const open = indexedDB.open("english-words");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("reviews").objectStore("reviews").getAll();
          all.onsuccess = () => {
            open.result.close();
            resolve(all.result);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}
async function putReviews(page: Page, rows: Record<string, unknown>[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("english-words");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("reviews", "readwrite");
          for (const r of list) tx.objectStore("reviews").put({ ...r, due: new Date(r.due as number), last_review: new Date(r.last_review as number) });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    rows,
  );
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await expect(page.getByLabel("Bắt đầu từ cấp")).toBeVisible();
}

test("người mới: lộ trình bắt đầu A1, học được ngay cấp A1", async ({ page }) => {
  await freshStart(page, "/hoc");
  // thẻ đầu lưới là A1, không có cấp nào bị bỏ qua
  const cards = page.locator('a[href^="/hoc/"]');
  await expect(cards.first()).toHaveAttribute("href", "/hoc/-1");
  await expect(cards.nth(1)).toHaveAttribute("href", "/hoc/0");
  await expect(cards.nth(2)).toHaveAttribute("href", "/hoc/1");
  await expect(page.getByText(/đã bỏ qua/)).toHaveCount(0);

  await openSettings(page);
  await expect(page.getByLabel("Bắt đầu từ cấp")).toHaveValue("-1");
  await page.getByLabel("Số câu điền mỗi từ").selectOption("0");
  await page.getByLabel("Số câu ghép mỗi từ").selectOption("0");
  await page.keyboard.press("Escape");

  await page.goto("/hoc/-1");
  await expect(page.getByRole("heading", { name: "Khởi đầu" })).toBeVisible();
  await page.getByRole("button", { name: /Học \(5 từ mới\)/ }).click();
  // thẻ học từ mới A1 đứng trước, có nút "Biết rồi" (cấp trong lộ trình)
  await expect(page.getByText("✨ Từ mới")).toBeVisible();
  await expect(page.getByRole("button", { name: /Biết rồi — bỏ qua từ này/ })).toBeVisible();
  // bấm "Biết rồi" ghi thẻ cấp A1 (level -1) cho một trong 5 từ A1 đầu tiên (thứ tự tần suất)
  await page.getByRole("button", { name: /Biết rồi — bỏ qua từ này/ }).click();
  await expect.poll(async () => (await allReviews(page)).length).toBe(1);
  const [rec] = await allReviews(page);
  expect(rec.level).toBe(-1);
  expect(A1_FIRST5).toContain(rec.wordId);
});

test("Cài đặt: bỏ qua A1–A2 → A1/A2 chỉ còn tra cứu, lộ trình bắt đầu B1", async ({ page }) => {
  await freshStart(page, "/hoc");
  await openSettings(page);
  await page.getByLabel("Bắt đầu từ cấp").selectOption("1");
  await expect(page.getByText(/bỏ qua A1–A2/)).toBeVisible();
  await page.keyboard.press("Escape");

  // lưới xếp lại ngay (không cần tải lại): B1 đứng đầu, A1/A2 xuống cuối, đánh dấu đã bỏ qua
  const cards = page.locator('a[href^="/hoc/"]');
  await expect(cards.first()).toHaveAttribute("href", "/hoc/1");
  await expect(page.getByText(/đã bỏ qua, chỉ tra cứu/)).toHaveCount(2);
  await expect(page.getByText(/Bạn đang bắt đầu từ B1/)).toBeVisible();

  await page.goto("/hoc/0");
  await expect(page.getByText(/không nằm trong lộ trình học/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Học \(/ })).toHaveCount(0);
  // vẫn tra được và vẫn thêm thủ công vào hàng đợi được; không có "Đã biết rồi" (coi như đã biết)
  await page.getByPlaceholder(/Tìm/).fill(A2_WORD);
  await page.getByRole("button", { name: new RegExp(A2_WORD) }).first().click();
  await expect(page.getByRole("button", { name: "Học từ này" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đã biết rồi" })).toHaveCount(0);
});

test("người học cũ (thẻ B1 có từ trước): tự bắt đầu B1 như cũ; thẻ A1 cũ level 0 được sửa cấp và vẫn ôn được", async ({ page }) => {
  await freshStart(page, "/hoc");
  await expect(page.locator('a[href^="/hoc/"]').first()).toBeVisible(); // app đã tạo DB (Dexie) xong
  const now = Date.now();
  const base = { difficulty: 5, elapsed_days: 3, lapses: 0, learning_steps: 0, state: 2, scheduled_days: 3, stability: 4, reps: 3 };
  await putReviews(page, [
    // thẻ B1 tạo trước ngày ra mắt A1 → người học cũ
    { ...base, wordId: "decision", level: 1, introducedOn: "2026-09-28", due: now + 5 * 864e5, last_review: now - 2 * 864e5 },
    // "Học từ này" ở bộ nền cũ: từ A1 mà thẻ còn mang level 0, đang đến hạn
    { ...base, wordId: A1_WORD, level: 0, introducedOn: "2026-09-20", due: now - 3_600_000, last_review: now - 3 * 864e5 },
  ]);
  await page.goto("/hoc");
  const cards = page.locator('a[href^="/hoc/"]');
  await expect(cards.first()).toHaveAttribute("href", "/hoc/1");
  await expect(page.getByText(/đã bỏ qua, chỉ tra cứu/)).toHaveCount(2);
  // thẻ A1 cũ được sửa level 0 → -1, lịch ôn giữ nguyên
  await expect.poll(async () => (await reviewOf(page, A1_WORD))?.level ?? null).toBe(-1);
  expect((await reviewOf(page, A1_WORD))?.reps).toBe(3);

  await openSettings(page);
  await expect(page.getByLabel("Bắt đầu từ cấp")).toHaveValue("1");
  await page.keyboard.press("Escape");

  // thẻ đến hạn của từ A1 vẫn dựng được câu hỏi (không rơi khỏi phiên)
  await page.goto("/on-tap");
  await page.getByRole("button", { name: /Ôn tập \(1 thẻ\)/ }).click();
  await expect(page.getByText("1/1").first()).toBeVisible();
  await expect(page.getByText(/Không tải được dữ liệu/)).toHaveCount(0);
});

test("người học cũ tự chọn học lại từ A1 → A1/A2 vào lộ trình", async ({ page }) => {
  await freshStart(page, "/hoc");
  await expect(page.locator('a[href^="/hoc/"]').first()).toBeVisible(); // app đã tạo DB (Dexie) xong
  const now = Date.now();
  await putReviews(page, [
    { wordId: "decision", level: 1, introducedOn: "2026-09-28", due: now + 5 * 864e5, last_review: now - 2 * 864e5,
      difficulty: 5, elapsed_days: 3, lapses: 0, learning_steps: 0, state: 2, scheduled_days: 3, stability: 4, reps: 3 },
  ]);
  await page.goto("/hoc");
  await expect(page.locator('a[href^="/hoc/"]').first()).toHaveAttribute("href", "/hoc/1");
  await openSettings(page);
  await page.getByLabel("Bắt đầu từ cấp").selectOption("-1");
  await page.keyboard.press("Escape");
  await expect(page.locator('a[href^="/hoc/"]').first()).toHaveAttribute("href", "/hoc/-1");
  await expect(page.getByText(/đã bỏ qua/)).toHaveCount(0);
  await page.goto("/hoc/0");
  await expect(page.getByRole("button", { name: /Học \(/ })).toBeVisible();
});
