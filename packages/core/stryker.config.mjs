import { readFileSync } from "node:fs"

// Tells the tests they run under mutation testing, where some of them run
// fewer generated cases. Stryker's test runners inherit the variable.
process.env.PLIANT_MUTATION = "1"

const all = ["src/**/*.ts", "!src/**/*.test.ts", "!src/index.ts"]

// The column order search is split in two at its middle line. A mutant that
// spans the split, such as emptying the whole function, runs only when every
// file is mutated.
const search = "src/diff-column-placement.ts"
const lines = readFileSync(new URL(search, import.meta.url), "utf8")
  .trimEnd()
  .split("\n").length
const middle = Math.ceil(lines / 2)

const named = {
  search: [`${search}:1-${String(middle)}`],
  repair: [`${search}:${String(middle + 1)}-${String(lines)}`],
  layers: [
    "src/compile-table-state.ts",
    "src/diff-table-state.ts",
    "src/order-items.ts",
    "src/placement.ts",
    "src/region-index.ts",
    "src/resolution.ts",
    "src/resolve-layers.ts",
    "src/resolve-region.ts",
    "src/surface-order.ts",
    "src/table-columns.ts",
  ],
}

/**
 * A full run takes too long for one CI job, so CI runs each shard in its own
 * job, picked with MUTATION_SHARD. `rest` holds every file the others don't.
 * Locally, leave MUTATION_SHARD unset to mutate every file.
 */
export const shards = {
  ...named,
  rest: [
    ...all,
    ...new Set(
      Object.values(named)
        .flat()
        .map((file) => `!${file.split(":")[0]}`)
    ),
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
  thresholds: { high: 80, low: 60, break: shard === undefined ? 78 : null },
}
