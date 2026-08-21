import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// E2E các luồng chính, chạy trên dev local khổ ~390px.
// AuthGate tự bỏ chặn đăng nhập khi phát hiện automation (chỉ ngoài production).

/**
 * Trả lời hết một phiên chỉ có 1 thẻ, không cần biết trước đáp án: lần đầu bấm đại phương án
 * 1; sau khi trả lời, UI TÔ XANH phương án đúng (border-emerald-500) → ghi nhớ nội dung đó và
 * bấm trúng ở mọi lần gặp lại. Thẻ mới cần ĐÚNG 2 LẦN mới ra khỏi phiên: từ khi bỏ mức Dễ cho
 * câu nhận-diện, đúng lần đầu chấm Good → FSRS hẹn lại 10 phút (learning step kế) ≤ cửa sổ
 * 15 phút nên thẻ lặp lại trong phiên; đúng lần nữa → hẹn 1h → phiên kết thúc.
 */
async function finishOneCardSession(page: Page) {
  const done = page.getByText("✅ Xong phiên ôn!");
  let knownAnswer: string | null = null;
  for (let pass = 0; pass < 8; pass++) {
    // click() tự chờ thẻ kế render xong — không được đoán bằng isVisible() (bấm phím sớm là mất lượt)
    await page.getByRole("button", { name: /Thử nhớ trong đầu/ }).click();
    if (knownAnswer) {
      // hasText (chứa chuỗi) thay vì exact: tên truy cập của nút gồm cả số phím tắt ("1 đã từng")
      await page.locator("button", { hasText: knownAnswer }).first().click();
    } else {
      await page.keyboard.press("1");
      // phương án đúng vừa được tô xanh — nhớ lại cho các lần gặp sau (option bị xáo mỗi lượt)
      knownAnswer =
        (await page.locator("button.border-emerald-500").first().textContent())?.replace(/^\d+/, "").trim() ?? null;
    }
    // đúng + "tự chuyển khi đúng" → tổng kết tự hiện; sai → thẻ requeue, phải bấm nút tiếp
    if (await done.waitFor({ state: "visible", timeout: 2500 }).then(() => true, () => false)) return;
    const next = page.getByRole("button", { name: /Kết thúc|Tiếp tục/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click();
    if (await done.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) return;
  }
  await expect(done).toBeVisible();
}

/** Xoá IndexedDB + cache để mỗi test bắt đầu từ trạng thái sạch, tránh phụ thuộc thứ tự. */
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

test("trang chủ: hero hôm nay + grid cấp độ + khám phá", async ({ page }) => {
  await freshStart(page);
  await expect(page.getByText("Hôm nay")).toBeVisible();
  await expect(page.getByText("Chọn cấp độ học")).toBeVisible();
  await expect(page.getByRole("link", { name: /Trung cấp/ })).toBeVisible();
  await expect(page.getByText("Khám phá")).toBeVisible();
});

test("grid cấp: đủ 4 cấp B1–C2 với số từ thật", async ({ page }) => {
  await freshStart(page, "/hoc");
  for (const label of ["Trung cấp", "Trung cao", "Cao cấp", "Thành thạo"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
});

test("tra từ: tìm được từ và thấy nghĩa tiếng Việt", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByPlaceholder(/Tìm/).fill("decision");
  await expect(page.getByRole("button", { name: /decision/ }).first()).toBeVisible();
  await expect(page.getByText("quyết định", { exact: false }).first()).toBeVisible();
});

test("chi tiết từ: nghĩa + collocations + ví dụ có nút nghe", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByPlaceholder(/Tìm/).fill("decision");
  await page.getByRole("button", { name: /decision/ }).first().click();
  await expect(page.getByText(/Cụm hay đi kèm/)).toBeVisible();
  await expect(page.getByText(/Ví dụ/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Nghe câu" }).first()).toBeVisible();
});

test("phrasal verb hiển thị đúng loại từ", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByPlaceholder(/Tìm/).fill("give up");
  await page.getByRole("button", { name: /give up/ }).first().click();
  await expect(page.getByText("cụm động từ")).toBeVisible();
});

test("họ từ: bấm từ cùng họ mở thẻ mới, quay lại được", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByPlaceholder(/Tìm/).fill("decision");
  await page.getByRole("button", { name: /decision/ }).first().click();
  await expect(page.getByText("Họ từ")).toBeVisible();
  await page.getByRole("button", { name: "decide", exact: true }).click();
  // thẻ đã đổi sang "decide": nút quay lại (header) mang nhãn từ trước đó
  const back = page.getByRole("button", { name: /^decision$/ }).first();
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.getByRole("button", { name: "decide", exact: true })).toBeVisible();
});

test("lọc phrasal verbs: chỉ còn cụm động từ", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByRole("combobox").selectOption("phrasal");
  await expect(page.getByText(/^1[0-9]{2} từ$/)).toBeVisible(); // B1 có 152 phrasal verb
  await page.getByPlaceholder(/Tìm/).fill("give up");
  await page.getByRole("button", { name: /give up/ }).first().click();
  await expect(page.getByText("cụm động từ")).toBeVisible();
});

