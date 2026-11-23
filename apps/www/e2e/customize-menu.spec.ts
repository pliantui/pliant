import type { Locator, Page } from "@playwright/test"

import { expect, pickCustomize, test } from "./fixtures"

const surface = "/examples/orders"

function metrics(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

function pageMenu(page: Page) {
  return page.getByRole("button", { name: "Customize the orders page" })
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: "Ask" })
}

async function load(page: Page) {
  await page.goto(surface)
  await expect(metrics(page)).not.toHaveAttribute("data-pliant-pending")
}

// The lucide icon each item shows, by its class. An icon has no role or
// accessible name, since the item's text names it, so its class is the only
// thing that tells one icon from another.
async function itemIcons(items: Locator) {
  return items.evaluateAll((elements) =>
    elements.map(
      (element) =>
        Array.from(element.querySelector("svg")?.classList ?? []).find(
          (name) => name.startsWith("lucide-") && name !== "lucide-icon"
        ) ?? null
    )
  )
}

const items = [
  "Ask for a change…",
  "Adjust by hand",
  "History",
  "Reset to default",
] as const

test("the Customize menu lists its four items in order, with their icons", async ({
  page,
  errors,
}) => {
  await load(page)
  await expect(pageMenu(page)).toHaveText("Customize")
  await expect(pageMenu(page).locator("svg")).toBeVisible()
  await pageMenu(page).click()

  const menu = page.getByRole("menu")
  const menuItems = menu.getByRole("menuitem")
  await expect(menuItems).toHaveCount(4)
  for (const [index, name] of items.entries()) {
    await expect(menuItems.nth(index)).toHaveAccessibleName(
      // History isn't in the demos yet, so its name ends with the
      // unfinished dot's text.
      name === "History" ? /^History ?, Not fully implemented yet$/ : name
    )
  }
  expect(await itemIcons(menuItems)).toEqual([
    "lucide-sparkles",
    "lucide-sliders-horizontal",
    // lucide-react names History by the icon it now draws.
    "lucide-rotate-ccw-clock",
    "lucide-rotate-ccw",
  ])
  // Ask and Adjust, then History and Reset.
  await expect(menu.getByRole("separator")).toHaveCount(1)
  const separator = await menu.getByRole("separator").boundingBox()
  const adjust = await menuItems.nth(1).boundingBox()
  const history = await menuItems.nth(2).boundingBox()
  expect(adjust && separator && adjust.y < separator.y).toBe(true)
  expect(history && separator && separator.y < history.y).toBe(true)
  // Nothing to reset yet.
  await expect(menuItems.nth(3)).toHaveAttribute("aria-disabled", "true")
  expect(errors).toEqual([])
})

test("Ask for a change… opens the ask panel on its prompt", async ({
  page,
  errors,
}) => {
  await load(page)
  await pickCustomize(pageMenu(page), "Ask for a change…")

  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(panel(page)).toBeHidden()
  await expect(pageMenu(page)).toBeFocused()
  expect(errors).toEqual([])
})

test("Reset to default puts the page back and focus on Customize", async ({
  page,
  errors,
}) => {
  await load(page)
  await pickCustomize(pageMenu(page), "Ask for a change…")
  const textbox = panel(page).getByRole("textbox", { name: "Ask" })
  await textbox.fill("put the overdue card first")
  await textbox.press("Enter")
  await panel(page).getByRole("button", { name: "Lock in" }).click()
  await expect(
    metrics(page).locator(":scope > [data-pliant-id]").first()
  ).toHaveAttribute("data-pliant-id", "overdue")
  await panel(page).getByRole("button", { name: "Close" }).click()
  const customized = page
    .locator("main header")
    .getByText("Customized", { exact: true })
  await expect(customized).toBeVisible()

  await pickCustomize(pageMenu(page), "Reset to default")

  await expect(
    metrics(page).locator(":scope > [data-pliant-id]").first()
  ).toHaveAttribute("data-pliant-id", "revenue")
  await expect(pageMenu(page)).toBeFocused()
  await expect(customized).toBeHidden()
  expect(errors).toEqual([])
})

test("right-clicking a part shows its Customize group", async ({
  page,
  errors,
}) => {
  await load(page)
  await page
    .getByRole("table", { name: "All orders" })
    .getByRole("row")
    .nth(1)
    .click({ button: "right" })

  const menu = page.getByRole("menu")
  await expect(menu.getByRole("group")).toContainText(/^Customize/)
  await expect(menu.getByRole("menuitem")).toHaveCount(4)
  await menu.getByRole("menuitem", { name: "Ask for a change…" }).click()

  await expect(
    panel(page).getByRole("combobox", { name: "Change" })
  ).toHaveText("All orders")
  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
  expect(errors).toEqual([])
})

test("⌘. asks about the part that has focus", async ({ page, errors }) => {
  await load(page)
  await page.getByRole("searchbox", { name: "Customer" }).focus()
  await page.keyboard.press("ControlOrMeta+Period")

  await expect(
    panel(page).getByRole("combobox", { name: "Change" })
  ).toHaveText("All orders")
  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
  // It's the page's demo shortcut, not the site's: point mode stays closed.
  await expect(page.locator('[data-slot="pliant-point-mode"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test("the command menu has a Customize group for the page", async ({
  page,
  errors,
}) => {
  await load(page)
  await page.keyboard.press("ControlOrMeta+k")
  const dialog = page.getByRole("dialog", { name: "Search documentation" })
  const group = dialog.getByRole("group", { name: "Customize" })
  await expect(group.getByRole("option")).toHaveText([
    "Ask for a change…",
    "Adjust by hand",
    /^History/,
    "Reset to default",
  ])

  await group.getByRole("option", { name: "Ask for a change…" }).click()
  await expect(dialog).toBeHidden()
  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
  expect(errors).toEqual([])
})

test("the command menu has no Customize group off a demo", async ({ page }) => {
  await page.goto("/docs")
  await page.keyboard.press("ControlOrMeta+k")
  const dialog = page.getByRole("dialog", { name: "Search documentation" })
  await expect(dialog.getByRole("group", { name: "Pages" })).toBeVisible()
  await expect(dialog.getByRole("group", { name: "Customize" })).toHaveCount(0)
})

for (const path of [
  "/",
  "/examples/orders",
  "/examples/tickets",
  "/examples/team-workspace/inbox",
  "/playground",
  "/charts",
  "/blocks",
  "/docs/components/data-table",
]) {
  test(`${path} names nothing Edit, and has no floating button`, async ({
    page,
  }) => {
    await page.goto(path)
    await expect(
      page.getByRole("button", { name: /^Customize/ }).first()
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /\bedit\b/i })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /\bedit\b/i })).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /^(Reset|Point)$/ })
    ).toHaveCount(0)
    const floating = await page
      .locator("main button")
      .evaluateAll(
        (buttons) =>
          buttons.filter(
            (button) =>
              getComputedStyle(button).position === "fixed" &&
              button.getBoundingClientRect().width > 0
          ).length
      )
    expect(floating).toBe(0)
  })
}
