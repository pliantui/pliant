import path from "node:path"

import type { scanProject } from "../scan/scan-project"
import { pluralize } from "../utils/pluralize"
import type { Check } from "./check"

/** Whether the saved inventory is there and matches the app, as `scan --check`. */
export function checkInventory(
  scanned: Awaited<ReturnType<typeof scanProject>>,
  cwd: string
): Check {
  const { report, surfaces, inventory, saved, upToDate } = scanned
  const file = path.relative(cwd, scanned.inventoryFile)
  if (report.errors.length > 0) {
    return {
      name: "inventory",
      status: "fail",
      message: `The scan found ${pluralize(report.errors.length, "error")}, so ${file} can't be checked.`,
      fix: "Fix the errors and run npx pliantui scan.",
      problems: report.errors,
    }
  }
  if (surfaces.length === 0 && saved === undefined) {
    return {
      name: "inventory",
      status: "skip",
      message: "No PliantRoot with a surface found, so there's no inventory.",
    }
  }
  if (!upToDate) {
    return {
      name: "inventory",
      status: "fail",
      message: `${file} is ${saved === undefined ? "missing" : "out of date"}.`,
      fix: "Run npx pliantui scan and commit the result.",
    }
  }
  const partial = Object.entries(inventory)
    .filter(([, { baseIds }]) => baseIds.source === "mounted")
    .map(([surface]) => surface)
  if (partial.length > 0 || report.warnings.length > 0) {
    return {
      name: "inventory",
      status: "warn",
      message:
        partial.length > 0
          ? `${file} is up to date, but ${pluralize(partial.length, "surface")} ${partial.length === 1 ? "isn't" : "aren't"} read in full: ${partial.join(", ")}.`
          : `${file} is up to date, but the scan has ${pluralize(report.warnings.length, "warning")}.`,
      fix: "Fix what the warnings point to and run npx pliantui scan.",
      problems: report.warnings,
    }
  }
  return {
    name: "inventory",
    status: "pass",
    message: `${file} is up to date.`,
  }
}
