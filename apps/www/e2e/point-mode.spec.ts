import type { Page } from "@playwright/test"

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

// Every outline leaves room around its target, except against the edge of
// the screen, and every label sits clear of every outline's 2px ring:
// outside it, or inside it only when it's the label's own outline or one
// its own outline is nested in.
async function expectOutlinesClear(page: Page) {
  const room = 4
  const ring = 2
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
      top: Math.min(room, target.top - ring),
      left: Math.min(room, target.left - ring),
      right: Math.min(room, viewport.width - ring - target.right),
      bottom: Math.min(room, viewport.height - ring - target.bottom),
    }
    expect(target.top - box.top, `${name}: room above`).toBeGreaterThanOrEqual(
      roomTo.top
    )
    expect(target.left - box.left, `${name}: room left`).toBeGreaterThanOrEqual(
      roomTo.left
    )
    expect(
      box.right - target.right,
      `${name}: room right`
    ).toBeGreaterThanOrEqual(roomTo.right)
    expect(
      box.bottom - target.bottom,
      `${name}: room below`
    ).toBeGreaterThanOrEqual(roomTo.bottom)
    boxes.push({ name, outline: box, label: rectOf(labelBox) })
  }
  for (const { name, label } of boxes) {
    expect(label.left, `${name}: label on screen`).toBeGreaterThanOrEqual(0)
    expect(label.right, `${name}: label on screen`).toBeLessThanOrEqual(
      viewport.width
    )
    const own = boxes.find((box) => box.name === name)?.outline
    for (const { name: other, outline } of boxes) {
      const nested = other === name || (own && contains(outline, own))
      const clear =
        apart(label, grow(outline, ring + room)) ||
        (nested && contains(grow(outline, -room), label))
      expect(clear, `${name}'s label against ${other}'s outline`).toBe(true)
    }
  }
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

test("moves a label that would cross another outline", async ({
  page,
  errors,
}) => {
  // Tall enough that both outlines and their labels are on screen.
  await page.setViewportSize({ width: 1280, height: 1600 })
  await load(page)
  await page.getByRole("button", { name: "Point" }).click()
  const orders = layer(page).getByRole("button", { name: "All orders" })
  const id = await orders.getAttribute("data-pliant-point-target")
  await page.keyboard.press("Escape")
  const top =
    (await page.locator(`[data-pliant-id="${String(id)}"]`).boundingBox())?.y ??
    0
  // Move the key metrics down to just above all orders, where the label for
  // all orders would otherwise sit, without moving anything else.
  await page
    .getByRole("region", { name: "Key metrics" })
    .evaluate((section, top) => {
      const { bottom } = section.getBoundingClientRect()
      section.style.transform = `translateY(${String(top - 12 - bottom)}px)`
    }, top)

  await page.getByRole("button", { name: "Point" }).click()
  await expect(keyMetricsBox(page)).toBeVisible()

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
