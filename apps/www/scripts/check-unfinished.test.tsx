import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ComingSoon } from "@/components/coming-soon"
import { NotImplementedBanner } from "@/components/not-implemented-banner"

import { checkUnfinished, findUnfinishedPages } from "./check-unfinished"

const production = "https://pliantui.dev"
const preview = "https://pliantui-www.pliantui-dev.workers.dev"

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "pliant-unfinished-"))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

function page(path: string, body: React.ReactNode) {
  const file = join(directory, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `<html><body>${renderToStaticMarkup(body)}</body></html>`)
}

describe("findUnfinishedPages", () => {
  it("finds the pages that show a banner, a placeholder or a scripted ask", () => {
    page("charts.html", <NotImplementedBanner />)
    page(
      "docs/guides/teams.html",
      <>
        <NotImplementedBanner />
        <ComingSoon>Teams.</ComingSoon>
      </>
    )
    page("templates.html", <ComingSoon>Templates.</ComingSoon>)
    page("index.html", <div data-unfinished="scripted">Scripted asks</div>)
    page("notes.txt", <NotImplementedBanner />)

    expect(findUnfinishedPages(directory)).toEqual([
      { file: "charts.html", kinds: ["not-implemented"] },
      {
        file: join("docs", "guides", "teams.html"),
        kinds: ["coming-soon", "not-implemented"],
      },
      { file: "index.html", kinds: ["scripted"] },
      { file: "templates.html", kinds: ["coming-soon"] },
    ])
  })
})

describe("checkUnfinished", () => {
  it("fails a build for the production site while anything is unfinished", () => {
    page("index.html", <h1>Home</h1>)
    page("charts.html", <NotImplementedBanner />)

    for (const url of [
      production,
      `${production}/`,
      "http://pliantui.dev",
      "https://www.pliantui.dev",
    ]) {
      expect(checkUnfinished(url, directory), url).toMatchObject({
        ok: false,
        production: true,
      })
    }
  })

  it("passes builds for other addresses", () => {
    page("index.html", <h1>Home</h1>)
    page("charts.html", <NotImplementedBanner />)

    for (const url of [
      preview,
      "https://pliantui.dev.example.com",
      "",
      undefined,
    ]) {
      expect(checkUnfinished(url, directory), String(url)).toMatchObject({
        ok: true,
        production: false,
      })
    }
  })

  it("passes the production build once everything is finished", () => {
    page("index.html", <h1>Home</h1>)

    expect(checkUnfinished(production, directory)).toEqual({
      ok: true,
      production: true,
      pages: [],
    })
  })

  it("fails when it can't find the prerendered pages", () => {
    page("other/index.html", <h1>Home</h1>)

    expect(() => checkUnfinished(preview, directory)).toThrow(
      "No prerendered home page"
    )
  })
})
