import { test as base, expect } from "@playwright/test"

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
