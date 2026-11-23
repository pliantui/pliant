import { expect, test } from "./fixtures"

test("finds a docs page from the search dialog", async ({ page, errors }) => {
  await page.goto("/docs/cli")
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^Search/ })
    .click()
  const dialog = page.getByRole("dialog", { name: /^Search/ })
  await dialog
    .getByRole("combobox", { name: "Search documentation" })
    .fill("before you added Pliant")

  const result = dialog.getByRole("option", {
    name: /^The page looks the same as it did before you added Pliant\./,
  })
  await expect(result).toBeVisible()
  await result.click()

  await expect(page).toHaveURL(/\/docs(#.*)?$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Introduction" })
  ).toBeVisible()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test("jumps to a docs page by its title", async ({ page }) => {
  await page.goto("/")
  await page.keyboard.press("ControlOrMeta+k")
  const dialog = page.getByRole("dialog", { name: /^Search/ })
  await dialog
    .getByRole("combobox", { name: "Search documentation" })
    .fill("Guardrails")
  await dialog.getByRole("option", { name: "Guardrails" }).first().click()

  await expect(
    page.getByRole("heading", { level: 1, name: "Guardrails" })
  ).toBeVisible()
})
