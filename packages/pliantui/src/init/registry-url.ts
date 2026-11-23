const allowedCharacters = /^(?:[A-Za-z0-9\-._~:/]|%[0-9A-Fa-f]{2})+$/

// The value becomes the base of the `{name}.json` template in components.json,
// a file that is usually committed. Without `?`, `#`, `@` or braces it can't
// carry a query string or fragment that the appended path would land inside,
// credentials, or a placeholder of its own.
export function parseRegistryUrl(value: string) {
  if (!allowedCharacters.test(value)) {
    return null
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null
  }
  return value.replace(/\/+$/, "")
}
