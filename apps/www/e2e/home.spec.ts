import type { Page } from "@playwright/test"

import { sections } from "../lib/acme/data"
import { expect, test } from "./fixtures"

function app(page: Page) {
  return page.getByRole("tabpanel", { name: "Preview" })
}

function sidebar(page: Page) {
  return app(page).getByRole("navigation", { name: "Acme" })
}

function sectionsTable(page: Page) {
  return app(page).getByRole("table", { name: "Proposal sections" })
}

function asks(page: Page, part: string) {
  return app(page).getByRole("group", { name: `Ask about ${part}` })
}

function moreAsks(page: Page, part: string) {
  return app(page).getByRole("group", { name: `More asks about ${part}` })
}

function row(page: Page, header: string) {
  return sectionsTable(page).getByRole("row").filter({ hasText: header })
}

async function load(page: Page) {
  await page.goto("/")
  await expect(
    app(page).locator('[data-pliant-id="acme-sections"]')
  ).not.toHaveAttribute("data-pliant-pending")
}

async function ask(page: Page, part: string, prompt: string) {
  await asks(page, part)
    .getByRole("button", { name: new RegExp(`^${prompt}`) })
    .click()
}

async function lockIn(page: Page) {
  await app(page).getByRole("button", { name: "Lock in" }).click()
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).click()
}

test("leads to the docs, the components and the launch post", async ({
  page,
}) => {
  await page.goto("/")
  const main = page.getByRole("main")

  await expect(
    main.getByRole("heading", {
      level: 1,
      name: "Your app, shaped by the people who use it.",
    })
  ).toBeVisible()
  await expect(
    main.getByText(
      "Point at any part of your shadcn app and ask for a change. Pliant reshapes it with your own components, within the rules you set."
    )
  ).toBeVisible()
  await expect(main.getByRole("link", { name: "Get started" })).toHaveAttribute(
    "href",
    "/docs"
  )
  await expect(
    main.getByRole("link", { name: "View components" })
  ).toHaveAttribute("href", "/docs/components")
  await main.getByRole("link", { name: "Introducing Pliant" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Introducing Pliant" })
  ).toBeVisible()
  await expect(page.getByText("The full post is on its way.")).toBeVisible()
})

test("has no features or install sections", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Add it to your app" })
  ).toHaveCount(0)
  await expect(page.getByText("Safe by design")).toHaveCount(0)
})

test("switches the dashboard's page from its sidebar", async ({
  page,
  errors,
}) => {
  await load(page)
  const title = app(page).getByRole("heading", { level: 3 }).first()
  await expect(title).toHaveText("Dashboard")

  await sidebar(page).getByRole("link", { name: "Analytics" }).click()
  await expect(title).toHaveText("Analytics")
  await expect(
    app(page).getByRole("cell", { name: "November 2026" })
  ).toBeVisible()
  await expect(page).toHaveURL("/")

  await app(page).getByRole("button", { name: "Settings" }).click()
  await expect(title).toHaveText("Settings")
  await expect(app(page).getByLabel("Email")).toHaveValue("eddie@acme.example")

  await sidebar(page).getByRole("link", { name: "Dashboard" }).click()
  await expect(title).toHaveText("Dashboard")
  await expect(sectionsTable(page)).toBeVisible()
  expect(errors).toEqual([])
})

test("adds a derived column, shows it in Changes, and resets it", async ({
  page,
  errors,
}) => {
  await load(page)
  await openTab(page, "Changes")
  await expect(page.getByText("No changes yet")).toBeVisible()
  await openTab(page, "Preview")

  await ask(
    page,
    "the sections table",
    "add a column for how far each section is over its limit"
  )
  await expect(
    sectionsTable(page).getByRole("columnheader", { name: /Over limit/ })
  ).toBeVisible()
  // Cover page: a target of 18 against a limit of 5.
  await expect(row(page, "Cover page")).toContainText("13")
  await lockIn(page)

  await openTab(page, "Changes")
  const overlay = page.getByLabel("Overlay")
  await expect(overlay).toContainText('"op": "addDerived"')
  await expect(overlay).toContainText('"id": "over-limit"')

  await openTab(page, "Preview")
  await app(page).getByRole("button", { name: "Reset the dashboard" }).click()
  await expect(
    sectionsTable(page).getByRole("columnheader", { name: /Over limit/ })
  ).toBeHidden()
  await openTab(page, "Changes")
  await expect(page.getByText("No changes yet")).toBeVisible()
  expect(errors).toEqual([])
})

test("highlights the sections in process that are over their limit", async ({
  page,
  errors,
}) => {
  await load(page)
  await ask(
    page,
    "the sections table",
    "highlight sections in process that are over their limit"
  )

  // In process, 18 against 5.
  await expect(row(page, "Cover page")).toContainText("Highlighted")
  // In process, but 2 against 16.
  await expect(row(page, "Design")).not.toContainText("Highlighted")
  // 29 against 24, but done.
  await expect(row(page, "Table of contents")).not.toContainText("Highlighted")
  expect(errors).toEqual([])
})

