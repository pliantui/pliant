import { expect, test } from "./fixtures"

test("lists the posts and opens one", async ({ page, errors }) => {
  await page.goto("/blog")
  await expect(
    page.getByRole("heading", { level: 1, name: "Blog" })
  ).toBeVisible()

  const post = page.getByRole("link", { name: /^Introducing Pliant/ })
  await expect(post).toContainText("Not fully implemented yet")
  await post.click()
  await expect(page).toHaveURL("/blog/introducing-pliant")
  await expect(
    page.getByRole("heading", { level: 1, name: "Introducing Pliant" })
  ).toBeVisible()
  await expect(page.locator("time")).toHaveText("November 23, 2026")
  expect(errors).toEqual([])
})

test("stays out of the main nav", async ({ page }) => {
  await page.goto("/")

  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Blog" })
  ).toHaveCount(0)
})

test("answers 404 for a missing post", async ({ page }) => {
  const response = await page.goto("/blog/no-such-post")
  expect(response?.status()).toBe(404)
})