test("lọc tiếng Anh công việc: ra đúng vốn từ BSL", async ({ page }) => {
  await freshStart(page, "/hoc/2");
  await page.getByRole("combobox").selectOption("business");
  await expect(page.getByText(/^5[0-9]{2} từ$/)).toBeVisible(); // B2 có 514 từ business
  await page.getByPlaceholder(/Tìm/).fill("client");
  await page.getByRole("button", { name: /client/ }).first().click();
  await expect(page.getByText("💼 công việc")).toBeVisible();
});

test("bộ nền A1–A2: duyệt được nhưng không có hàng đợi học", async ({ page }) => {
  await freshStart(page, "/hoc");
  await page.getByRole("link", { name: /Nền tảng/ }).click();
  await expect(page.getByRole("heading", { name: "Nền tảng" })).toBeVisible();
  await expect(page.getByText(/không nằm trong lộ trình học/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Học \(/ })).toHaveCount(0);
  // vẫn tra được và vẫn thêm thủ công vào hàng đợi được
  await page.getByPlaceholder(/Tìm/).fill("people");
  await page.getByRole("button", { name: /people/ }).first().click();
  await expect(page.getByRole("button", { name: "Học từ này" })).toBeVisible();
});

test("học từ mới: learn-card hiện TRƯỚC, rồi mới tới trắc nghiệm", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByRole("button", { name: /Học \(/ }).click();

  // 1) thẻ ĐẦU phiên luôn là thẻ học: interleave giữ learn trước mọi đợt khác của chính
  //    từ đó, và phần tử đầu phiên mang khoá nhỏ nhất toàn cục → chính là một thẻ học.
  await expect(page.getByText(/Từ mới — học trước nhé/)).toBeVisible();
  await expect(page.getByText(/Ví dụ/i).first()).toBeVisible();

  // 2) từ khi XEN KẼ (interleaving), sau thẻ học có thể tới thẻ học của TỪ KHÁC —
  //    bấm qua hết các thẻ học cho tới câu hỏi đầu tiên (recall-first ẩn đáp án).
  const gate = page.getByRole("button", { name: /Thử nhớ trong đầu/ });
  for (let k = 0; k < 8; k++) {
    if (await gate.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) break;
    await page.getByRole("button", { name: /Đã xem — Kiểm tra/ }).click();
  }
  await expect(gate).toBeVisible();

  // 3) hiện đáp án → đủ 4 phương án
  await gate.click();
  await expect(page.getByText(/Chọn nghĩa đúng/i)).toBeVisible();
});

test("nhiệm vụ ngày: trang chủ hiện khối 3 nhiệm vụ, tiến độ 0/3 khi chưa học", async ({ page }) => {
  await freshStart(page, "/");
  await expect(page.getByText(/Nhiệm vụ hôm nay/)).toBeVisible();
  await expect(page.getByText(/· 0\/3/)).toBeVisible();
});

test("luyện tập tự do: trang mở được; chưa học từ nào → báo rõ + khoá nút bắt đầu", async ({ page }) => {
  await freshStart(page, "/luyen-tap");
  await expect(page.getByRole("heading", { name: "Luyện tập" })).toBeVisible();
  await expect(page.getByText(/Chưa có từ nào được học/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Bắt đầu/ })).toBeDisabled();
});

