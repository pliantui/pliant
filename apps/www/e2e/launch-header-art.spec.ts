import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const post = "/blog/introducing-pliant"
const art = (page: Page) =>
  page.getByRole("img", { name: /^The Pliant tangram/ })

declare global {
  interface Window {
    webglDraws?: number
    webglRequested?: boolean
  }
}

// Counts the frames drawn with WebGL on the page. Runs in the page, so it
// stands alone.
function countDraws() {
  window.webglDraws = 0
  const prototype = WebGLRenderingContext.prototype
  const draw: unknown = Reflect.get(prototype, "drawArrays")
  Object.defineProperty(prototype, "drawArrays", {
    value(this: WebGLRenderingContext, ...args: unknown[]) {
      window.webglDraws = (window.webglDraws ?? 0) + 1
      if (typeof draw === "function") Reflect.apply(draw, this, args)
    },
  })
}

// Makes WebGL unavailable, as on a browser or device without it.
function disableWebgl() {
  const prototype = HTMLCanvasElement.prototype
  const getContext: unknown = Reflect.get(prototype, "getContext")
  Object.defineProperty(prototype, "getContext", {
    value(this: HTMLCanvasElement, type: string, ...args: unknown[]): unknown {
      if (type.startsWith("webgl")) {
        window.webglRequested = true
        return null
      }
      return typeof getContext === "function"
        ? (Reflect.apply(getContext, this, [type, ...args]) as unknown)
        : null
    },
  })
}

const draws = (page: Page) => page.evaluate(() => window.webglDraws ?? 0)

test("animates the art once its first frame is drawn", async ({
  page,
  errors,
}) => {
  await page.addInitScript(countDraws)
  await page.goto(post)

  await expect.poll(() => draws(page)).toBeGreaterThan(0)
  await expect
    .poll(() => art(page).evaluate((element) => element.tagName))
    .toBe("CANVAS")
  await expect(art(page)).toHaveCount(1)
  await expect(art(page)).toBeVisible()

  const before = await art(page).screenshot()
  await page.waitForTimeout(500)
  expect((await art(page).screenshot()).equals(before)).toBe(false)
  expect(errors).toEqual([])
})

test("shows the still image with reduced motion", async ({ page, errors }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(countDraws)
  await page.goto(post)
  await page.waitForLoadState("networkidle")

  await expect(art(page)).toBeVisible()
  expect(await art(page).evaluate((element) => element.tagName)).toBe("IMG")
  expect(
    await art(page).evaluate(
      (element) => element instanceof HTMLImageElement && element.currentSrc
    )
  ).toMatch(/\/pliant-hero-1254\.webp$/)
  expect(await draws(page)).toBe(0)
  expect(errors).toEqual([])
})

test("shows the still image without WebGL", async ({ page, errors }) => {
  await page.addInitScript(disableWebgl)
  await page.goto(post)

  await expect
    .poll(() => page.evaluate(() => window.webglRequested ?? false))
    .toBe(true)
  await expect(art(page)).toHaveCount(1)
  await expect(art(page)).toBeVisible()
  expect(await art(page).evaluate((element) => element.tagName)).toBe("IMG")
  expect(errors).toEqual([])
})

test("draws nothing while scrolled out of view", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 400 })
  await page.addInitScript(countDraws)
  await page.goto(post)
  await expect.poll(() => draws(page)).toBeGreaterThan(0)

  await page.getByRole("contentinfo").scrollIntoViewIfNeeded()
  await expect(art(page)).not.toBeInViewport()
  // Let a frame already queued finish.
  await page.waitForTimeout(200)
  const hidden = await draws(page)
  await page.waitForTimeout(1000)
  expect(await draws(page)).toBe(hidden)

  await art(page).scrollIntoViewIfNeeded()
  await expect.poll(() => draws(page)).toBeGreaterThan(hidden)
})
