import { expect, test } from "@playwright/test"

test.describe("smoke", () => {
  const errors: string[] = []

  test.beforeEach(({ page }) => {
    errors.length = 0
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  test("renders the home page", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("heading", { level: 1, name: "Pliant" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Read the docs" })
    ).toBeVisible()
  })

  test("renders a docs page", async ({ page }) => {
    await page.goto("/docs")
    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" })
    ).toBeVisible()
  })
})