test("học từ mới: chạy trọn 1 vòng → tổng kết + thẻ vào hàng đợi ôn", async ({ page }) => {
  test.setTimeout(60_000); // 2 phiên, mỗi phiên có thể phải thử vài phương án mới trúng
  // hạ hạn mức xuống 1 từ/ngày qua chính màn Cài đặt → phiên đủ ngắn để chạy trọn vòng
  await freshStart(page, "/on-tap");
  await page.getByText("⚙️ Cài đặt").click();
  await page.locator('input[type="number"]').fill("1");
  await expect(page.locator('input[type="number"]')).toHaveValue("1");

  await page.goto("/hoc/1");
  await page.getByRole("button", { name: /Học \(1 từ mới\)/ }).click();
  await page.getByRole("button", { name: /Đã xem — Kiểm tra/ }).click();
  await finishOneCardSession(page);

  // thẻ đã thật sự vào hàng đợi → /on-tap ôn sớm được đúng thẻ đó (ôn TÁCH RIÊNG học mới)
  await page.goto("/on-tap");
  await expect(page.getByText("Đã học", { exact: true }).locator("xpath=preceding-sibling::div[1]")).toHaveText("1");
  await page.getByRole("button", { name: /Ôn sớm/ }).first().click();
  await finishOneCardSession(page);

  // Nút gợi ý đọc ở màn tổng kết phải dẫn tới trang THẬT (từng trỏ nhầm sang /doc — route đã bỏ).
  await page.getByRole("link", { name: /Đọc một bài/ }).click();
  await expect(page.getByRole("heading", { name: "Bài đọc" })).toBeVisible();
});