test("groups the sections by type with the average target", async ({
  page,
  errors,
}) => {
  await load(page)
  await ask(
    page,
    "the sections table",
    "group by section type with the average target"
  )

  const narrative = sections.filter((section) => section.type === "Narrative")
  const average =
    narrative.reduce((sum, section) => sum + section.target, 0) /
    narrative.length
  const group = sectionsTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: /Narrative/ }) })
  await expect(group).toContainText(
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(average)
  )
  await expect(group).toContainText(String(narrative.length))
  expect(errors).toEqual([])
})

test("the Data tab shows no request for a computed ask and the query for a server one", async ({
  page,
  errors,
}) => {
  await load(page)
  await ask(
    page,
    "the sections table",
    "show each section's share of all target pages"
  )
  await lockIn(page)
  await openTab(page, "Data")
  const data = page.getByRole("tabpanel", { name: "Data" })
  await expect(
    data.getByText("Computed in the browser: no new request")
  ).toBeVisible()
  await expect(data.getByText('"op": "addDerived"')).toBeVisible()

  await openTab(page, "Preview")
  await ask(
    page,
    "the sections table",
    "only show Eddie Lake's sections that are in process"
  )
  const rows = sectionsTable(page).locator("tbody").getByRole("row")
  const expected = sections.filter(
    (section) =>
      section.reviewer === "Eddie Lake" && section.status === "In Process"
  )
  await expect(rows).toHaveCount(expected.length)
  await lockIn(page)
  await openTab(page, "Data")
  await expect(data.getByText("Server mode: one new request")).toBeVisible()
  await expect(
    data.getByText(/WHERE "workspace_id" = \$1 AND "reviewer" = \$2/)
  ).toBeVisible()
  await expect(
    data.getByText('values: ["acme","Eddie Lake","In Process",10,0]')
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("says no to profit margin and changes nothing", async ({
  page,
  errors,
}) => {
  await load(page)
  const cards = app(page).locator('[data-pliant-id="acme-metrics"]')
  await expect(cards.getByText("Total Revenue")).toBeVisible()
  const before = await cards.textContent()

  await moreAsks(page, "the metric cards")
    .getByRole("button", { name: /^add a card for profit margin/ })
    .click()
  await expect(
    app(page).getByText(
      "There's no cost data in this dashboard, so profit margin can't be worked out. Nothing changed."
    )
  ).toBeVisible()
  expect(await cards.textContent()).toBe(before)
  await openTab(page, "Changes")
  await expect(page.getByText("No changes yet")).toBeVisible()
  expect(errors).toEqual([])
})

test("plays the scripted chart and card asks with their overlays", async ({
  page,
  errors,
}) => {
  await load(page)
  await asks(page, "the visitors chart")
    .getByRole("button", { name: /^chart visitors by device as a line/ })
    .click()
  await expect(
    asks(page, "the visitors chart").getByRole("button", {
      name: /^chart visitors by device as a line ?, Scripted$/,
    })
  ).toHaveAttribute("aria-pressed", "true")
  await openTab(page, "Changes")
  await expect(page.getByLabel("Overlay")).toContainText(
    '"op": "configureChart"'
  )
  await openTab(page, "Preview")

  await moreAsks(page, "the metric cards")
    .getByRole("button", { name: /^add a card comparing/ })
    .click()
  await expect(app(page).getByText(/^Revenue vs last month/)).toBeVisible()
  await expect(app(page).getByText("October: $111,100.00")).toBeVisible()

  await app(page).getByRole("button", { name: "Reset the dashboard" }).click()
  await expect(app(page).getByText(/^Revenue vs last month/)).toBeHidden()
  expect(errors).toEqual([])
})

test("opens the start page the user picked", async ({ page, errors }) => {
  await load(page)
  await ask(page, "the sidebar", "open Analytics when I log in")
  await lockIn(page)

  await page.reload()
  await expect(app(page).getByRole("heading", { level: 3 }).first()).toHaveText(
    "Analytics"
  )
  expect(errors).toEqual([])
})

test("moves the pages the user doesn't use under More", async ({
  page,
  errors,
}) => {
  await load(page)
  await expect(
    sidebar(page).getByRole("link", { name: "Projects" })
  ).toBeVisible()

  await ask(page, "the sidebar", "move what I don't use under More")
  await expect(
    sidebar(page).getByRole("link", { name: "Projects" })
  ).toBeHidden()
  await sidebar(page).getByRole("button", { name: "More" }).click()
  await expect(
    sidebar(page).getByRole("link", { name: "Projects" })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("point mode leads to the asks of the part picked", async ({
  page,
  errors,
}) => {
  await load(page)
  await sectionsTable(page).scrollIntoViewIfNeeded()
  await app(page).getByRole("button", { name: "Point" }).click()
  await page.getByRole("button", { name: "Sections table" }).focus()
  await page.keyboard.press("Enter")

  await expect(
    asks(page, "the sections table").getByRole("button").first()
  ).toBeFocused()
  expect(errors).toEqual([])
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("fits the screen", async ({ page }) => {
    await load(page)

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      )
    ).toBe(false)
  })
})
