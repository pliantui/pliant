import { expect, test } from "./fixtures"

test("a section that isn't finished says so", async ({ page }) => {
  await page.goto("/charts")

  await expect(
    page.getByRole("note").filter({ hasText: "Not fully implemented yet" })
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
