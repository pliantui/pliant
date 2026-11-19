const version = 1

/** The session layer of one surface, as mirrored to `sessionStorage`. */
export interface MirroredSession {
  readonly overlays: readonly unknown[]
  readonly preview: unknown
}

function keyOf(surface: string) {
  return `pliant:session:${surface}`
}

export function readSession(surface: string): MirroredSession {
  let value: unknown
  try {
    value = JSON.parse(sessionStorage.getItem(keyOf(surface)) ?? "null")
  } catch {
    return { overlays: [], preview: null }
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("v" in value) ||
    value.v !== version
  ) {
    return { overlays: [], preview: null }
  }
  const overlays = "overlays" in value ? value.overlays : undefined
  return {
    overlays: Array.isArray(overlays) ? overlays : [],
    preview: "preview" in value ? value.preview : null,
  }
}

export function writeSession(
  surface: string,
  { overlays, preview }: MirroredSession
) {
  try {
    sessionStorage.setItem(
      keyOf(surface),
      JSON.stringify({ v: version, overlays, preview })
    )
  } catch {
    // The mirror only survives reloads; the session layer still works in
    // memory when storage is full or blocked.
  }
}
