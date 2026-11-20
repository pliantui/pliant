import type * as nodePath from "node:path"
import { describe, expect, it, vi } from "vitest"

import { isAppLayout } from "./app-routes"

// Windows paths, where a file on another drive has no relative path.
vi.mock("node:path", async () => {
  const actual = await vi.importActual<typeof nodePath>("node:path")
  return { ...actual.win32, default: actual.win32 }
})

describe("isAppLayout on Windows", () => {
  it("finds a layout in the app folder", () => {
    expect(
      isAppLayout("C:\\shop\\app\\(store)\\layout.tsx", "C:\\shop\\app")
    ).toBe(true)
  })

  it("leaves out a layout on another drive", () => {
    expect(isAppLayout("D:\\other\\layout.tsx", "C:\\shop\\app")).toBe(false)
  })
})
