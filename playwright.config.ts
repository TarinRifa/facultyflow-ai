import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60000,
  use: {
    channel: "msedge",
    baseURL: "http://localhost:3011",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3011",
    url: "http://localhost:3011/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
