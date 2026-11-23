import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

function region(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

function layer(page: Page) {
  return page.locator('[data-slot="pliant-point-mode"]')
}

function keyMetricsBox(page: Page) {
  return layer(page).getByRole("button", { name: "Key metrics" })
}

interface Rect {
  top: number
  right: number
  bottom: number
  left: number
}

function rectOf(box: { x: number; y: number; width: number; height: number }) {
  return {
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    left: box.x,
  }
}

function grow(rect: Rect, by: number): Rect {
  return {
    top: rect.top - by,
    right: rect.right + by,
    bottom: rect.bottom + by,
    left: rect.left - by,
  }
}

function contains(outer: Rect, inner: Rect) {
  return (
    outer.left <= inner.left &&
    inner.right <= outer.right &&
    outer.top <= inner.top &&
    inner.bottom <= outer.bottom
  )
}

function apart(a: Rect, b: Rect) {
  return (
    a.right <= b.left ||
    b.right <= a.left ||
    a.bottom <= b.top ||
    b.bottom <= a.top
  )
}

// Every outline leaves a 6px gap around its target, less only against the
// edge of the screen, and every label sits clear of every outline's 2px ring:
// outside it, or inside it only when it's the label's own outline or one
// its own outline is nested in.
async function expectOutlinesClear(page: Page) {
  const gap = 6
  const ring = 2
  // A label's height with a gap on each side.
  const labelRoom = 32
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }))
  const outlines = await layer(page).getByRole("button").all()
  expect(outlines.length).toBeGreaterThan(0)
  const boxes: { name: string; outline: Rect; label: Rect }[] = []
  for (const outline of outlines) {
    const name =
      (await outline.getAttribute("aria-label")) ?? (await outline.innerText())
    const id = await outline.getAttribute("data-pliant-point-target")
    const outlineBox = await outline.boundingBox()
    const targetBox = await page
      .locator(`[data-pliant-id="${String(id)}"]`)
      .boundingBox()
    const labelBox = await outline
      .getByText(name, { exact: true })
      .boundingBox()
    expect(outlineBox && targetBox && labelBox, name).toBeTruthy()
    if (!outlineBox || !targetBox || !labelBox) return
    const box = rectOf(outlineBox)
    const target = rectOf(targetBox)
    const roomTo = {
      top: Math.min(gap, target.top - ring),
      left: Math.min(gap, target.left - ring),
      right: Math.min(gap, viewport.width - ring - target.right),
      bottom: Math.min(gap, viewport.height - ring - target.bottom),
    }
    const room = {
      top: target.top - box.top,
      left: target.left - box.left,
      right: box.right - target.right,
      bottom: box.bottom - target.bottom,
    }
    for (const side of ["top", "left", "right", "bottom"] as const) {
      expect(room[side], `${name}: room at the ${side}`).toBeGreaterThanOrEqual(
        roomTo[side]
      )
      expect(room[side], `${name}: room at the ${side}`).toBeLessThanOrEqual(
        gap + 1
      )
    }
    boxes.push({ name, outline: box, label: rectOf(labelBox) })
  }
  for (const { name, outline, label } of boxes) {
    expect(label.left, `${name}: label on screen`).toBeGreaterThanOrEqual(0)
    expect(label.right, `${name}: label on screen`).toBeLessThanOrEqual(
      viewport.width
    )
    // Checked only for an outline with room for a label on screen.
    if (
      outline.top + labelRoom <= viewport.height &&
      outline.bottom - labelRoom >= 0
    ) {
      expect(label.top, `${name}: label on screen`).toBeGreaterThanOrEqual(0)
      expect(label.bottom, `${name}: label on screen`).toBeLessThanOrEqual(
        viewport.height
      )
    }
    for (const { name: other, outline: otherOutline } of boxes) {
      const nested = other === name || contains(otherOutline, outline)
      const clear =
        apart(label, grow(otherOutline, ring + gap - 1)) ||
        (nested && contains(grow(otherOutline, 1 - gap), label))
      expect(clear, `${name}'s label against ${other}'s outline`).toBe(true)
    }
  }
}

async function isAbove(label: Locator, outline: Locator) {
  const labelBox = await label.boundingBox()
  const outlineBox = await outline.boundingBox()
  expect(labelBox && outlineBox).toBeTruthy()
  return (labelBox?.y ?? 0) + (labelBox?.height ?? 0) <= (outlineBox?.y ?? 0)
}

async function load(page: Page) {
  await page.goto(surface)
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
}

async function expectAskingAboutKeyMetrics(page: Page) {
  const panel = page.getByRole("complementary", { name: "Ask" })
  await expect(panel.getByRole("combobox", { name: "Change" })).toHaveText(
    "Key metrics"
  )
  await expect(panel.getByRole("textbox", { name: "Ask" })).toBeFocused()
  return panel
}

