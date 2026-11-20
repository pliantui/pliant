import { expect, test } from "./fixtures"

test("finds a docs page from the search dialog", async ({ page, errors }) => {
  await page.goto("/docs")
  await page.getByRole("button", { name: /^Search/ }).click()
  const dialog = page.getByRole("dialog", { name: "Search" })
  await dialog
    .getByRole("combobox", { name: "Search" })
    .fill("early development")

  await expect(
    dialog.getByRole("option", { name: "Docs Introduction" })
  ).toBeVisible()
  await expect(
    dialog.getByRole("option", { name: "Pliant is in early development." })
  ).toBeVisible()
  expect(errors).toEqual([])
})
