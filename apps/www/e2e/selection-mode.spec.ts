import type { Locator, Page } from "@playwright/test"

import { expect, pickCustomize, test } from "./fixtures"

const surface = "/examples/orders"
const base = ["revenue", "orders", "average-order-value", "overdue"]

function region(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

function pageMenu(page: Page) {
  return page.getByRole("button", { name: "Customize the orders page" })
}

function layer(page: Page) {
  return page.getByRole("dialog", { name: "Point mode" })
}

function outline(page: Page, name: string) {
  return layer(page).getByRole("button", { name, exact: true })
}

function handle(page: Page, name: string) {
  return layer(page).getByRole("button", { name, exact: true })
}

function bar(page: Page, name = "Key metrics") {
  return layer(page).getByRole("toolbar", { name: `Change ${name}` })
}

function card(page: Page, id: string) {
  return page.locator(`[data-pliant-id="${id}"] > *`).first()
}

async function load(page: Page) {
  await page.goto(surface)
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
}

async function slotOrder(page: Page) {
  return region(page)
    .locator(":scope > [data-pliant-id]")
    .evaluateAll((elements) =>
      elements.flatMap((element) =>
        element.firstElementChild?.checkVisibility()
          ? [element.getAttribute("data-pliant-id")]
          : []
      )
    )
}

async function width(locator: Locator) {
  return (await locator.boundingBox())?.width ?? 0
}

async function select(page: Page, name: string) {
  await pickCustomize(pageMenu(page), "Adjust by hand")
  // A tall part's outline runs past the screen, so it's picked with the
  // keyboard; clicking and tapping are tested on their own.
  await outline(page, name).focus()
  await page.keyboard.press("Enter")
  await expect(outline(page, name)).toHaveAttribute("aria-pressed", "true")
}

async function announced(page: Page, text: string) {
  await expect(layer(page).getByRole("status")).toHaveText(text)
}

async function centre(locator: Locator) {
  const box = await locator.boundingBox()
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  }
}

async function dragBy(page: Page, from: Locator, dx: number, dy = 0) {
  const start = await centre(from)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 })
  await page.mouse.up()
}

async function resetFromBar(page: Page) {
  await bar(page).getByRole("button", { name: "Reset" }).click()
  await announced(page, "Reset Key metrics.")
}

