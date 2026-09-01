import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 2,
  reporter: isCI ? "github" : "list",
  // WebGL here is rasterised on the CPU, where a frame costs orders of
  // magnitude more than on a GPU — and the portal's capture is a timed
  // animation driven by the frame loop, so its wall-clock length is set
  // by the renderer. The default 30s was sized for a scene with no
  // nebula behind it. This widens the allowance; it does not weaken a
  // single assertion.
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    launchOptions: chromiumExecutable
      ? { executablePath: chromiumExecutable }
      : undefined,
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
    command: isCI
      ? "npm run start -- -p 3100 -H 127.0.0.1"
      : "npm run dev -- --port 3100 --hostname 127.0.0.1",
    url: "http://localhost:3100",
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
