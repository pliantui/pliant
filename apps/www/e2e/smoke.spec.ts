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

const schemaIds = [
  "https://pliantui.dev/schema/manifest.json",
  "https://pliantui.dev/schema/op.json",
  "https://pliantui.dev/schema/overlay.json",
  "https://pliantui.dev/schema/saved-view.json",
  "https://pliantui.dev/schema/stored-overlay.json",
]

for (const id of schemaIds) {
  test(`serves the JSON Schema ${id} at its $id`, async ({ request }) => {
    const response = await request.get(new URL(id).pathname)
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")
    expect(await response.json()).toMatchObject({ $id: id })
  })
}
