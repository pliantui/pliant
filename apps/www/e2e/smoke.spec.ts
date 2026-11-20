import { expect, test } from "./fixtures"

test("renders the home page", async ({ page, errors }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { level: 1, name: "Pliant" })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Read the docs" })).toBeVisible()
  expect(errors).toEqual([])
})

test("renders a docs page", async ({ page, errors }) => {
  await page.goto("/docs")
  await expect(
    page.getByRole("heading", { level: 1, name: "Introduction" })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("serves the registry index", async ({ request }) => {
  const response = await request.get("/r/registry.json")
  expect(response.status()).toBe(200)
})

const conceptPages = [
  { path: "/docs/concepts", title: "Core concepts" },
  { path: "/docs/concepts/layers", title: "Layers" },
  { path: "/docs/concepts/operations", title: "Operations" },
  { path: "/docs/concepts/guardrails", title: "Guardrails" },
  { path: "/docs/concepts/expressions", title: "Expressions" },
]

for (const { path, title } of conceptPages) {
  test(`renders the ${title} page`, async ({ page, errors }) => {
    await page.goto(path)
    await expect(
      page.getByRole("heading", { level: 1, name: title })
    ).toBeVisible()
    expect(errors).toEqual([])
  })
}
