import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

async function seed(page: Page, ops: unknown[]) {
  await page.addInitScript(
    ({ key, overlay }) => {
      localStorage.setItem(key, JSON.stringify({ v: 1, personal: [overlay] }))
    },
    {
      key: `pliant:${surface}`,
      overlay: {
        v: 1,
        id: "01KAB0000000000000000000P1",
        surface,
        layer: "personal",
        ops,
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "manual",
        createdBy: "local",
        createdAt: "2026-11-19T00:00:00.000Z",
      },
    }
  )
}

function region(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

async function slotOrder(page: Page) {
  return region(page)
    .locator(":scope > [data-pliant-id]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-pliant-id"))
    )
}

test("renders the key metrics in their base order", async ({
  page,
  errors,
}) => {
  await page.goto(surface)

  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual([
    "revenue",
    "orders",
    "average-order-value",
    "overdue",
  ])
  expect(errors).toEqual([])
})

test("reorders the key metrics in DOM, visual and tab order", async ({
  page,
  errors,
}) => {
  await seed(page, [
    { op: "move", target: "key-metrics/slots/overdue", to: { index: 0 } },
  ])
  await page.goto(surface)

  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  const expected = ["Overdue", "Revenue", "Orders", "Average order value"]
  expect(await slotOrder(page)).toEqual([
    "overdue",
    "revenue",
    "orders",
    "average-order-value",
  ])

  const cards = region(page).getByRole("group")
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y } = element.getBoundingClientRect()
      return { label: element.getAttribute("aria-labelledby"), x, y }
    })
  )
  const visual = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)
  expect(visual.map((box) => box.label)).toEqual(boxes.map((box) => box.label))

  await cards.evaluateAll((elements) => {
    for (const element of elements) {
      element.setAttribute("tabindex", "0")
    }
  })
  await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
    heading.setAttribute("tabindex", "-1")
    heading.focus()
  })
  for (const label of expected) {
    await page.keyboard.press("Tab")
    expect(
      await page.evaluate(() => {
        const id = document.activeElement?.getAttribute("aria-labelledby")
        return id ? document.getElementById(id)?.textContent : undefined
      })
    ).toBe(label)
  }
  expect(errors).toEqual([])
})

test("hides a key metric", async ({ page, errors }) => {
  await seed(page, [{ op: "hide", target: "key-metrics/slots/overdue" }])
  await page.goto(surface)

  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  await expect(page.getByRole("group", { name: "Overdue" })).toBeHidden()
  await expect(page.getByRole("group", { name: "Revenue" })).toBeVisible()
  expect(errors).toEqual([])
})
