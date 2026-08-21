import { defineConfig } from "@playwright/test";

// E2E chạy trên bản dev local, khổ điện thoại (~390px). Chỉ chromium (đã cài headless shell).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
