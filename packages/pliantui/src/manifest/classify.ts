/**
 * How a prop value may be used:
 * - `user`: users may set it.
 * - `semantic`: shown, but never assignable by users, because it carries meaning.
 * - `state`: never assignable and not shown, because the component sets it.
 * - `confirm`: left out until the developer confirms it.
 * - `hidden`: left out by the developer.
 */
export type ValueClass = "user" | "semantic" | "state" | "confirm" | "hidden"

const semanticWords = new Set([
  "destructive",
  "danger",
  "error",
  "warning",
  "caution",
  "success",
  "info",
])

const colorWords = new Set([
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
])

const escapeHatches = new Set(["none", "link", "unstyled"])

const stateProps = new Set([
  "active",
  "busy",
  "checked",
  "disabled",
  "expanded",
  "invalid",
  "loading",
  "open",
  "pending",
  "pressed",
  "readonly",
  "selected",
])

function splitWords(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_\-/.]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
}

function isStateProp(name: string) {
  return /^(is|has)[A-Z]/.test(name) || stateProps.has(name.toLowerCase())
}

export function classifyValues(
  prop: string,
  values: string[],
  { boolean = false, fromUnion = false } = {}
): ValueClass[] {
  if (isStateProp(prop)) {
    return values.map(() => "state")
  }
  if (fromUnion || boolean) {
    return values.map(() => "confirm")
  }
  if (prop === "severity") {
    return values.map(() => "semantic")
  }
  if (prop === "status") {
    const isData = values.every((value) => /^[A-Z][A-Z0-9_]*$/.test(value))
    return values.map(() => (isData ? "state" : "semantic"))
  }
  return values.map((value) => {
    // Manifest values are strings, so a number key like `1` only matches a
    // string prop if the developer says so.
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return "confirm"
    }
    const words = splitWords(value)
    if (words.some((word) => semanticWords.has(word))) {
      return "semantic"
    }
    if (
      words.some((word) => colorWords.has(word)) ||
      escapeHatches.has(value.toLowerCase())
    ) {
      return "confirm"
    }
    return "user"
  })
}