test("holds Alt, clicks the key metrics and asks a suggestion", async ({
  page,
  errors,
}) => {
  await load(page)

  await page.keyboard.down("Alt")
  await expect(keyMetricsBox(page)).toBeVisible()
  await expectOutlinesClear(page)

  await keyMetricsBox(page).click()
  await page.keyboard.up("Alt")

  await expect(layer(page)).toBeHidden()
  const panel = await expectAskingAboutKeyMetrics(page)
  await panel
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "put the overdue card first" })
    .click()
  await page.keyboard.press("Enter")

  await expect(panel.getByRole("status")).toContainText(
    "Moved the Overdue card to the first position."
  )
  await expect(
    region(page).locator(":scope > [data-pliant-id]").first()
  ).toHaveAttribute("data-pliant-id", "overdue")
  expect(errors).toEqual([])
})

test("goes away when Alt is released", async ({ page, errors }) => {
  await load(page)

  await page.keyboard.down("Alt")
  await expect(layer(page)).toBeVisible()
  await page.keyboard.up("Alt")

  await expect(layer(page)).toBeHidden()
  await expect(page.getByRole("complementary", { name: "Ask" })).toBeHidden()
  expect(errors).toEqual([])
})

test("picks with the keyboard alone", async ({ page, errors }) => {
  await load(page)

  await page.keyboard.press("ControlOrMeta+Period")
  await expect(keyMetricsBox(page)).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(
    layer(page).getByRole("button", { name: "All orders" })
  ).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(keyMetricsBox(page)).toBeFocused()
  await page.keyboard.press("Enter")

  await expect(layer(page)).toBeHidden()
  await expectAskingAboutKeyMetrics(page)
  expect(errors).toEqual([])
})

test("leaves on Escape and returns focus to the toggle", async ({
  page,
  errors,
}) => {
  await load(page)
  const toggle = page.getByRole("button", { name: "Point" })

  await toggle.focus()
  await page.keyboard.press("Enter")
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await expect(keyMetricsBox(page)).toBeFocused()
  await page.keyboard.press("Escape")

  await expect(layer(page)).toBeHidden()
  await expect(toggle).toHaveAttribute("aria-pressed", "false")
  await expect(toggle).toBeFocused()
  expect(errors).toEqual([])
})

test("points again from the prompt at the target it already shows", async ({
  page,
  errors,
}) => {
  await load(page)
  await page.getByRole("button", { name: "Ask" }).click()
  const textbox = page.getByRole("textbox", { name: "Ask" })
  await expect(textbox).toBeFocused()

  await page.keyboard.down("Alt")
  await keyMetricsBox(page).click()
  await page.keyboard.up("Alt")

  await expect(layer(page)).toBeHidden()
  await expect(textbox).toBeFocused()
  expect(errors).toEqual([])
})

test("ignores Alt while typing in another field", async ({ page, errors }) => {
  await load(page)
  await page.evaluate(() => {
    const input = document.createElement("input")
    input.setAttribute("aria-label", "Scratch")
    document.querySelector("main")?.prepend(input)
    input.focus()
  })

  await page.keyboard.down("Alt")
  await page.waitForTimeout(500)
  await expect(layer(page)).toBeHidden()
  await page.keyboard.up("Alt")
  await expect(page.getByRole("textbox", { name: "Scratch" })).toBeFocused()
  expect(errors).toEqual([])
})

