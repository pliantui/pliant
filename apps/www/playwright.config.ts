import { defineConfig, devices } from "@playwright/test"

const baseURL = "http://localhost:4000"
const isCI = Boolean(process.env["CI"])

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A production build avoids on-demand compilation and the dev overlay, so
  // the tests see what ships and don't time out on a cold CI runner.
  webServer: {
    command: "pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 300_000,
  },
})
