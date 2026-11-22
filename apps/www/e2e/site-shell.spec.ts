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
      await expect(
        page.getByRole("banner").getByRole("link", { name: "Skip to content" })
      ).toBeFocused()

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
      expect.arrayContaining([
        "/",
        "/docs",
        "/docs/components",
        "/blocks",
        "/charts",
        "/examples/orders",
        "/playground",
        "/directory",
        "/templates",
        repository,
      ])
    )
    for (const href of hrefs.filter((href) => href.startsWith("/"))) {
      expect((await request.get(href)).status(), href).toBe(200)
    }
    expect(errors).toEqual([])
  })

  test("the main nav takes you between home, docs and the examples", async ({
    page,
  }) => {
    await page.goto("/")
    const nav = page.getByRole("navigation", { name: "Main" })
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Menu" })
    ).toBeHidden()

    await nav.getByRole("link", { name: "Docs" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" })
    ).toBeVisible()
    await expect(nav.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    await nav.getByRole("link", { name: "Examples" }).click()
    await expect(page).toHaveURL("/examples/orders")
    await expect(
      page.getByRole("heading", { level: 2, name: "Orders", exact: true })
    ).toBeVisible()
    await expect(nav.getByRole("link", { name: "Examples" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    await nav.getByRole("link", { name: "Home" }).click()
    await expect(page).toHaveURL("/")
  })

  test("the main nav reaches every section of the site", async ({ page }) => {
    await page.goto("/")
    const nav = page.getByRole("navigation", { name: "Main" })

    for (const name of [
      "Components",
      "Blocks",
      "Charts",
      "Playground",
      "Directory",
      "Templates",
    ]) {
      await nav.getByRole("link", { name }).click()
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
      await expect(nav.getByRole("link", { name })).toHaveAttribute(
        "aria-current",
        "page"
      )
    }
  })

  test("the get started button leads to the docs", async ({ page }) => {
    await page.goto("/examples/tickets")
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Get started" })
      .click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" })
    ).toBeVisible()
  })

  test("the theme toggle switches between light and dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/docs")
    const html = page.locator("html")
    await expect(html).toHaveCSS("color-scheme", "light")

    const toggle = page
      .getByRole("banner")
      .getByRole("button", { name: "Toggle theme" })
    await toggle.click()
    await expect(html).toHaveCSS("color-scheme", "dark")

    await page.reload()
    await expect(html).toHaveCSS("color-scheme", "dark")

    await toggle.click()
    await expect(html).toHaveCSS("color-scheme", "light")
  })

  test("the header search opens from its button and the keyboard", async ({
    page,
  }) => {
    await page.goto("/docs")
    const dialog = page.getByRole("dialog", { name: /^Search/ })

    await page
      .getByRole("banner")
      .getByRole("button", { name: /^Search/ })
      .click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()

    await page.keyboard.press("ControlOrMeta+k")
    await expect(dialog).toBeVisible()
  })

  test("the docs sidebar lists every docs page and marks the current one", async ({
    page,
  }) => {
    await page.goto("/docs/concepts/layers")
    const sidebar = page.getByRole("navigation", { name: "Docs" })

    for (const name of [
      "Introduction",
      "CLI",
      "Surfaces, nodes and addresses",
      "Overlays and layers",
      "Operations",
      "Guardrails",
      "Expressions and functions",
    ]) {
      await expect(
        sidebar.getByRole("link", { name, exact: true })
      ).toBeVisible()
    }
    await expect(
      sidebar.getByRole("link", { name: "Overlays and layers" })
    ).toHaveAttribute("aria-current", "page")

    await sidebar.getByRole("link", { name: "Guardrails", exact: true }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Guardrails" })
    ).toBeVisible()
  })

  test("a docs page lists its sections and links to the pages around it", async ({
    page,
  }) => {
    await page.goto("/docs/concepts/layers")
    const toc = page.getByRole("navigation", { name: "On This Page" })
    const firstSection = toc.getByRole("link").first()
    const target = await firstSection.getAttribute("href")

    await firstSection.click()
    await expect(page).toHaveURL(new RegExp(`${target ?? ""}$`))

    await page.getByRole("link", { name: "Next page" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Operations" })
    ).toBeVisible()
    await page.getByRole("link", { name: "Previous page" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Overlays and layers" })
    ).toBeVisible()
  })

  test("copy page copies the page's source", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto("/docs/concepts/layers")
    await page.getByRole("button", { name: "Copy Page" }).click()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain("title: Overlays and layers")
  })

  test("a code block copies its code", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto("/docs/concepts/expressions")
    const block = page
      .getByRole("figure")
      .filter({ hasText: '"fn": "gt"' })
      .first()
    await block.getByRole("button", { name: "Copy" }).click()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('"fn": "gt"')
    await expect(
      page.getByRole("status").filter({ hasText: "Copied" })
    ).toHaveCount(1)
  })

  test("the examples nav moves between the examples", async ({ page }) => {
    await page.goto("/examples/orders")
    const nav = page.getByRole("navigation", { name: "Examples" })
    await expect(nav.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    await nav.getByRole("link", { name: "Tickets" }).click()
    await expect(page).toHaveURL("/examples/tickets")
    await expect(
      page.getByRole("heading", { level: 2, name: "New ticket" })
    ).toBeVisible()
    await expect(nav.getByRole("link", { name: "Tickets" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  test("the footer links lead to pages that exist", async ({
    page,
    request,
  }) => {
    await page.goto("/")
    const footer = page.getByRole("contentinfo")
    const links = await footer
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => [link.textContent, link.getAttribute("href")])
      )

    expect(links).toEqual([
      ["Docs", "/docs"],
      ["Components", "/docs/components"],
      ["Examples", "/examples/orders"],
      ["Roadmap", "/roadmap"],
      ["Changelog", "/changelog"],
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

  test("the footer credits shadcn/ui and links its license", async ({
    page,
  }) => {
    await page.goto("/")
    const footer = page.getByRole("contentinfo")

    await expect(
      footer.getByRole("link", { name: "shadcn/ui" })
    ).toHaveAttribute("href", "https://ui.shadcn.com")
    await expect(
      footer.getByRole("link", { name: "MIT license" })
    ).toHaveAttribute(
      "href",
      `${repository}/blob/main/apps/www/LICENSE-shadcn.md`
    )
  })

  test("the home buttons lead to the docs and the components", async ({
    page,
  }) => {
    await page.goto("/")
    const main = page.getByRole("main")

    await main.getByRole("link", { name: "View components" }).click()
    await expect(page).toHaveURL("/docs/components")
    await page.goto("/")
    await main.getByRole("link", { name: "Get started" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" })
    ).toBeVisible()
  })
})

test.describe("on a tablet", () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test("the header fits, with the menu in place of the main nav", async ({
    page,
  }) => {
    await page.goto("/docs")
    const header = page.getByRole("banner")
    await expect(header.getByRole("button", { name: "Menu" })).toBeVisible()
    await expect(
      header.getByRole("link", { name: "Get started" })
    ).toBeInViewport({ ratio: 1 })
    expect(await hasHorizontalScroll(page)).toBe(false)
  })
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const path of [
    "/",
    "/docs",
    "/docs/concepts/layers",
    "/examples/orders",
    "/examples/tickets",
  ]) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path)
      await expect(
        page.getByRole("banner").getByRole("button", { name: "Menu" })
      ).toBeVisible()
      expect(await hasHorizontalScroll(page)).toBe(false)
    })
  }

  test("the menu has the main nav and every docs page", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden()
    await page.getByRole("button", { name: "Menu" }).click()

    const menu = page.getByRole("dialog", { name: "Menu" })
    for (const name of [
      "Home",
      "Docs",
      "Examples",
      "Introduction",
      "CLI",
      "Surfaces, nodes and addresses",
      "Overlays and layers",
      "Expressions and functions",
    ]) {
      await expect(menu.getByRole("link", { name, exact: true })).toBeVisible()
    }

    await menu.getByRole("link", { name: "Guardrails", exact: true }).click()
    await expect(page).toHaveURL("/docs/concepts/guardrails")
    await expect(menu).toBeHidden()
  })

  test("the menu button shows where keyboard focus is", async ({ page }) => {
    await page.goto("/docs")
    const menu = page.getByRole("banner").getByRole("button", { name: "Menu" })
    const unfocused = await menu.evaluate(
      (button) => getComputedStyle(button).boxShadow
    )

    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    await expect(menu).toBeFocused()
    expect(
      await menu.evaluate((button) => getComputedStyle(button).boxShadow)
    ).not.toBe(unfocused)
  })

  test("the header keeps the GitHub link and the theme toggle", async ({
    page,
  }) => {
    await page.goto("/docs")
    const header = page.getByRole("banner")

    await expect(header.getByRole("link", { name: /^GitHub/ })).toHaveAttribute(
      "href",
      repository
    )
    await expect(
      header.getByRole("button", { name: "Toggle theme" })
    ).toBeVisible()
  })

  test("the examples nav stays reachable", async ({ page }) => {
    await page.goto("/examples/orders")
    await page
      .getByRole("navigation", { name: "Examples" })
      .getByRole("link", { name: "Tickets" })
      .click()
    await expect(page).toHaveURL("/examples/tickets")
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

  test("opens search from the keyboard", async ({ page }) => {
    await page.goto("/no-such-page")
    await page.keyboard.press("ControlOrMeta+k")
    await expect(page.getByRole("dialog", { name: /^Search/ })).toBeVisible()
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
