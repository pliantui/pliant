import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const repository = "https://github.com/pliantui/pliant"

async function hasHorizontalScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
}

test.describe("the skip link", () => {
  for (const path of [
    "/",
    "/docs",
    "/docs/concepts/layers",
    "/examples/orders",
    "/no-such-page",
  ]) {
    test(`on ${path} is the first stop and leads to the content`, async ({
      page,
    }) => {
      await page.goto(path)
      await page.keyboard.press("Tab")

      const skipLink = page.getByRole("link", {
        name: "Skip to content",
        exact: true,
      })
      await expect(skipLink).toBeFocused()
      await expect(skipLink).toBeVisible()
      expect(
        await skipLink.evaluate((link) => link.closest("header") !== null)
      ).toBe(true)

      await page.keyboard.press("Enter")
      await expect
        .poll(() =>
          page.evaluate(() => Boolean(document.activeElement?.closest("main")))
        )
        .toBe(true)
    })
  }

  test("stays out of sight until it has focus", async ({ page }) => {
    await page.goto("/")
    const skipLink = page.getByRole("link", {
      name: "Skip to content",
      exact: true,
    })
    const box = await skipLink.boundingBox()

    expect(box === null || box.width <= 1).toBe(true)
  })
})

test.describe("on a wide screen", () => {
  test("the header links lead to pages that exist", async ({
    page,
    request,
    errors,
  }) => {
    await page.goto("/")
    const header = page.getByRole("banner")
    const hrefs = await header
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href") ?? "")
      )

    expect(hrefs).toEqual(
      expect.arrayContaining(["/", "/docs", "/examples/orders", repository])
    )
    for (const href of hrefs.filter((href) => href.startsWith("/"))) {
      expect((await request.get(href)).status(), href).toBe(200)
    }
    expect(errors).toEqual([])
  })

  test("the header takes you between home, docs and the example", async ({
    page,
  }) => {
    await page.goto("/")
    const header = page.getByRole("banner")
    await expect(header.getByRole("button", { name: "Open menu" })).toBeHidden()

    await header.getByRole("link", { name: "Docs" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" })
    ).toBeVisible()
    await expect(header.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    await header.getByRole("link", { name: "Examples" }).click()
    await expect(page).toHaveURL("/examples/orders")
    await expect(
      page.getByRole("heading", { level: 1, name: "Orders" })
    ).toBeVisible()

    await header.getByRole("link", { name: "Pliant" }).click()
    await expect(page).toHaveURL("/")
  })

  test("the header on a docs page opens search", async ({ page }) => {
    await page.goto("/docs")
    await page
      .getByRole("banner")
      .getByRole("button", { name: /^Search/ })
      .click()
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible()
  })

  test("the footer links lead to pages that exist", async ({
    page,
    request,
  }) => {
    await page.goto("/")
    const footer = page.getByRole("contentinfo")
    const links = await footer
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => [link.textContent, link.getAttribute("href")])
      )

    expect(links).toEqual([
      ["Docs", "/docs"],
      ["Examples", "/examples/orders"],
      ["GitHub", repository],
      ["License", `${repository}/blob/main/LICENSE.md`],
      ["Code of conduct", `${repository}/blob/main/CODE_OF_CONDUCT.md`],
      ["Security policy", `${repository}/blob/main/SECURITY.md`],
    ])
    for (const [, href] of links) {
      if (href?.startsWith("/")) {
        expect((await request.get(href)).status(), href).toBe(200)
      }
    }
  })

  test("the home buttons lead to the docs and the repository", async ({
    page,
  }) => {
    await page.goto("/")
    const hero = page.getByRole("main").locator("section").first()

    await expect(hero.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      repository
    )
    await hero.getByRole("link", { name: "Get started" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" })
    ).toBeVisible()
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const path of ["/", "/docs", "/docs/concepts/layers"]) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path)
      await expect(
        page.getByRole("banner").getByRole("button", { name: "Open menu" })
      ).toBeVisible()
      expect(await hasHorizontalScroll(page)).toBe(false)
    })
  }

  test("the menu has the same links as the header", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Docs" })
    ).toBeHidden()
    await page.getByRole("button", { name: "Open menu" }).click()

    const menu = page.getByRole("dialog", { name: "Pliant" })
    await expect(menu.getByRole("link", { name: "Docs" })).toBeVisible()
    await expect(menu.getByRole("link", { name: "Examples" })).toBeVisible()
    await expect(menu.getByRole("link", { name: /^GitHub/ })).toHaveAttribute(
      "href",
      repository
    )

    await menu.getByRole("link", { name: "Examples" }).click()
    await expect(page).toHaveURL("/examples/orders")
    await expect(menu).toBeHidden()
  })

  test("search stays reachable", async ({ page }) => {
    await page.goto("/")
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Open Search" })
      .click()
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible()
  })

  test("the docs menu is reachable under the header", async ({ page }) => {
    await page.goto("/docs")
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Open menu" })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Concepts" })).toBeHidden()
    await page.locator("#nd-subnav").getByRole("button").last().click()
    await expect(page.getByRole("button", { name: "Concepts" })).toBeVisible()
  })
})

test.describe("the 404 page", () => {
  test("answers with status 404 and a way back", async ({ page }) => {
    const response = await page.goto("/no-such-page")

    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible()
    const main = page.getByRole("main")
    await expect(main.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/docs"
    )
    await expect(main.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    )
    await expect(page.getByRole("banner")).toBeVisible()
  })

  test("answers with status 404 for a missing docs page", async ({ page }) => {
    const response = await page.goto("/docs/no-such-page")

    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible()
  })

  test("opens search", async ({ page }) => {
    await page.goto("/no-such-page")
    await page
      .getByRole("main")
      .getByRole("button", { name: "Search the docs" })
      .click()
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible()
  })

  test("has no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto("/no-such-page")
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible()
    expect(await hasHorizontalScroll(page)).toBe(false)
  })
})
