// The name the shadcn CLI installs a Pliant registry item by, like
// `@pliant/pliant-region`. The registry's own files refer to other Pliant
// items by URL, which this turns into the same short name.
export function pliantItemName(item: string) {
  const name = /\/r\/([a-z0-9-]+)\.json$/.exec(item)?.[1] ?? item
  return `@pliant/${name}`
}

export function isPliantItemUrl(item: string) {
  return /^https?:\/\/.+\/r\/[a-z0-9-]+\.json$/.test(item)
}
