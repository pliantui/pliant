import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import * as contract from "@pliantui/contract"
import * as core from "@pliantui/core"
import * as react from "@pliantui/react"
import * as reactAsk from "@pliantui/react/ask"
import * as reactForm from "@pliantui/react/form"
import * as reactLocal from "@pliantui/react/local"
import * as reactNav from "@pliantui/react/nav"
import * as reactPointMode from "@pliantui/react/point-mode"
import * as reactPrePaint from "@pliantui/react/pre-paint"
import * as reactRegion from "@pliantui/react/region"
import * as reactServerAdapter from "@pliantui/react/server-adapter"
import * as reactTable from "@pliantui/react/table"
import * as server from "@pliantui/server"
import * as serverData from "@pliantui/server/data"
import * as serverRecordings from "@pliantui/server/recordings"
import * as serverSql from "@pliantui/server/sql"
import * as serverStorage from "@pliantui/server/storage"

const reference = path.join(import.meta.dirname, "../../content/docs/reference")

function readPage(name: string) {
  return readFileSync(path.join(reference, `${name}.mdx`), "utf8")
}

// The names of a page's entries: its `### \`name\`` headings.
function entriesOf(text: string) {
  return [...text.matchAll(/^### `([^`]+)`$/gm)].map(([, name]) => name)
}

it("has one entry for every op in the catalog", () => {
  expect(entriesOf(readPage("operations")).toSorted()).toEqual(
    Object.keys(contract.opCatalog).toSorted()
  )
})

it("has one entry for every function in the catalog", () => {
  expect(entriesOf(readPage("functions")).toSorted()).toEqual(
    Object.keys(contract.functionCatalog.functions).toSorted()
  )
})

const packages = {
  contract: [contract],
  core: [core],
  react: [
    react,
    reactAsk,
    reactForm,
    reactLocal,
    reactNav,
    reactPointMode,
    reactPrePaint,
    reactRegion,
    reactServerAdapter,
    reactTable,
  ],
  server: [server, serverData, serverRecordings, serverSql, serverStorage],
}

describe.each(Object.entries(packages))("the %s API page", (name, modules) => {
  it("lists every runtime export", () => {
    const text = readPage(name)
    const missing = modules
      .flatMap((module) => Object.keys(module))
      .filter((key) => !text.includes(`\`${key}\``))
    expect(missing).toEqual([])
  })
})
