import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ComingSoon } from "@/components/coming-soon"
import { NotImplementedBanner } from "@/components/not-implemented-banner"

import { checkLaunch, findUnfinishedPages, launchUrl } from "./launch-guard"

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "pliant-launch-"))
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
  it("finds the pages that show a banner or a placeholder", () => {
    page("index.html", <h1>Home</h1>)
    page("charts.html", <NotImplementedBanner />)
    page(
      "docs/guides/teams.html",
      <>
        <NotImplementedBanner />
        <NotImplementedBanner variant="preview" />
      </>
    )
    page("templates.html", <ComingSoon>Templates are on their way.</ComingSoon>)
    page("notes.txt", <NotImplementedBanner />)

    expect(findUnfinishedPages(directory)).toEqual([
      { file: "charts.html", kinds: ["not-implemented"] },
      {
        file: join("docs", "guides", "teams.html"),
        kinds: ["not-implemented"],
      },
      { file: "templates.html", kinds: ["coming-soon"] },
    ])
  })
})

describe("checkLaunch", () => {
  it("fails a build for the launch address while anything is unfinished", () => {
    page("charts.html", <NotImplementedBanner />)

    expect(checkLaunch(launchUrl, directory)).toMatchObject({ ok: false })
    expect(checkLaunch(`${launchUrl}/`, directory)).toMatchObject({ ok: false })
  })

  it("passes builds for other addresses", () => {
    page("charts.html", <NotImplementedBanner />)

    expect(
      checkLaunch("https://pliantui-www.pliantui-dev.workers.dev", directory)
    ).toMatchObject({ ok: true, launching: false })
    expect(checkLaunch(undefined, directory)).toMatchObject({ ok: true })
  })

  it("passes the launch build once everything is finished", () => {
    page("index.html", <h1>Home</h1>)

    expect(checkLaunch(launchUrl, directory)).toEqual({
      ok: true,
      launching: true,
      pages: [],
    })
  })
})
