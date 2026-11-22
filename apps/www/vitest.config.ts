import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "app/**/*.test.ts",
      "components/**/*.test.tsx",
      "lib/**/*.test.ts",
      "registry/**/*.test.{ts,tsx}",
      "scripts/**/*.test.{ts,tsx}",
    ],
  },
})