test("waits for the ask panel's target picker to close", async ({
  page,
  errors,
}) => {
  await load(page)
  await page.getByRole("button", { name: "Ask" }).click()
  const picker = page.getByRole("combobox", { name: "Change" })
  const listbox = page.getByRole("listbox")

  await picker.click()
  await expect(listbox).toBeVisible()
  await page.keyboard.press("ControlOrMeta+Period")
  await expect(layer(page)).toBeHidden()
  await page.keyboard.down("Alt")
  await page.waitForTimeout(500)
  await expect(layer(page)).toBeHidden()
  await page.keyboard.up("Alt")
  await expect(listbox).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(listbox).toBeHidden()
  await expect(picker).toBeFocused()
  await page.keyboard.press("ControlOrMeta+Period")
  await expect(keyMetricsBox(page)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(layer(page)).toBeHidden()
  await expect(picker).toBeFocused()
  await page.keyboard.down("Alt")
  await expect(keyMetricsBox(page)).toBeVisible()
  await page.keyboard.up("Alt")
  await expect(layer(page)).toBeHidden()
  expect(errors).toEqual([])
})

test("waits for a native modal dialog to close", async ({ page, errors }) => {
  await load(page)
  await page.evaluate(() => {
    const dialog = document.createElement("dialog")
    dialog.setAttribute("aria-label", "Settings")
    dialog.innerHTML = "<button>Done</button>"
    document.body.append(dialog)
    dialog.showModal()
  })
  const dialog = page.getByRole("dialog", { name: "Settings" })
  await expect(dialog.getByRole("button", { name: "Done" })).toBeFocused()

  await page.keyboard.press("ControlOrMeta+Period")
  await expect(layer(page)).toBeHidden()
  await page.keyboard.down("Alt")
  await page.waitForTimeout(500)
  await expect(layer(page)).toBeHidden()
  await page.keyboard.up("Alt")

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await page.keyboard.down("Alt")
  await expect(keyMetricsBox(page)).toBeVisible()
  await page.keyboard.up("Alt")
  await expect(layer(page)).toBeHidden()
  await page.keyboard.press("ControlOrMeta+Period")
  await expect(keyMetricsBox(page)).toBeFocused()
  expect(errors).toEqual([])
})

test("keeps its outlines clickable under a modal layer", async ({
  page,
  errors,
}) => {
  await load(page)
  await page.getByRole("button", { name: "Point" }).click()
  await expect(keyMetricsBox(page)).toBeFocused()
  await page.evaluate(() => {
    document.body.style.pointerEvents = "none"
  })

  await keyMetricsBox(page).click()

  await expect(layer(page)).toBeHidden()
  await expectAskingAboutKeyMetrics(page)
  expect(errors).toEqual([])
})

test("keeps a label on screen for a target at the right edge", async ({
  page,
  errors,
}) => {
  await load(page)
  await page
    .getByRole("region", { name: "Key metrics" })
    .evaluate((section) => {
      section.style.position = "fixed"
      section.style.top = "200px"
      section.style.right = "0"
      section.style.width = "40px"
    })

  await page.keyboard.down("Alt")
  const label = layer(page).getByText("Key metrics", { exact: true })
  await expect(label).toBeVisible()
  const box = await label.boundingBox()
  const width = await page.evaluate(() => document.documentElement.clientWidth)
  await page.keyboard.up("Alt")

  expect(box).not.toBeNull()
  expect(box?.x).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width)
  expect(errors).toEqual([])
})

// The extent of an element's text, which is narrower than a block heading.
async function textBox(locator: Locator) {
  return locator.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const { x, y, width, height } = range.getBoundingClientRect()
    return { x, y, width, height }
  })
}

test("keeps its labels off the page's headings and notes", async ({
  page,
  errors,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 })
  await load(page)

  await page.keyboard.down("Alt")
  await expect(keyMetricsBox(page)).toBeVisible()
  const labels = [
    await layer(page).getByText("Key metrics", { exact: true }).boundingBox(),
    await layer(page).getByText("All orders", { exact: true }).boundingBox(),
  ]
  const covered = [
    await textBox(page.getByRole("heading", { name: "Orders", exact: true })),
    await textBox(page.getByRole("heading", { name: "All orders" })),
    await textBox(
      page.getByText(
        "This demo replays recorded answers; no AI model is called."
      )
    ),
  ]
  await page.keyboard.up("Alt")

  for (const label of labels) {
    for (const content of covered) {
      expect(label).toBeTruthy()
      if (!label) continue
      expect(apart(rectOf(label), rectOf(content))).toBe(true)
    }
  }
  expect(errors).toEqual([])
})

test("stays below the sticky site header when the page is scrolled", async ({
  page,
  errors,
}) => {
  await load(page)
  const header = await page.getByRole("banner").boundingBox()
  expect(header).not.toBeNull()
  // Once the page scrolls, the sticky header sits at the top.
  const headerBottom = header?.height ?? 0
  // Scrolls the key metrics partly under the header.
  await region(page).evaluate((element, offset) => {
    window.scrollBy(0, element.getBoundingClientRect().top - offset)
  }, headerBottom - 40)

  await page.keyboard.down("Alt")
  await expect(keyMetricsBox(page)).toBeVisible()
  const outline = await keyMetricsBox(page).boundingBox()
  const label = await layer(page)
    .getByText("Key metrics", { exact: true })
    .boundingBox()
  expect(outline && label).toBeTruthy()
  expect(outline?.y ?? 0).toBeLessThan(headerBottom)
  expect(label?.y ?? 0).toBeGreaterThanOrEqual(headerBottom)

  // The outline is cut off under the header, so clicking there picks
  // nothing.
  await page.mouse.click((outline?.x ?? 0) + 40, headerBottom - 4)
  await expect(layer(page)).toBeHidden()
  await page.keyboard.up("Alt")
  await expect(page.getByRole("complementary", { name: "Ask" })).toBeHidden()
  expect(errors).toEqual([])
})

