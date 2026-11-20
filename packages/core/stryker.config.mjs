// A full run takes too long for one CI job, so CI splits the files into
// shards and runs one per job, picked with MUTATION_SHARD. Locally, leave it
// unset to mutate every file.
const shards = {
  diff: [
    "src/diff-column-placement.ts",
    "src/diff-table-state.ts",
    "src/compile-table-state.ts",
    "src/table-columns.ts",
  ],
  layers: [
    "src/resolution.ts",
    "src/resolve-layers.ts",
    "src/resolve-region.ts",
    "src/order-items.ts",
    "src/placement.ts",
    "src/region-index.ts",
    "src/surface-order.ts",
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
      ...Object.values(shards)
        .flat()
        .map((file) => `!${file}`),
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
  thresholds: { high: 80, low: 60, break: shard === undefined ? 79 : null },
}
