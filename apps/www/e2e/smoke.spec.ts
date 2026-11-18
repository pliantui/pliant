import { test as base, expect } from "@playwright/test"

const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))
    await provide(errors)
  },
})

test("renders the home page", async ({ page, errors }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("heading", { level: 1, name: "Pliant" })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Read the docs" })).toBeVisible()
  expect(errors).toEqual([])
})

test("renders a docs page", async ({ page, errors }) => {
  await page.goto("/docs")
  await page.waitForLoadState("networkidle")
  await expect(
    page.getByRole("heading", { level: 1, name: "Introduction" })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("serves the registry index", async ({ request }) => {
  const response = await request.get("/r/registry.json")
  expect(response.status()).toBe(200)
})
