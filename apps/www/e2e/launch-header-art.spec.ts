import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const post = "/blog/introducing-pliant"
const art = (page: Page) =>
  page.getByRole("img", { name: /^The Pliant tangram/ })

declare global {
  interface Window {
    webglDraws?: number
    webglRequested?: boolean
    slowWebglRefused?: boolean
    framesWithoutArt?: number
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

// Gives only slow, software-rendered WebGL, as on a device without a usable
// GPU: a context that must not run slowly is refused.
function slowWebgl() {
  const prototype = HTMLCanvasElement.prototype
  const getContext: unknown = Reflect.get(prototype, "getContext")
  Object.defineProperty(prototype, "getContext", {
    value(
      this: HTMLCanvasElement,
      type: string,
      attributes?: WebGLContextAttributes
    ): unknown {
      if (
        type.startsWith("webgl") &&
        attributes?.failIfMajorPerformanceCaveat
      ) {
        window.slowWebglRefused = true
        return null
      }
      return typeof getContext === "function"
        ? (Reflect.apply(getContext, this, [type, attributes]) as unknown)
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

test("shows the still image when WebGL would be slow", async ({
  page,
  errors,
}) => {
  await page.addInitScript(slowWebgl)
  await page.goto(post)

  await expect
    .poll(() => page.evaluate(() => window.slowWebglRefused ?? false))
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

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`shows the page background around the art (${reducedMotion} motion)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion })
    await page.goto(post)
    if (reducedMotion === "no-preference") {
      await expect
        .poll(() => art(page).evaluate((element) => element.tagName))
        .toBe("CANVAS")
    }
    const box = await art(page).boundingBox()
    if (!box) throw new Error("The art has no layout box")

    // The artwork's empty margin, black in the source image, and the page
    // just outside the art look the same.
    const size = { width: 4, height: 4 }
    const y = box.y + box.height * 0.05
    const margin = await page.screenshot({
      clip: { x: box.x + box.width * 0.05, y, ...size },
    })
    const outside = await page.screenshot({
      clip: { x: box.x - 20, y, ...size },
    })
    expect(margin.equals(outside)).toBe(true)
  })
}

test.describe("on a 1.5× screen", () => {
  test.use({ deviceScaleFactor: 1.5 })

  test("downloads the artwork once", async ({ page }) => {
    const images: string[] = []
    page.on("request", (request) => {
      const { pathname } = new URL(request.url())
      if (pathname.startsWith("/pliant-hero-")) images.push(pathname)
    })
    await page.goto(post)
    await expect
      .poll(() => art(page).evaluate((element) => element.tagName))
      .toBe("CANVAS")
    await page.waitForLoadState("networkidle")

    expect(new Set(images).size).toBe(1)
  })
})

test("keeps the still image until the animation resumes", async ({ page }) => {
  await page.goto(post)
  await expect
    .poll(() => art(page).evaluate((element) => element.tagName))
    .toBe("CANVAS")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect
    .poll(() => art(page).evaluate((element) => element.tagName))
    .toBe("IMG")

  // Records every frame in which no artwork is shown.
  await page.evaluate(() => {
    window.framesWithoutArt = 0
    const check = () => {
      const shown = document.querySelector(
        'img[alt^="The Pliant tangram"], canvas[aria-label^="The Pliant tangram"]:not([aria-hidden="true"])'
      )
      if (!shown) window.framesWithoutArt = (window.framesWithoutArt ?? 0) + 1
      requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect
    .poll(() => art(page).evaluate((element) => element.tagName))
    .toBe("CANVAS")

  expect(await page.evaluate(() => window.framesWithoutArt)).toBe(0)
})
