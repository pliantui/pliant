const allowedCharacters = /^(?:[A-Za-z0-9\-._~:/]|%[0-9A-Fa-f]{2})+$/

// The value is passed to a shell on Windows, so only characters that are inert
// there are accepted, and a query string, fragment or credentials can't be
// written with them.
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
