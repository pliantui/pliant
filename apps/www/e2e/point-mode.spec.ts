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
  const box = await keyMetricsBox(page).boundingBox()
  const metrics = await region(page).boundingBox()
  expect(box).toEqual(metrics)

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
  expect(await buttons(page)).toEqual(["Key metrics"])
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
    expect(await keyMetricsBox(page).boundingBox()).toEqual(
      await region(page).boundingBox()
    )

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
