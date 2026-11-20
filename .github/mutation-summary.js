import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// Prints each package's mutation score as a Markdown table, merging the
// reports of its shards. Fails when a mutation job didn't succeed, when an
// expected shard has no report, or when a score is below the package's
// `break` threshold.
// Usage: node .github/mutation-summary.js <folder of mutation-report-*
// folders> [result of the mutation jobs]
const [folder, result] = process.argv.slice(2)
if (!folder) throw new Error("Pass the folder of downloaded reports.")

const lines = [
  "| Package | Score | Break | Detected | Survived | No coverage |",
  "| ------- | ----: | ----: | -------: | -------: | ----------: |",
]
let failed = false

for (const pkg of readdirSync("packages").sort()) {
  const configFile = join("packages", pkg, "stryker.config.mjs")
  if (!existsSync(configFile)) continue
  const config = await import(pathToFileURL(configFile).href)
  const jobs = config.shards
    ? Object.keys(config.shards).map((shard) => `${pkg}-${shard}`)
    : [pkg]

  const statuses = {}
  const missing = []
  for (const job of jobs) {
    const report = join(folder, `mutation-report-${job}`, "mutation.json")
    if (!existsSync(report)) {
      missing.push(job)
      continue
    }
    const { files } = JSON.parse(readFileSync(report, "utf8"))
    for (const file of Object.values(files)) {
      for (const { status } of file.mutants) {
        statuses[status] = (statuses[status] ?? 0) + 1
      }
    }
  }

  const threshold = config.default.thresholds.break
  const count = (status) => statuses[status] ?? 0
  const detected = count("Killed") + count("Timeout")
  const undetected = count("Survived") + count("NoCoverage")
  let score
  if (missing.length > 0) {
    score = `missing ${missing.join(", ")}`
    failed = true
  } else if (detected + undetected === 0) {
    score = "no mutants"
    failed = true
  } else {
    const value = (100 * detected) / (detected + undetected)
    score = `${value.toFixed(2)}%`
    if (value < threshold) failed = true
  }
  lines.push(
    `| \`${pkg}\` | ${score} | ${threshold}% | ${detected} ` +
      `| ${count("Survived")} | ${count("NoCoverage")} |`
  )
}

if (result !== undefined && result !== "success") {
  lines.push("", `The mutation jobs' result is ${result}.`)
  failed = true
}

console.log(lines.join("\n"))
if (failed) process.exitCode = 1
