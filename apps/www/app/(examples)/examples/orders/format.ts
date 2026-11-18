const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const date = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export function formatCurrency(value: number) {
  return currency.format(value)
}

export function formatDate(value: string) {
  return date.format(new Date(value))
}
