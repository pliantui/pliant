import { test as base, expect, type Locator } from "@playwright/test"

export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))
    await provide(errors)
  },
})

export { expect }

// Opens a Customize menu and picks one of its items, such as "Reset to
// default". `menu` is the menu's button.
export async function pickCustomize(
  menu: Locator,
  item: "Ask for a change…" | "Adjust by hand" | "History" | "Reset to default"
) {
  await menu.click()
  await menu.page().getByRole("menuitem", { name: item }).click()
}
