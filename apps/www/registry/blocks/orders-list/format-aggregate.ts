import { formatCurrency, formatNumber } from "@/lib/demo/format"
import {
  formatPliantValue,
  type PliantDataTableFormat,
} from "@/registry/pliant/pliant-data-table-format"

// Formats a table's group totals and summaries in rupees and Indian digit
// grouping.
export function formatAggregate(
  value: unknown,
  unit: string | undefined,
  format?: PliantDataTableFormat
) {
  if (format) {
    return formatPliantValue(value, format, unit, {
      locale: "en-IN",
      timeZone: "UTC",
    })
  }
  if (typeof value === "number") {
    return unit === "INR" ? formatCurrency(value) : formatNumber(value)
  }
  return typeof value === "string" || typeof value === "boolean"
    ? String(value)
    : "—"
}
