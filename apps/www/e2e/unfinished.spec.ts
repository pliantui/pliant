import { expect, test } from "./fixtures"

test("a docs page for something that isn't built says so", async ({ page }) => {
  await page.goto("/docs/components/chart")

  await expect(
    page
      .getByRole("main")
      .getByRole("note")
      .filter({ hasText: "Not fully implemented yet" })
  ).toBeVisible()
})

test("a section that hasn't started says it's coming soon", async ({
  page,
}) => {
  await page.goto("/templates")

  await expect(
    page.getByRole("heading", { level: 1, name: "Templates" })
  ).toBeVisible()
  await expect(page.getByText("Coming soon")).toBeVisible()
})

test("the docs sidebar marks a page for something that isn't built with a dot", async ({
  page,
}) => {
  await page.goto("/docs/components")
  const sidebar = page.getByRole("navigation", { name: "Docs" })

  const chart = sidebar.getByRole("link", {
    name: /^Chart ?, Not fully implemented yet$/,
  })
  await expect(chart.getByTitle("Not fully implemented yet")).toBeVisible()
  await expect(
    sidebar.getByRole("link", { name: "Overlays and layers", exact: true })
  ).toBeVisible()
})

test("the tour link leads to a page that says the tour is coming", async ({
  page,
}) => {
  await page.goto("/")
  await page
    .getByRole("main")
    .getByRole("link", { name: "Watch the 60-second tour" })
    .click()

  await expect(
    page.getByRole("heading", { level: 1, name: "Product tour" })
  ).toBeVisible()
  await expect(page.getByText("Coming soon")).toBeVisible()
})

const strip = "This page contains unfinished components and work."

for (const path of [
  "/",
  "/charts",
  "/examples/orders",
  "/docs/components/chart",
]) {
  test(`${path} shows the unfinished strip above the header`, async ({
    page,
  }) => {
    await page.goto(path)
    const note = page.getByRole("note").filter({ hasText: strip })

    await expect(note).toBeVisible()
    const top = await note.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return { y: box.top + window.scrollY, width: box.width }
    })
    const header = await page
      .getByRole("banner")
      .evaluate(
        (element) => element.getBoundingClientRect().top + window.scrollY
      )
    expect(top).toEqual({ y: 0, width: page.viewportSize()?.width })
    expect(header).toBeGreaterThan(0)
  })
}

for (const path of ["/docs/installation", "/docs/concepts/layers"]) {
  test(`${path} has nothing unfinished and no strip`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    await expect(page.getByText(strip)).toHaveCount(0)
  })
}
