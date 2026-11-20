import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// Prints one package's mutation score from Stryker's JSON report as a
// Markdown table. Usage: node .github/mutation-summary.js packages/core
const [directory] = process.argv.slice(2)
if (!directory) throw new Error("Pass the package directory.")

const report = join(directory, "reports/mutation/mutation.json")
const config = await import(
  pathToFileURL(join(directory, "stryker.config.mjs")).href
)
const { thresholds } = config.default

let line
if (existsSync(report)) {
  const counts = {}
  const { files } = JSON.parse(readFileSync(report, "utf8"))
  for (const file of Object.values(files)) {
    for (const { status } of file.mutants) {
      counts[status] = (counts[status] ?? 0) + 1
    }
  }
  const count = (status) => counts[status] ?? 0
  const detected = count("Killed") + count("Timeout")
  const undetected = count("Survived") + count("NoCoverage")
  const score = (100 * detected) / (detected + undetected)
  line =
    `| \`${directory}\` | ${score.toFixed(2)}% | ${thresholds.break}% ` +
    `| ${detected} | ${count("Survived")} | ${count("NoCoverage")} |`
} else {
  line = `| \`${directory}\` | no report | ${thresholds.break}% | | | |`
}

const summary = [
  "| Package | Score | Break | Detected | Survived | No coverage |",
  "| ------- | ----: | ----: | -------: | -------: | ----------: |",
  line,
  "",
].join("\n")

console.log(summary)
