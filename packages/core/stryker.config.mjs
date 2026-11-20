// A full run takes too long for one CI job, so CI splits the files into
// shards and runs one per job, picked with MUTATION_SHARD. Locally, leave it
// unset to mutate every file.
const shards = {
  // The column order search, split in two by line range. A mutant that
  // spans both ranges, such as emptying the whole function, runs only when
  // every file is mutated.
  search: ["src/diff-column-placement.ts:1-406"],
  repair: ["src/diff-column-placement.ts:407-661"],
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
const all = ["src/**/*.ts", "!src/**/*.test.ts", "!src/index.ts"]
const shard = process.env.MUTATION_SHARD || undefined

function mutateOf(name) {
  if (name === undefined) {
    return all
  }
  if (name === "rest") {
    return [
      ...all,
      ...new Set(
        Object.values(shards)
          .flat()
          .map((file) => `!${file.split(":")[0]}`)
      ),
    ]
  }
  const files = shards[name]
  if (!files) {
    throw new Error(`Unknown MUTATION_SHARD "${name}"`)
  }
  return files
}

export default {
  plugins: [
    "@stryker-mutator/vitest-runner",
    "@stryker-mutator/typescript-checker",
  ],
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: mutateOf(shard),
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
