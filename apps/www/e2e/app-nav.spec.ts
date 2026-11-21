import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "app-shell"
const titles = ["Inbox", "Tickets", "Customers", "Reports", "Settings"]

async function seed(page: Page, ops: unknown[]) {
  await page.addInitScript(
    ({ key, record }) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(record))
      }
    },
    {
      key: `pliant:${surface}:01KAB0000000000000000000P1`,
      record: {
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
        etag: "1",
        version: 1,
        updatedAt: "2026-11-19T00:00:00.000Z",
      },
    }
  )
}

function sidebarNav(page: Page) {
  return page.getByRole("navigation", { name: "Support desk" })
}

async function load(page: Page, path = "/examples/app/inbox") {
  await page.goto(path)
  await expect(
    page.locator('[data-pliant-id="app-sidebar"]')
  ).not.toHaveAttribute("data-pliant-pending")
}

// The links the user sees in the sidebar, top to bottom.
async function shownLinks(page: Page) {
  const shown: { title: string; y: number }[] = []
  for (const title of titles) {
    const link = sidebarNav(page).getByRole("link", { name: title })
    if (await link.isVisible()) {
      const box = await link.boundingBox()
      shown.push({ title, y: box?.y ?? 0 })
    }
  }
  return shown.sort((a, b) => a.y - b.y).map(({ title }) => title)
}

test("renders the links in their base order, marking the current page", async ({
  page,
  errors,
}) => {
  await load(page, "/examples/app/tickets")
  expect(await shownLinks(page)).toEqual(titles)
  await expect(
    sidebarNav(page).getByRole("link", { name: "Tickets" })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    sidebarNav(page).getByRole("link", { name: "Inbox" })
  ).not.toHaveAttribute("aria-current")
  await expect(
    page.getByRole("heading", { level: 1, name: "Tickets" })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("shows the links in the user's order without hidden ones, and tabs in that order", async ({
  page,
}) => {
  await seed(page, [
    {
      op: "move",
      target: "app-sidebar/items/reports",
      to: { before: "inbox" },
    },
    { op: "hide", target: "app-sidebar/items/customers" },
  ])
  await load(page)
  expect(await shownLinks(page)).toEqual([
    "Reports",
    "Inbox",
    "Tickets",
    "Settings",
  ])
  await expect(
    sidebarNav(page).getByRole("link", { name: "Customers" })
  ).toBeHidden()

  await sidebarNav(page).getByRole("link", { name: "Reports" }).focus()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(
    sidebarNav(page).getByRole("link", { name: "Inbox" })
  ).toBeFocused()
})

test("collapses links behind More", async ({ page }) => {
  await seed(page, [
    {
      op: "collapse",
      target: "app-sidebar",
      items: ["reports", "settings"],
      into: "more",
    },
  ])
  await load(page)
  const more = sidebarNav(page).getByRole("button", { name: "More" })
  await expect(more).toHaveAttribute("aria-expanded", "false")
  expect(await shownLinks(page)).toEqual(["Inbox", "Tickets", "Customers"])
  await more.click()
  await expect(more).toHaveAttribute("aria-expanded", "true")
  expect(await shownLinks(page)).toEqual(titles)
})

test.describe("the start page", () => {
  test("is the inbox until the user picks one", async ({ page }) => {
    await page.goto("/examples/app")
    await expect(page).toHaveURL("/examples/app/inbox")
  })

  test("is the one the user picked", async ({ page }) => {
    await seed(page, [
      { op: "setLanding", target: "app-sidebar/items/reports" },
    ])
    await page.goto("/examples/app")
    await expect(page).toHaveURL("/examples/app/reports")
  })

  test("falls back to the inbox when the picked link is hidden", async ({
    page,
  }) => {
    await seed(page, [
      { op: "setLanding", target: "app-sidebar/items/reports" },
      { op: "hide", target: "app-sidebar/items/reports" },
    ])
    await page.goto("/examples/app")
    await expect(page).toHaveURL("/examples/app/inbox")
  })

  test("is the inbox when the layers fail to load", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("unrelated", "1")
      Storage.prototype.key = () => {
        throw new Error("Storage is blocked")
      }
    })
    await page.goto("/examples/app")
    await expect(page).toHaveURL("/examples/app/inbox")
  })

  test("is picked from a link's options and kept", async ({ page }) => {
    await load(page)
    const options = sidebarNav(page).getByRole("button", {
      name: "Customers options",
    })
    await options.focus()
    await page.keyboard.press("Enter")
    const startPage = page.getByRole("menuitemcheckbox", { name: "Start page" })
    await expect(startPage).toHaveAttribute("aria-checked", "false")
    await startPage.click()
    await expect(startPage).toBeHidden()
    await expect(options).toBeFocused()

    await page.goto("/examples/app")
    await expect(page).toHaveURL("/examples/app/customers")
  })
})

test("keeps the sidebar closed after the user closes it", async ({ page }) => {
  await load(page)
  const inbox = sidebarNav(page).getByRole("link", { name: "Inbox" })
  const open = await inbox.boundingBox()
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click()
  // Collapsed to icons, the links keep only their icon's width.
  await expect
    .poll(async () => (await inbox.boundingBox())?.width ?? 0)
    .toBeLessThan((open?.width ?? 0) / 2)

  await page.reload()
  await expect(
    page.locator('[data-pliant-id="app-sidebar"]')
  ).not.toHaveAttribute("data-pliant-pending")
  await expect
    .poll(async () => (await inbox.boundingBox())?.width ?? 0)
    .toBeLessThan((open?.width ?? 0) / 2)

  await page.keyboard.press("ControlOrMeta+b")
  await expect
    .poll(async () => (await inbox.boundingBox())?.width ?? 0)
    .toBeGreaterThan((open?.width ?? 0) / 2)
})
