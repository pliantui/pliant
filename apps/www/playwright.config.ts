import { defineConfig, devices } from "@playwright/test"

const baseURL = "http://localhost:4000"
const isCI = Boolean(process.env["CI"])

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: isCI,
  workers: isCI ? 1 : "50%",
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // A production build avoids on-demand compilation and the dev overlay, so
  // the tests see what ships and don't time out on a cold CI runner. Turbo
  // builds the workspace packages the site imports first. The ask route is
  // turned on, answering from the committed recordings.
  webServer: {
    command:
      "pnpm -w exec turbo run build --filter=www && PLIANT_ASK_ENABLED=1 pnpm start",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 300_000,
  },
})
