import { expect, test } from "./fixtures"

test("serves the favicon, app icons and web app manifest", async ({
  page,
  request,
}) => {
  await page.goto("/")
  const icons = page.locator('head link[rel="icon"]')
  await expect(icons).toHaveCount(3)
  const hrefs = await icons.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? "")
  )
  // Browsers and crawlers ask for it without a link.
  hrefs.push("/favicon.ico")
  hrefs.push(
    (await page
      .locator('head link[rel="apple-touch-icon"]')
      .getAttribute("href")) ?? ""
  )
  for (const href of hrefs) {
    const response = await request.get(href)
    expect(response.ok(), href).toBe(true)
    expect(response.headers()["content-type"], href).toMatch(/^image\//)
  }

  const manifestHref = await page
    .locator('head link[rel="manifest"]')
    .getAttribute("href")
  const manifest = await request.get(manifestHref ?? "")
  expect(manifest.ok()).toBe(true)
  const { name, icons: manifestIcons } = (await manifest.json()) as {
    name: string
    icons: { src: string; sizes: string }[]
  }
  expect(name).toBe("Pliant")
  expect(manifestIcons.map((icon) => icon.sizes)).toEqual([
    "192x192",
    "512x512",
  ])
  for (const icon of manifestIcons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true)
  }
})

test("shares the logo as the Open Graph image", async ({ page, request }) => {
  for (const path of ["/", "/docs"]) {
    await page.goto(path)
    const image = await page
      .locator('head meta[property="og:image"]')
      .getAttribute("content")
    expect(image, path).toBeTruthy()
    const response = await request.get(new URL(image ?? "").pathname)
    expect(response.ok(), path).toBe(true)
    expect(response.headers()["content-type"]).toBe("image/png")
  }
})

test("the navbar shows the logo with a wordmark in text", async ({ page }) => {
  await page.goto("/docs")
  const home = page.getByRole("banner").getByRole("link", { name: "pliant" })
  await expect(home).toBeVisible()
  await expect(home).toHaveText("pliant")
  await expect(home.locator("svg")).toBeVisible()
  await expect(home.locator("img")).toHaveCount(0)

  await home.click()
  await expect(page).toHaveURL("/")
})

test("the navbar's logo fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("banner").getByRole("link", { name: "pliant" })
  ).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})
