import { StrictMode } from "react"
import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PliantPrePaint } from "./pliant-pre-paint"

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.head.replaceChildren()
  document.body.replaceChildren()
})

function renderScript(nonce?: string, revealAfter?: number) {
  const { container } = render(
    <PliantPrePaint surface="/orders" nonce={nonce} revealAfter={revealAfter} />
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

function storeOverlay() {
  localStorage.setItem(
    "pliant:/orders:01KAB0000000000000000000P1",
    JSON.stringify({
      overlay: { ops: [{ op: "hide", target: "key-metrics/slots/overdue" }] },
    })
  )
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

  it("gives the style the nonce when only the attribute carries it", () => {
    storeOverlay()
    const script = renderScript("n0nce")

    run(script)

    expect(document.head.querySelector("style")?.nonce).toBe("n0nce")
  })

  it("ends the skeleton after the time it is given", () => {
    storeOverlay()
    run(renderScript(undefined, 2500))

    expect(document.head.querySelector("style")?.textContent).toContain(
      "0s 2500ms forwards"
    )
  })

  it("ends the skeleton after 4.5 seconds by default", () => {
    storeOverlay()
    run(renderScript())

    expect(document.head.querySelector("style")?.textContent).toContain(
      "0s 4500ms forwards"
    )
  })

  it("ends the skeleton at once for a time that isn't a number", () => {
    storeOverlay()
    run(renderScript(undefined, Number.NaN))

    expect(document.head.querySelector("style")?.textContent).toContain(
      "0s 0ms forwards"
    )
  })
})

describe("the style it adds", () => {
  function addStyle() {
    const style = document.createElement("style")
    style.id = "pliant-pre-paint"
    document.head.appendChild(style)
  }

  it("is removed once no node is pending", () => {
    addStyle()

    render(<PliantPrePaint surface="/orders" />)

    expect(document.getElementById("pliant-pre-paint")).toBeNull()
  })

  it("stays while a node is pending, and is removed after", async () => {
    addStyle()
    const node = document.createElement("div")
    node.setAttribute("data-pliant-pending", "")
    document.body.appendChild(node)

    render(<PliantPrePaint surface="/orders" />)
    expect(document.getElementById("pliant-pre-paint")).not.toBeNull()

    node.removeAttribute("data-pliant-pending")
    await waitFor(() => {
      expect(document.getElementById("pliant-pre-paint")).toBeNull()
    })
  })

  it("is removed once under Strict Mode", () => {
    addStyle()

    render(
      <StrictMode>
        <PliantPrePaint surface="/orders" />
      </StrictMode>
    )

    expect(document.getElementById("pliant-pre-paint")).toBeNull()
  })

  it("stays when the component unmounts while a node is pending", async () => {
    addStyle()
    const node = document.createElement("div")
    node.setAttribute("data-pliant-pending", "")
    document.body.appendChild(node)

    const { unmount } = render(<PliantPrePaint surface="/orders" />)
    unmount()
    node.removeAttribute("data-pliant-pending")
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(document.getElementById("pliant-pre-paint")).not.toBeNull()
  })
})
