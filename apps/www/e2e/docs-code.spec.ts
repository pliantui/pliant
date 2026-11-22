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
  await expect(page.getByText("pnpm dlx pliantui init").first()).toBeVisible()

  await first.getByRole("tab", { name: "yarn" }).click()
  await expect(page.getByText("yarn dlx pliantui init").first()).toBeVisible()
  await expect(
    managers.nth(1).getByRole("tab", { name: "yarn" })
  ).toHaveAttribute("aria-selected", "true")

  const block = page
    .getByRole("figure")
    .filter({ has: page.getByText("yarn dlx pliantui init") })
    .first()
  await block.getByRole("button", { name: "Copy" }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "yarn dlx pliantui init"
  )

  await page.reload()
  await expect(first.getByRole("tab", { name: "yarn" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(page.getByText("yarn dlx pliantui init").first()).toBeVisible()
  expect(errors).toEqual([])
})

test("remembers whether the reader installs with the CLI or by hand", async ({
  page,
}) => {
  await page.goto("/docs/cli/init")
  const manual = page.getByRole("tab", { name: "Manual" })

  await manual.click()
  await expect(page.getByText("Install the React package")).toBeVisible()

  await page.reload()
  await expect(manual).toHaveAttribute("aria-selected", "true")
  await expect(page.getByText("Install the React package")).toBeVisible()
})

test("folds a folder in a file tree", async ({ page }) => {
  await page.goto("/docs/cli/init")
  const folder = page.getByRole("button", { name: "pliant", exact: true })

  await expect(page.getByText("pliant-region.tsx")).toBeVisible()
  await folder.click()
  await expect(page.getByText("pliant-region.tsx")).toBeHidden()
})

test("shows an included snippet as a copyable code block", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/docs/cli/init")
  const block = page
    .getByRole("figure")
    .filter({ hasText: "export default function Page()" })

  await block.getByRole("button", { name: "Copy" }).click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/^import \{ PliantRoot \} from "@pliantui\/react"/)
  expect(copied).not.toContain("#region")
  expect(copied).not.toContain("function OrderTotal")
})
