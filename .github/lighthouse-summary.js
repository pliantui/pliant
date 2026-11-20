import { existsSync, readFileSync } from "node:fs"

// Prints the representative run of each audited URL as a Markdown table. Prints nothing when Lighthouse wrote no manifest.
// Usage: node .github/lighthouse-summary.js <reports folder>
const [folder] = process.argv.slice(2)
if (!folder) throw new Error("Pass the reports folder.")

const manifestPath = `${folder}/manifest.json`
if (!existsSync(manifestPath)) process.exit(0)

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const percent = (score) => Math.round(score * 100)

const rows = manifest
  .filter((run) => run.isRepresentativeRun)
  .map(({ url, summary }) => {
    const cells = [
      new URL(url).pathname,
      percent(summary.performance),
      percent(summary.accessibility),
      percent(summary["best-practices"]),
      percent(summary.seo),
    ]
    return `| ${cells.join(" | ")} |`
  })

const table = [
  "| URL | Performance | Accessibility | Best practices | SEO |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...rows,
].join("\n")

console.log(table)