async function accessibilityTree(page: Page) {
  const client = await page.context().newCDPSession(page)
  const { nodes } = await client.send("Accessibility.getFullAXTree")
  await client.detach()
  return nodes.flatMap((node) =>
    node.ignored
      ? []
      : [
          {
            role: String(node.role?.value),
            name: String(node.name?.value ?? ""),
            description: String(node.description?.value ?? ""),
          },
        ]
  )
}

async function buttons(page: Page) {
  return (await accessibilityTree(page)).flatMap((node) =>
    node.role === "button" ? [node.name] : []
  )
}

test("is a modal dialog when started from the toggle", async ({
  page,
  errors,
}) => {
  await load(page)
  const toggle = page.getByRole("button", { name: "Point" })

  await toggle.click()
  await expect(keyMetricsBox(page)).toBeFocused()
  await expect(
    page.getByRole("dialog", { name: "Point mode" })
  ).toHaveAttribute("aria-modal", "true")
  expect(await buttons(page)).toEqual(["Key metrics", "All orders"])
  expect(
    (await accessibilityTree(page)).filter((node) => node.role === "dialog")
  ).toEqual([
    {
      role: "dialog",
      name: "Point mode",
      description:
        "Pick a part to change. Use Tab or the arrow keys to move, Enter to pick, Escape to leave.",
    },
  ])

  await page.keyboard.press("Escape")
  await expect(layer(page)).toBeHidden()
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute("aria-pressed", "false")
  expect(await buttons(page)).toEqual(expect.arrayContaining(["Point", "Ask"]))
  expect(errors).toEqual([])
})

test("announces the mode while Alt is held", async ({ page, errors }) => {
  await load(page)
  async function announced() {
    return (await accessibilityTree(page)).some(
      (node) =>
        node.role === "StaticText" &&
        node.name === "Point mode on. Click the part you want to change."
    )
  }

  await page.keyboard.down("Alt")
  await expect(keyMetricsBox(page)).toBeVisible()
  expect(await buttons(page)).toEqual(
    expect.arrayContaining(["Point", "Ask", "Key metrics"])
  )
  await expect.poll(announced).toBe(true)
  await page.keyboard.up("Alt")
  expect(errors).toEqual([])
})

for (const colorScheme of ["light", "dark"] as const) {
  test(`leaves room around outlines and labels in ${colorScheme} mode`, async ({
    page,
    errors,
  }) => {
    await page.emulateMedia({ colorScheme })
    await load(page)

    await page.getByRole("button", { name: "Point" }).click()
    await expect(keyMetricsBox(page)).toBeVisible()

    await expectOutlinesClear(page)
    expect(errors).toEqual([])
  })
}

test("moves a label out of the way of the outline above it", async ({
  page,
  errors,
}) => {
  // Tall enough that both outlines and their labels are on screen.
  await page.setViewportSize({ width: 1280, height: 1600 })
  await load(page)
  const orders = layer(page).getByRole("button", { name: "All orders" })
  const ordersLabel = orders.getByText("All orders", { exact: true })

  // The key metrics sit just above all orders, where its label would go.
  await page.getByRole("button", { name: "Point" }).click()
  await expect(orders).toBeVisible()
  expect(await isAbove(ordersLabel, orders)).toBe(false)
  await expectOutlinesClear(page)
  await page.keyboard.press("Escape")

  // With the key metrics moved up and out of the way, it goes back above.
  await page
    .getByRole("region", { name: "Key metrics" })
    .evaluate((section) => {
      section.style.transform = "translateY(-80px)"
    })
  await page.keyboard.press("ControlOrMeta+Period")
  await expect(orders).toBeVisible()
  expect(await isAbove(ordersLabel, orders)).toBe(true)
  await expectOutlinesClear(page)
  expect(errors).toEqual([])
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 640 }, hasTouch: true })

  test("points by touch and follows the page as it scrolls", async ({
    page,
    errors,
  }) => {
    await load(page)

    await page.getByRole("button", { name: "Point" }).tap()
    await expect(keyMetricsBox(page)).toBeVisible()
    const before = await keyMetricsBox(page).boundingBox()

    await page.evaluate(() => {
      window.scrollBy(0, 120)
    })
    await expect
      .poll(async () => (await keyMetricsBox(page).boundingBox())?.y)
      .toBe((before?.y ?? 0) - 120)
    await expectOutlinesClear(page)

    await keyMetricsBox(page).tap()

    await expect(layer(page)).toBeHidden()
    await expect(
      page
        .getByRole("complementary", { name: "Ask" })
        .getByRole("combobox", { name: "Change" })
    ).toHaveText("Key metrics")
    expect(errors).toEqual([])
  })
})