test.describe("entering", () => {
  test("Adjust by hand in the page's Customize menu outlines every part", async ({
    page,
    errors,
  }) => {
    await load(page)
    await pickCustomize(pageMenu(page), "Adjust by hand")

    await expect(outline(page, "Key metrics")).toBeFocused()
    await expect(outline(page, "Overdue")).toBeVisible()
    await expect(outline(page, "All orders")).toBeVisible()
    await expect(
      layer(page).getByRole("button", { pressed: true })
    ).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(layer(page)).toBeHidden()
    await expect(pageMenu(page)).toBeFocused()
    expect(errors).toEqual([])
  })

  test("Adjust by hand in a region's right-click menu selects that region", async ({
    page,
    errors,
  }) => {
    await load(page)
    await card(page, "orders").click({ button: "right" })
    await page.getByRole("menuitem", { name: "Adjust by hand" }).click()

    await expect(outline(page, "Key metrics")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(outline(page, "Key metrics")).toBeFocused()
    await expect(bar(page)).toBeVisible()
    expect(errors).toEqual([])
  })

  test("Adjust by hand in the table's right-click menu goes to its controls", async ({
    page,
    errors,
  }) => {
    await load(page)
    await page
      .getByRole("table", { name: "All orders" })
      .getByRole("row")
      .nth(1)
      .click({ button: "right" })
    await page.getByRole("menuitem", { name: "Adjust by hand" }).click()

    await expect(
      page.getByRole("searchbox", { name: "Customer" })
    ).toBeFocused()
    await expect(page.locator('[data-slot="pliant-point-mode"]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("holding Alt and clicking a part selects it and keeps it", async ({
    page,
    errors,
  }) => {
    await load(page)
    await page.keyboard.down("Alt")
    await page
      .locator('[data-slot="pliant-point-mode"]')
      .getByRole("button", { name: "Overdue", exact: true })
      .click()
    await page.keyboard.up("Alt")

    await expect(outline(page, "Overdue")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await announced(page, "Overdue selected.")
    expect(errors).toEqual([])
  })

  test("⌘. doesn't start point mode", async ({ page, errors }) => {
    await load(page)
    await pageMenu(page).focus()
    await page.keyboard.press("ControlOrMeta+Period")

    await expect(page.locator('[data-slot="pliant-point-mode"]')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

test.describe("moving", () => {
  test("drags a card to a new place, and Reset puts it back", async ({
    page,
    errors,
  }) => {
    await load(page)
    await select(page, "Overdue")
    const revenue = await centre(card(page, "revenue"))
    const from = await centre(handle(page, "Move Overdue"))

    await dragBy(page, handle(page, "Move Overdue"), revenue.x - from.x, 0)

    await expect
      .poll(() => slotOrder(page))
      .toEqual(["overdue", "revenue", "orders", "average-order-value"])
    await announced(page, "Moved Overdue to position 1 of 4.")
    await resetFromBar(page)
    await expect.poll(() => slotOrder(page)).toEqual(base)
    expect(errors).toEqual([])
  })

  test("moves a card with the arrow keys and keeps it after a reload", async ({
    page,
    errors,
  }) => {
    await load(page)
    await select(page, "Orders")

    await page.keyboard.press("ArrowLeft")
    await expect
      .poll(() => slotOrder(page))
      .toEqual(["orders", "revenue", "average-order-value", "overdue"])
    await announced(page, "Moved Orders to position 1 of 4.")
    await expect(outline(page, "Orders")).toBeFocused()
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")
    await expect
      .poll(() => slotOrder(page))
      .toEqual(["revenue", "average-order-value", "orders", "overdue"])

    await page.reload()
    await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
    await expect
      .poll(() => slotOrder(page))
      .toEqual(["revenue", "average-order-value", "orders", "overdue"])
    await pickCustomize(pageMenu(page), "Reset to default")
    await expect.poll(() => slotOrder(page)).toEqual(base)
    expect(errors).toEqual([])
  })
})

test.describe("resizing", () => {
  test("drags a card wider across the grid, and Reset narrows it", async ({
    page,
    errors,
  }) => {
    await load(page)
    const before = await width(card(page, "revenue"))
    await select(page, "Revenue")

    await dragBy(page, handle(page, "Resize Revenue"), before)

    await expect
      .poll(async () => (await width(card(page, "revenue"))) / before)
      .toBeGreaterThan(1.9)
    await announced(page, "Revenue spans 2 columns.")
    await resetFromBar(page)
    await expect.poll(() => width(card(page, "revenue"))).toBe(before)
    expect(errors).toEqual([])
  })

  test("resizes with Shift and the arrow keys", async ({ page, errors }) => {
    await load(page)
    const before = await width(card(page, "orders"))
    await select(page, "Orders")

    await page.keyboard.press("Shift+ArrowRight")
    await expect
      .poll(async () => (await width(card(page, "orders"))) / before)
      .toBeGreaterThan(1.9)
    await announced(page, "Orders spans 2 columns.")
    await page.keyboard.press("Shift+ArrowLeft")
    await expect.poll(() => width(card(page, "orders"))).toBe(before)
    await announced(page, "Orders spans 1 column.")
    expect(errors).toEqual([])
  })
})

test.describe("hiding", () => {
  test("hides a card from its handle, and Reset brings it back", async ({
    page,
    errors,
  }) => {
    await load(page)
    await select(page, "Average order value")

    await handle(page, "Hide Average order value").click()

    await expect
      .poll(() => slotOrder(page))
      .toEqual(["revenue", "orders", "overdue"])
    await announced(page, "Hid Average order value. Reset brings it back.")
    await expect(outline(page, "Key metrics")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await resetFromBar(page)
    await expect.poll(() => slotOrder(page)).toEqual(base)
    expect(errors).toEqual([])
  })

  test("hides a card with Delete", async ({ page, errors }) => {
    await load(page)
    await select(page, "Overdue")

    await page.keyboard.press("Delete")

    await expect
      .poll(() => slotOrder(page))
      .toEqual(["revenue", "orders", "average-order-value"])
    await expect(outline(page, "Key metrics")).toBeFocused()
    expect(errors).toEqual([])
  })
})

test.describe("guardrails", () => {
  test("a required card has no hide handle, and Delete leaves it", async ({
    page,
    errors,
  }) => {
    await load(page)
    await select(page, "Revenue")

    await expect(handle(page, "Move Revenue")).toBeVisible()
    await expect(handle(page, "Resize Revenue")).toBeVisible()
    await expect(handle(page, "Hide Revenue")).toHaveCount(0)
    await page.keyboard.press("Delete")
    await expect(layer(page)).toBeVisible()
    expect(await slotOrder(page)).toEqual(base)
    expect(errors).toEqual([])
  })

  test("a part that isn't a slot has no handles", async ({ page, errors }) => {
    await load(page)
    await select(page, "All orders")

    await expect(
      layer(page).getByRole("button", { name: /^(Move|Resize|Hide) / })
    ).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test("the bar stays on screen", async ({ page, errors }) => {
      await load(page)
      await pickCustomize(pageMenu(page), "Adjust by hand")
      await outline(page, "Orders").tap()
      await expect(
        bar(page).getByRole("button", {
          name: /^Adjust.*Not fully implemented/,
        })
      ).toBeVisible()

      const box = await bar(page).boundingBox()
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? Infinity)).toBeLessThanOrEqual(390)
      expect(errors).toEqual([])
    })

    test("a single column has no resize handle, and a tap selects", async ({
      page,
      errors,
    }) => {
      await load(page)
      await pickCustomize(pageMenu(page), "Adjust by hand")
      await outline(page, "Orders").tap()

      await expect(outline(page, "Orders")).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      await expect(handle(page, "Move Orders")).toBeVisible()
      await expect(handle(page, "Resize Orders")).toHaveCount(0)
      await page.keyboard.press("Shift+ArrowRight")
      await expect(layer(page).getByRole("status")).toHaveText(
        "Orders selected."
      )
      expect(errors).toEqual([])
    })
  })
})

test.describe("the bar", () => {
  test("Ask opens the ask panel on the selection's part", async ({
    page,
    errors,
  }) => {
    await load(page)
    await select(page, "Overdue")

    await bar(page).getByRole("button", { name: "Ask" }).click()

    await expect(layer(page)).toBeHidden()
    const panel = page.getByRole("complementary", { name: "Ask" })
    await expect(panel.getByRole("combobox", { name: "Change" })).toHaveText(
      "Key metrics"
    )
    await expect(panel.getByRole("textbox", { name: "Ask" })).toBeFocused()
    expect(errors).toEqual([])
  })

  test("Adjust runs the part's own controls, or is marked unfinished", async ({
    page,
    errors,
  }) => {
    await load(page)
    await select(page, "Overdue")
    await expect(
      bar(page).getByRole("button", {
        name: "Adjust , Not fully implemented yet",
      })
    ).toBeDisabled()
    await page.keyboard.press("Escape")

    await select(page, "All orders")
    await bar(page, "All orders")
      .getByRole("button", { name: "Adjust" })
      .click()

    await expect(layer(page)).toBeHidden()
    await expect(
      page.getByRole("searchbox", { name: "Customer" })
    ).toBeFocused()
    expect(errors).toEqual([])
  })

  test("Tab skips the bar's disabled buttons", async ({ page, errors }) => {
    await load(page)
    await select(page, "Overdue")
    await expect(
      bar(page).getByRole("button", { name: "Reset Key metrics" })
    ).toBeDisabled()

    const ask = bar(page).getByRole("button", { name: "Ask" })
    for (let press = 0; press < 5; press++) {
      if (await ask.evaluate((element) => element === document.activeElement))
        break
      await page.keyboard.press("Tab")
    }
    await expect(ask).toBeFocused()
    await page.keyboard.press("Tab")

    await expect(outline(page, "All orders")).toBeFocused()
    await page.keyboard.press("Shift+Tab")
    await expect(ask).toBeFocused()
    expect(errors).toEqual([])
  })

  test("Reset is off until the part is changed", async ({ page, errors }) => {
    await load(page)
    await select(page, "Overdue")
    const reset = bar(page).getByRole("button", { name: "Reset" })
    await expect(reset).toBeDisabled()

    await page.keyboard.press("ArrowLeft")
    await expect(reset).toBeEnabled()
    await reset.click()
    await expect(reset).toBeDisabled()
    await expect(outline(page, "Overdue")).toBeFocused()
    expect(await slotOrder(page)).toEqual(base)
    expect(errors).toEqual([])
  })
})

test("the Customize button marks a preview while the ask panel is closed", async ({
  page,
  errors,
}) => {
  await load(page)
  await expect(pageMenu(page)).toHaveAccessibleDescription("")
  await pickCustomize(pageMenu(page), "Ask for a change…")
  const panel = page.getByRole("complementary", { name: "Ask" })
  const textbox = panel.getByRole("textbox", { name: "Ask" })
  await textbox.fill("put the overdue card first")
  await textbox.press("Enter")
  await expect(panel.getByRole("button", { name: "Lock in" })).toBeVisible()
  await expect(pageMenu(page)).toHaveAccessibleDescription("")

  await panel.getByRole("button", { name: "Close" }).click()

  await expect(pageMenu(page)).toHaveAccessibleDescription(
    "A preview is showing"
  )
  expect(errors).toEqual([])
})

test.describe("the browser's own menu", () => {
  test("shows on a field inside a part", async ({ page, errors }) => {
    await load(page)
    await page
      .getByRole("searchbox", { name: "Customer" })
      .click({ button: "right" })

    await expect(page.getByRole("menu")).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("shows on a link inside a part", async ({ page, errors }) => {
    await page.goto("/")
    await page
      .getByRole("navigation", { name: "Acme" })
      .getByRole("link")
      .first()
      .click({ button: "right" })

    await expect(page.getByRole("menu")).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
