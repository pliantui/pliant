import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PliantPrePaint } from "./pliant-pre-paint"

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.head.replaceChildren()
})

function renderScript(nonce?: string) {
  const { container } = render(
    <PliantPrePaint surface="/orders" nonce={nonce} />
  )
  const script = container.querySelector("script")
  if (!script) {
    throw new Error("No script")
  }
  return script
}

// happy-dom doesn't run scripts, so this runs the script's text as the
// browser runs the server's copy: as the current script.
function run(script: HTMLScriptElement) {
  Object.defineProperty(document, "currentScript", {
    value: script,
    configurable: true,
  })
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the rendered script
    const execute = new Function(script.text) as () => void
    execute()
  } finally {
    Reflect.deleteProperty(document, "currentScript")
  }
}

describe("PliantPrePaint", () => {
  it("renders an inert script in the browser", () => {
    expect(renderScript().type).toBe("text/plain")
  })

  it("gives the style it adds the script's nonce", () => {
    localStorage.setItem(
      "pliant:/orders:01KAB0000000000000000000P1",
      JSON.stringify({
        overlay: { ops: [{ op: "hide", target: "key-metrics/slots/overdue" }] },
      })
    )
    const script = renderScript("n0nce")
    // Browsers hide the attribute once parsed and keep the nonce in the
    // property, which happy-dom doesn't implement.
    script.nonce = "n0nce"
    script.removeAttribute("nonce")

    run(script)

    expect(document.head.querySelector("style")?.nonce).toBe("n0nce")
  })

  it("adds no style for a user with no overlays", () => {
    run(renderScript())

    expect(document.head.querySelector("style")).toBeNull()
  })
})
