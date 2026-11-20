export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
) {
  return `${String(count)} ${count === 1 ? singular : plural}`
}
