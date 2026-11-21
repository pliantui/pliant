// Only the logic that runs outside rendering: the store, its queues and
// merges, the storage adapters and the table state helpers. Hooks,
// components and the DOM helpers are thin wiring over these, covered by the
// rendering tests.
const all = [
  "src/**/*.ts",
  "!src/**/*.test.ts",
  "!src/**/*.d.ts",
  "!src/index.ts",
  "!src/ask.ts",
  "!src/form.ts",
  "!src/local.ts",
  "!src/point-mode.ts",
  "!src/region.ts",
  "!src/table.ts",
  "!src/use-*.ts",
  "!src/compose-props.ts",
  "!src/pliant-table-features.ts",
  "!src/point-mode-boxes.ts",
  "!src/point-mode-layers.ts",
  "!src/reveal-target.ts",
]

const named = {
  store: [
    "src/layer-store.ts",
    "src/local-adapter.ts",
    "src/field-registry.ts",
    "src/memoize-selector.ts",
    "src/node-registry.ts",
    "src/retention.ts",
    "src/same-state.ts",
    "src/save-queue.ts",
    "src/session-mirror.ts",
    "src/slot-registry.ts",
    "src/ui-language.ts",
    "src/ulid.ts",
  ],
  "lock-in": [
    "src/lock-in.ts",
    "src/manual-changes.ts",
    "src/manual-overlay.ts",
    "src/overlay-list.ts",
    "src/property-keys.ts",
    "src/resolved-view.ts",
  ],
  table: [
    "src/local-columns.ts",
    "src/pliant-filter-fns.ts",
    "src/table-cache.ts",
    "src/table-columns.ts",
    "src/table-filters.ts",
  ],
}

/**
 * CI runs each shard in its own job, picked with MUTATION_SHARD, to keep each
 * job short. `rest` holds every file the others don't. Locally, leave
 * MUTATION_SHARD unset to mutate every file.
 */
export const shards = {
  ...named,
  rest: [
    ...all,
    ...Object.values(named)
      .flat()
      .map((file) => `!${file}`),
  ],
}

const shard = process.env.MUTATION_SHARD || undefined
if (shard !== undefined && !(shard in shards)) {
  throw new Error(`Unknown MUTATION_SHARD "${shard}"`)
}

export default {
  plugins: [
    "@stryker-mutator/vitest-runner",
    "@stryker-mutator/typescript-checker",
  ],
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: shard === undefined ? all : shards[shard],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  // Each worker holds a test runner and a type checker, about 1 GB together.
  // CI passes a higher value for its larger runners.
  concurrency: 2,
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  // `break` sits just below the current score, so the weekly run fails if
  // the score drops. A shard's score isn't the package's, so CI checks the
  // merged score instead.
  thresholds: { high: 80, low: 60, break: shard === undefined ? 72 : null },
}
