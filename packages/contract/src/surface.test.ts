import { describe, expect, it } from "vitest"

import { surfaceSchema } from "./surface"

const decoder = new TextDecoder("utf-8", { fatal: true })

function isUtf8(bytes: number[]) {
  try {
    decoder.decode(new Uint8Array(bytes))
    return true
  } catch {
    return false
  }
}

function accepts(bytes: number[]) {
  const encoded = bytes
    .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`)
    .join("")
  return surfaceSchema.safeParse(`/${encoded}`).success
}

const high = Array.from({ length: 128 }, (_, index) => index + 0x80)

describe("surfaceSchema percent-encoding", () => {
  it("accepts exactly the well-formed 2-byte sequences", () => {
    for (const first of high) {
      for (const second of high) {
        const bytes = [first, second]
        expect(accepts(bytes), bytes.join()).toBe(isUtf8(bytes))
      }
    }
  })

  it("accepts exactly the well-formed 3-byte sequences", () => {
    for (let first = 0xe0; first <= 0xef; first++) {
      for (const second of high) {
        for (const third of high) {
          const bytes = [first, second, third]
          if (accepts(bytes) !== isUtf8(bytes)) {
            expect.fail(`mismatch on ${bytes.join()}`)
          }
        }
      }
    }
  })

  it("accepts exactly the well-formed 4-byte sequences at each boundary", () => {
    for (let first = 0xf0; first <= 0xf7; first++) {
      for (const second of high) {
        for (const rest of [0x80, 0xbf, 0xc0]) {
          const bytes = [first, second, rest, rest]
          expect(accepts(bytes), bytes.join()).toBe(isUtf8(bytes))
        }
      }
    }
  })

  it.each(["/%E2%82", "/%C3%C3", "/%C3%a9"])("rejects %s", (surface) => {
    expect(surfaceSchema.safeParse(surface).success).toBe(false)
  })
})