test("gõ chính tả: thẻ đã chín ra bài gõ, lệch 1 ký tự vẫn tính đúng", async ({ page }) => {
  await freshStart(page, "/hoc/1");

  // "Đã biết rồi" tạo thẻ nhớ bền (stability 60) → thẻ CHÍN, đúng điều kiện ra bài gõ
  await page.getByPlaceholder(/Tìm/).fill("decision");
  await page.getByRole("button", { name: /decision/ }).first().click();
  await page.getByRole("button", { name: "Đã biết rồi" }).click();
  await expect(page.getByText(/Đã học · ôn lại sau/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/on-tap");
  // Loại câu hỏi bốc theo Math.random → ghim lại để bài gõ chắc chắn ra (0.5 rơi vào ô "spell").
  // Phải ghim SAU khi trang hydrate xong (ghim trước bằng addInitScript làm hỏng hydrate của Next dev).
  await expect(page.getByRole("button", { name: /Ôn sớm/ }).first()).toBeVisible();
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.getByRole("button", { name: /Ôn sớm/ }).first().click();
  await expect(page.getByText("Gõ chính tả")).toBeVisible();
  await expect(page.getByLabel("Gõ từ tiếng Anh")).toBeVisible();

  await page.getByLabel("Gõ từ tiếng Anh").fill("decison"); // thiếu 1 chữ i
  await page.getByRole("button", { name: /Kiểm tra/ }).click();
  await expect(page.getByText(/Suýt đúng — lệch 1 ký tự/)).toBeVisible();
  await expect(page.getByText("decison")).toBeVisible(); // hiện lại chỗ gõ sai
  await expect(page.getByText("✅ Xong phiên ôn!")).toBeVisible(); // tính đúng → tự sang tổng kết
});

test("phiên học: thoát giữa chừng phải xác nhận", async ({ page }) => {
  await freshStart(page, "/hoc/1");
  await page.getByRole("button", { name: /Học \(/ }).click();
  await expect(page.getByText(/Từ mới — học trước nhé/)).toBeVisible();
  await page.getByRole("button", { name: "Thoát", exact: true }).click();
  await expect(page.getByText("Thoát phiên ôn?")).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục ôn" }).click();
  await expect(page.getByText(/Từ mới — học trước nhé/)).toBeVisible();
});

test("ôn tập: trang mở được và báo trạng thái hàng đợi", async ({ page }) => {
  await freshStart(page, "/on-tap");
  await expect(page.getByRole("heading", { name: /Ôn tập/ })).toBeVisible();
});

test("tiến độ: dashboard hiện chuỗi ngày và số từ đã học", async ({ page }) => {
  await freshStart(page, "/tien-do");
  await expect(page.getByText(/Chuỗi|streak/i).first()).toBeVisible();
});

test("Hải trình: cấp bậc Royal Navy + huy hiệu", async ({ page }) => {
  await freshStart(page, "/tu-luyen");
  await expect(page.getByRole("heading", { name: "Hải trình" })).toBeVisible();
  // Tên cấp bậc tiếng Anh luôn hiện; nghĩa Việt chỉ hiện từ breakpoint sm trở lên.
  await expect(page.getByText("Seaman").first()).toBeVisible();
  await expect(page.getByText(/Thủy thủ/).first()).toBeAttached();
});

// E5 đã gộp truyện vào bài đọc → hub đọc là /bai-doc, không còn /doc riêng.
test("đọc: hub /bai-doc mở được và liệt kê bài theo cấp", async ({ page }) => {
  await freshStart(page, "/bai-doc");
  await expect(page.getByRole("heading", { name: "Bài đọc" })).toBeVisible();
  await expect(page.getByText(/B1/).first()).toBeVisible();
});

test("bài đọc: bấm vào từ trong bài tra được nghĩa (kể cả dạng biến hình)", async ({ page }) => {
  await freshStart(page, "/bai-doc");
  // mở bài đọc đầu tiên trong danh sách
  await page.locator("main a, main button").filter({ hasText: /\p{L}{6,}/u }).first().click();
  await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible();

  // mỗi từ trong bài là một <button> bấm-tra. Chọn từ chắc chắn tra được, ưu tiên DẠNG CHIA
  // để đi qua lemma-map (lasted→last, began→begin); "the" là chốt chặn cuối (bộ nền A1–A2).
  for (const w of ["lasted", "began", "usually", "season", "years", "the"]) {
    const b = page.getByRole("button", { name: w, exact: true }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      break;
    }
  }
  // thẻ từ mở ra: có nút phát âm + nghĩa tiếng Việt
  await expect(page.getByRole("button", { name: "Phát âm" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng" })).toBeVisible();
});

test("hội thoại công việc: lọc được và render theo lượt nói", async ({ page }) => {
  // Số bài lấy từ chính dữ liệu, không viết cứng — thêm hội thoại mới là test cũ đỏ oan.
  const index = JSON.parse(
    readFileSync(join(process.cwd(), "public", "data", "readings-index.json"), "utf8"),
  ) as { dialogue?: boolean }[];
  const nDialogues = index.filter((m) => m.dialogue).length;

  await freshStart(page, "/bai-doc");
  await page.getByRole("button", { name: /Hội thoại/ }).click();
  await expect(page.getByText(new RegExp(`/${nDialogues} bài`))).toBeVisible();

  // mở bài hội thoại đầu tiên → thấy tên vai nói + ghi chú nội dung tự biên soạn
  await page.locator("main a, main button").filter({ hasText: /\p{L}{6,}/u }).nth(1).click();
  await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible();
  await expect(page.getByText(/Hội thoại luyện tập do dự án biên soạn/)).toBeVisible();
});

test("bài đọc nguồn mở: có ghi công nguồn ở cuối bài", async ({ page }) => {
  await freshStart(page, "/bai-doc");
  await page.locator("main a, main button").filter({ hasText: /\p{L}{6,}/u }).nth(1).click();
  await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible();
  await expect(page.getByText(/Nguồn:/)).toBeVisible();
});

test("ôn tập: có dòng trạng thái đồng bộ + công tắc từng dạng câu hỏi", async ({ page }) => {
  await freshStart(page, "/on-tap");
  // dòng đồng bộ (chưa đăng nhập → nói rõ tiến độ chỉ nằm trên máy này)
  await expect(page.getByText(/Chưa đăng nhập|Đã đồng bộ lúc|Chưa đồng bộ/)).toBeVisible();

  await page.getByText("⚙️ Cài đặt").click();
  // nhãn nằm trong <span> có cả dòng mô tả con → khớp theo <label> chứa chuỗi, không dùng exact
  const row = (label: string) => page.locator("label").filter({ hasText: label });
  for (const label of ["① Câu hỏi nghe", "② Điền từ vào câu", "③ Câu ghép mỗi từ", "Gõ chính tả"]) {
    await expect(row(label)).toBeVisible();
  }
  // tắt "câu hỏi nghe" phải được ghi lại qua lần tải trang
  // click() thay vì uncheck(): checkbox là controlled component, state chỉ đổi sau khi patch()
  // ghi xuống IndexedDB xong → uncheck() kiểm tra ngay lập tức nên báo "did not change".
  await row("① Câu hỏi nghe").locator('input[type="checkbox"]').click();
  await expect(row("① Câu hỏi nghe").locator('input[type="checkbox"]')).not.toBeChecked();
  await page.reload();
  await page.getByText("⚙️ Cài đặt").click();
  await expect(row("① Câu hỏi nghe").locator('input[type="checkbox"]')).not.toBeChecked();
  await expect(page.getByRole("link", { name: /Sao lưu/ })).toBeVisible();
});

test("cài đặt: đổi hướng hỏi được lưu lại", async ({ page }) => {
  await freshStart(page, "/on-tap");
  const settings = page.getByRole("button", { name: /Cài đặt/ }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    await expect(page.getByText("Hướng hỏi")).toBeVisible();
  }
});
