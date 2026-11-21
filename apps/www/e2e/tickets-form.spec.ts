import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/tickets"

async function seed(page: Page, ops: unknown[]) {
  await page.addInitScript(
    ({ key, record }) => {
      localStorage.setItem(key, JSON.stringify(record))
    },
    {
      key: `pliant:${surface}:01KAB0000000000000000000P1`,
      record: {
        overlay: {
          v: 1,
          id: "01KAB0000000000000000000P1",
          surface,
          layer: "personal",
          ops,
          basis: { contract: 1, core: "0.0.0", manifests: {} },
          source: "manual",
          createdBy: "local",
          createdAt: "2026-11-19T00:00:00.000Z",
        },
        etag: "1",
        version: 1,
        updatedAt: "2026-11-19T00:00:00.000Z",
      },
    }
  )
}

async function load(page: Page, ops: unknown[] = []) {
  if (ops.length) {
    await seed(page, ops)
  }
  await page.goto(surface)
  await expect(
    page.locator('[data-pliant-id="ticket-form"]')
  ).not.toHaveAttribute("data-pliant-pending")
}

const labels = ["Subject", "Description", "Priority", "Order number", "CC"]

// The fields the user sees, top to bottom.
async function shownFields(page: Page) {
  const shown: { label: string; y: number }[] = []
  for (const label of labels) {
    const field = page.getByLabel(label, { exact: true })
    if (await field.isVisible()) {
      const box = await field.boundingBox()
      shown.push({ label, y: box?.y ?? 0 })
    }
  }
  return shown.sort((a, b) => a.y - b.y).map(({ label }) => label)
}

const collapse = {
  op: "collapse",
  target: "ticket-form",
  items: ["orderId", "cc"],
  into: "more",
}

test("renders the fields in their base order without console errors", async ({
  page,
  errors,
}) => {
  await load(page)
  expect(await shownFields(page)).toEqual(labels)
  await expect(page.getByRole("button", { name: "More fields" })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("shows the fields in the order the user chose, and tabs in that order", async ({
  page,
}) => {
  await load(page, [
    { op: "move", target: "ticket-form/fields/cc", to: { before: "subject" } },
    { op: "hide", target: "ticket-form/fields/orderId" },
  ])
  expect(await shownFields(page)).toEqual([
    "CC",
    "Subject",
    "Description",
    "Priority",
  ])
  await expect(page.getByLabel("Order number")).toBeHidden()

  await page.getByLabel("CC").focus()
  await page.keyboard.press("Tab")
  await expect(page.getByLabel("Subject")).toBeFocused()
})

test("keeps required fields visible", async ({ page }) => {
  await load(page, [
    { op: "hide", target: "ticket-form/fields/subject" },
    {
      op: "collapse",
      target: "ticket-form",
      items: ["description"],
      into: "more",
    },
  ])
  expect(await shownFields(page)).toEqual(labels)
})

test("collapses fields into More fields, in place", async ({ page }) => {
  await load(page, [collapse])
  const more = page.getByRole("button", { name: "More fields" })
  await expect(more).toHaveAttribute("aria-expanded", "false")
  expect(await shownFields(page)).toEqual([
    "Subject",
    "Description",
    "Priority",
  ])

  const priority = await page.getByLabel("Priority").boundingBox()
  const trigger = await more.boundingBox()
  expect(trigger?.y).toBeGreaterThan(priority?.y ?? Infinity)

  await more.click()
  await expect(more).toHaveAttribute("aria-expanded", "true")
  expect(await shownFields(page)).toEqual(labels)
})

test("opens More fields when a field inside is invalid", async ({ page }) => {
  await load(page, [collapse])
  const more = page.getByRole("button", { name: "More fields" })
  await page.getByLabel("Subject").fill("Refund not received")
  await page
    .getByLabel("Description")
    .fill("I returned my order two weeks ago.")
  await more.click()
  await page.getByLabel("CC").fill("not an email")
  await more.click()
  await expect(page.getByLabel("CC")).toBeHidden()

  await page.getByRole("button", { name: "Submit ticket" }).click()
  await expect(more).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByLabel("CC")).toBeFocused()
  await expect(page.getByText("Enter an email address.")).toBeVisible()
  await expect(page.getByLabel("CC")).toHaveValue("not an email")
  await expect(page.getByRole("status")).toHaveText("")
})

test("opens More fields before the browser reports an invalid field", async ({
  page,
}) => {
  await load(page, [collapse])
  // The browser's own validation runs on a form without `noValidate`.
  await page.locator("form").evaluate((form) => {
    form.removeAttribute("novalidate")
  })
  const more = page.getByRole("button", { name: "More fields" })
  await more.click()
  await page.getByLabel("CC").fill("not an email")
  await more.click()

  await page.getByRole("button", { name: "Submit ticket" }).click()
  await expect(more).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByLabel("CC")).toBeFocused()
  expect(
    await page
      .getByLabel("CC")
      .evaluate((input: HTMLInputElement) => input.validity.valid)
  ).toBe(false)
})

test("tabs from the last shown field to More fields, then past the closed fields", async ({
  page,
}) => {
  await load(page, [collapse])
  await page.getByLabel("Priority").focus()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "More fields" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Submit ticket" })
  ).toBeFocused()
})

test("starts the form with the user's own defaults", async ({ page }) => {
  await load(page, [
    {
      op: "setDefault",
      target: "ticket-form/fields/priority",
      value: "high",
    },
    {
      op: "setDefault",
      target: "ticket-form/fields/cc",
      value: "team@example.com",
    },
  ])
  await expect(page.getByLabel("Priority")).toHaveText("High")
  await expect(page.getByLabel("CC")).toHaveValue("team@example.com")
})

test("skips a default the field doesn't accept", async ({ page }) => {
  await load(page, [
    {
      op: "setDefault",
      target: "ticket-form/fields/priority",
      value: "urgent",
    },
  ])
  await expect(page.getByLabel("Priority")).toHaveText("Normal")
})

test("has no accessibility violations with fields collapsed", async ({
  page,
}) => {
  await load(page, [collapse])
  const results = await new AxeBuilder({ page })
    .include('[data-pliant-id="ticket-form"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  expect(results.violations).toEqual([])
})
