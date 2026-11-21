import { expect, test } from "./fixtures"

test("shows install commands for the reader's package manager", async ({
  page,
  context,
  errors,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/docs/cli")
  const managers = page.getByRole("tablist", { name: "Package manager" })
  const first = managers.first()

  await expect(first.getByRole("tab", { name: "pnpm" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(page.getByText("pnpm dlx pliantui init")).toBeVisible()

  await first.getByRole("tab", { name: "yarn" }).click()
  await expect(page.getByText("yarn dlx pliantui init")).toBeVisible()
  await expect(
    managers.nth(1).getByRole("tab", { name: "yarn" })
  ).toHaveAttribute("aria-selected", "true")

  const block = page
    .locator("figure")
    .filter({ has: page.getByText("yarn dlx pliantui init") })
  await block.getByRole("button", { name: "Copy" }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "yarn dlx pliantui init"
  )

  await page.reload()
  await expect(page.getByText("yarn dlx pliantui init")).toBeVisible()
  expect(errors).toEqual([])
})
