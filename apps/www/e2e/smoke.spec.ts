import { expect, test } from "./fixtures"

test("renders the home page", async ({ page, errors }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Build pliant interfaces: apps your users can reshape.",
    })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible()
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
