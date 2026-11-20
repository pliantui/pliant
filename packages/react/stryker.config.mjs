export default {
  plugins: [
    "@stryker-mutator/vitest-runner",
    "@stryker-mutator/typescript-checker",
  ],
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  // Only the logic that runs outside rendering: the store, its queues and
  // merges, and the storage adapters. Components and hooks are thin wiring
  // over these and are covered by the rendering tests instead.
  mutate: [
    "src/layer-store.ts",
    "src/local-adapter.ts",
    "src/local-columns.ts",
    "src/lock-in.ts",
    "src/manual-changes.ts",
    "src/manual-overlay.ts",
    "src/memoize-selector.ts",
    "src/node-registry.ts",
    "src/overlay-list.ts",
    "src/pliant-filter-fns.ts",
    "src/property-keys.ts",
    "src/resolved-view.ts",
    "src/retention.ts",
    "src/same-state.ts",
    "src/save-queue.ts",
    "src/session-mirror.ts",
    "src/slot-registry.ts",
    "src/table-cache.ts",
    "src/table-columns.ts",
    "src/table-filters.ts",
    "src/ui-language.ts",
    "src/ulid.ts",
  ],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Each worker holds a test runner and a type checker, about 1 GB together.
  // CI passes a higher value for its larger runners.
  concurrency: 2,
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  // `break` sits just below the current score, so the weekly run fails if
  // the score drops.
  thresholds: { high: 80, low: 60, break: 72 },
}
