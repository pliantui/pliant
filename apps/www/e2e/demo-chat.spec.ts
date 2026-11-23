import type { Locator, Page } from "@playwright/test"

import { expect, pickCustomize, test } from "./fixtures"

function chat(page: Page) {
  return page.getByRole("complementary", { name: "Ask" })
}

function prompt(page: Page) {
  return chat(page).getByRole("textbox", { name: "Ask" })
}

async function expectChatOpen(page: Page, part: string | RegExp) {
  await expect(prompt(page)).toBeFocused()
  await expect(chat(page).getByRole("combobox", { name: "Change" })).toHaveText(
    part
  )
  await expect(
    chat(page).getByRole("group", { name: "Suggestions" }).getByRole("button")
  ).not.toHaveCount(0)
}

async function send(page: Page, text: string) {
  await prompt(page).fill(text)
  await prompt(page).press("Enter")
}

function tableMenu(page: Page): Locator {
  return page.getByRole("button", { name: "Customize orders table" })
}

test.describe("Ask for a change… opens the chat", () => {
  test("on the homepage", async ({ page, errors }) => {
    await page.goto("/")
    await pickCustomize(
      page.getByRole("button", { name: "Customize the dashboard" }),
      "Ask for a change…"
    )

    await expectChatOpen(page, "Sidebar")
    expect(errors).toEqual([])
  })

  test("on a block", async ({ page, errors }) => {
    await page.goto("/blocks")
    const block = page.getByRole("region", { name: /^A list of recent orders/ })
    await pickCustomize(
      block.getByRole("button", { name: /^Customize / }),
      "Ask for a change…"
    )

    await expectChatOpen(page, /orders/i)
    expect(errors).toEqual([])
  })

  test("on a component preview", async ({ page, errors }) => {
    await page.goto("/docs/components/data-table")
    await pickCustomize(tableMenu(page), "Ask for a change…")

    await expectChatOpen(page, "Orders table")
    expect(errors).toEqual([])
  })

  test("on the charts page", async ({ page, errors }) => {
    await page.goto("/charts")
    const card = page.getByRole("region", {
      name: "Revenue by region",
      exact: true,
    })
    await pickCustomize(
      card.getByRole("button", { name: /^Customize / }),
      "Ask for a change…"
    )

    await expectChatOpen(page, /./)
    expect(errors).toEqual([])
  })

  test("in the playground", async ({ page, errors }) => {
    await page.goto("/playground")
    await pickCustomize(
      page.getByRole("button", { name: /^Customize / }),
      "Ask for a change…"
    )

    await expectChatOpen(page, /./)
    expect(errors).toEqual([])
  })
})

test("a scripted ask answers in the chat, and Lock in applies it", async ({
  page,
  errors,
}) => {
  await page.goto("/docs/components/data-table")
  await pickCustomize(tableMenu(page), "Ask for a change…")
  await send(page, "add a column for days since each order was placed")

  const log = chat(page).getByRole("log")
  await expect(log.getByText("Scripted answer")).toBeVisible()
  await expect(log.getByText("Added a Days since order column.")).toBeVisible()
  await chat(page).getByRole("button", { name: "Lock in" }).click()

  await expect(log.getByText("Locked in.")).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: /Days since order/ })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("an ask that matches no suggestion gets an honest reply", async ({
  page,
  errors,
}) => {
  await page.goto("/docs/components/data-table")
  await pickCustomize(tableMenu(page), "Ask for a change…")
  await send(page, "make every row green")

  await expect(
    chat(page)
      .getByRole("log")
      .getByText("This demo answers only its suggested asks.")
  ).toBeVisible()
  await expect(chat(page).getByRole("button", { name: "Lock in" })).toHaveCount(
    0
  )
  expect(errors).toEqual([])
})

for (const width of [1440, 1585]) {
  test.describe(`at ${String(width)}px wide`, () => {
    test.use({ viewport: { width, height: 900 } })

    test("the chat is a sidebar at the window's right edge", async ({
      page,
      errors,
    }) => {
      await page.goto("/")
      await pickCustomize(
        page.getByRole("button", { name: "Customize the dashboard" }),
        "Ask for a change…"
      )
      await expect(prompt(page)).toBeFocused()

      const box = await chat(page).boundingBox()
      expect(box?.x).toBeGreaterThan(width / 2)
      expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBe(width)
      expect(box?.y).toBe(0)
      expect(Math.round(box?.height ?? 0)).toBe(900)
      // The page makes room for it, so it covers none of the dashboard.
      const dashboard = await page
        .getByRole("button", { name: "Customize the dashboard" })
        .boundingBox()
      expect((dashboard?.x ?? width) + (dashboard?.width ?? 0)).toBeLessThan(
        box?.x ?? 0
      )
      await expect(
        chat(page)
          .getByRole("group", { name: "Suggestions" })
          .getByRole("button", { name: "open Analytics when I log in" })
      ).toBeVisible()
      expect(errors).toEqual([])
    })
  })
}
