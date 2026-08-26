import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI builds first, then exercises the production server. Local runs
    // reuse a developer's port 3100 server when one already exists.
    command: isCI ? "npm run start -- -p 3100" : "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
