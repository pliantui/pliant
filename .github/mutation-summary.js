import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// Prints each package's mutation score as a Markdown table, merging the
// reports of a package's shards, and fails when a score is below the
// package's `break` threshold.
// Usage: node .github/mutation-summary.js <folder of mutation-report-* folders>
const [folder] = process.argv.slice(2)
if (!folder) throw new Error("Pass the folder of downloaded reports.")

const counts = new Map()
for (const name of readdirSync(folder).sort()) {
  const [, pkg, shard] = /^mutation-report-([a-z]+)(?:-(.+))?$/.exec(name) ?? []
  const report = join(folder, name, "mutation.json")
  if (!pkg) continue
  const entry = counts.get(pkg) ?? { statuses: {}, missing: [] }
  counts.set(pkg, entry)
  if (!existsSync(report)) {
    entry.missing.push(shard ?? pkg)
    continue
  }
  const { files } = JSON.parse(readFileSync(report, "utf8"))
  for (const file of Object.values(files)) {
    for (const { status } of file.mutants) {
      entry.statuses[status] = (entry.statuses[status] ?? 0) + 1
    }
  }
}

const lines = [
  "| Package | Score | Break | Detected | Survived | No coverage |",
  "| ------- | ----: | ----: | -------: | -------: | ----------: |",
]
let failed = false
for (const [pkg, { statuses, missing }] of counts) {
  const config = await import(
    pathToFileURL(join("packages", pkg, "stryker.config.mjs")).href
  )
  const threshold = config.default.thresholds.break
  const count = (status) => statuses[status] ?? 0
  const detected = count("Killed") + count("Timeout")
  const undetected = count("Survived") + count("NoCoverage")
  const score = (100 * detected) / (detected + undetected)
  const complete = missing.length === 0 && detected + undetected > 0
  if (!complete || score < threshold) failed = true
  lines.push(
    `| \`${pkg}\` | ${complete ? `${score.toFixed(2)}%` : `no report for ${missing.join(", ")}`} ` +
      `| ${threshold}% | ${detected} | ${count("Survived")} | ${count("NoCoverage")} |`
  )
}

console.log(lines.join("\n"))
if (failed) process.exitCode = 1
