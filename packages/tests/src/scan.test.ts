import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, describe, expect, it } from "vitest"

import { loadOverlay, resolveLayers } from "@pliantui/core"

import {
  createFixtureDirectory,
  removeFixtureDirectories,
  runCli,
} from "./helpers"

afterAll(removeFixtureDirectories)

interface SurfaceInventory {
  baseIds: { ids: string[]; source: "inventory" | "mounted" }
  baseParents: Record<string, string | null>
  baseOrder: Record<string, string[]>
  ids: Record<string, { kind: string; hash: string }>
}

const inventoryFile = "lib/pliant/inventory.generated.ts"

async function readInventory(cwd: string) {
  const module = (await import(
    `${pathToFileURL(path.join(cwd, inventoryFile)).href}?${String(Date.now())}`
  )) as { inventory: Record<string, SurfaceInventory> }
  return module.inventory
}

interface JsonOutput {
  file: string
  written?: boolean
  upToDate?: boolean
  inventory: Record<string, SurfaceInventory>
  errors: { file: string; line: number; message: string }[]
  warnings: { file: string; line: number; message: string }[]
}

async function scanJson(cwd: string, ...args: string[]) {
  const { stdout, exitCode } = await runCli(cwd, ["scan", "--json", ...args])
  return { output: JSON.parse(stdout) as JsonOutput, exitCode }
}

async function edit(
  cwd: string,
  file: string,
  search: string,
  replacement: string
) {
  const target = path.join(cwd, file)
  const source = await readFile(target, "utf8")
  expect(source).toContain(search)
  await writeFile(target, source.replace(search, replacement))
}

function overlay(surface: string, ops: unknown[]) {
  const result = loadOverlay({
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R7S800",
    surface,
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  })
  if (!result.success) {
    throw result.error
  }
  return result.data
}

describe("pliantui scan", () => {
  it("lists each surface's node ids and where each node sits", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { exitCode } = await runCli(cwd, ["scan"])

    expect(exitCode).toBe(0)
    const inventory = await readInventory(cwd)
    expect(Object.keys(inventory)).toEqual([
      "/orders",
      // Its PliantRoot comes from a namespace import.
      "help",
      "reports",
      "settings",
      "shop",
    ])
    const orders = inventory["/orders"]
    expect(orders?.baseIds).toEqual({
      ids: [
        "address",
        "alerts",
        "banner",
        "billing",
        "details",
        "first",
        "framed",
        "invoice",
        "item-list",
        "items",
        "late",
        "message",
        // Declared through the app's own hook, useOrdersTable.
        "orders-table",
        "orders-table/columns/actions",
        "orders-table/columns/cents",
        "orders-table/columns/customer_name",
        "orders-table/columns/id",
        "page",
        "refunds",
        "revenue",
        "second",
        "shipping",
        "status",
        "summary",
      ],
      source: "inventory",
    })
    expect(orders?.baseParents).toEqual({
      page: null,
      // A region rendered as a slot of the same id is that slot.
      summary: "page",
      revenue: "summary",
      refunds: "summary",
      details: "page",
      // Rendered conditionally, inside the component in the details slot.
      shipping: "details",
      address: "shipping",
      status: "shipping",
      billing: "details",
      invoice: "billing",
      "item-list": null,
      items: "item-list",
      // Rendered by a render prop, where the component calls it.
      alerts: "items",
      late: "alerts",
      // Declared with a namespace import, Pliant.usePliantRegion.
      framed: null,
      banner: "framed",
      message: "banner",
      first: "framed",
      second: "framed",
      // Rendered through a component that passes its children on.
      "orders-table": null,
    })
    // Each node's children in the order they render, not sorted.
    expect(orders?.baseOrder).toEqual({
      page: ["summary", "details"],
      summary: ["revenue", "refunds"],
      details: ["shipping", "billing"],
      shipping: ["address", "status"],
      billing: ["invoice"],
      "item-list": ["items"],
      items: ["alerts"],
      alerts: ["late"],
      // The banner renders before the slots.
      framed: ["banner", "first", "second"],
      banner: ["message"],
    })
    expect(Object.keys(orders?.ids ?? {}).sort()).toEqual(orders?.baseIds.ids)
    expect(orders?.ids["page"]?.kind).toBe("pliant:region")
    expect(orders?.ids["orders-table"]?.kind).toBe("pliant:table")
    expect(orders?.ids["orders-table/columns/id"]?.kind).toBe("pliant:column")
    expect(orders?.ids["address"]?.kind).toBe("pliant:slot")
  })

  it("follows an App Router layout's children into the pages under it", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await runCli(cwd, ["scan"])
    const shop = (await readInventory(cwd))["shop"]

    expect(shop?.baseIds.source).toBe("inventory")
    expect(shop?.baseParents).toEqual({
      // The parallel route the layout renders as its modal prop, through
      // that route's own layout.
      "modal-frame": null,
      content: "modal-frame",
      "sign-in": "content",
      form: "sign-in",
      // A page whose default export is wrapped in a function call.
      account: null,
      orders: "account",
      "shop-header": null,
      cart: "shop-header",
      // The page of the layout's own segment.
      "shop-home": null,
      hero: "shop-home",
      // A page in a route group, exported with `export { … as default }`.
      about: null,
      story: "about",
      // A page under a nested layout, in a dynamic segment, sits where that
      // layout renders its children.
      product: null,
      details: "product",
      gallery: "details",
      photos: "gallery",
    })
  })

  it("adds an @children folder's routes to the layout's children", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await mkdir(path.join(cwd, "app/(shop)/@children"))
    await writeFile(
      path.join(cwd, "app/(shop)/@children/page.tsx"),
      [
        'import { PliantRegion } from "@/components/pliant/pliant-region"',
        "",
        "export default function Kids() {",
        '  return <PliantRegion id="kids" slots={{ toys: <p>Toys</p> }} />',
        "}",
        "",
      ].join("\n")
    )
    const { output } = await scanJson(cwd)
    const shop = output.inventory["shop"]

    expect(shop?.baseParents["kids"]).toBe(null)
    expect(shop?.baseParents["shop-home"]).toBe(null)
    expect(shop?.baseParents["sign-in"]).toBe("content")
  })

  it("follows app and not src/app when both exist, as Next.js does", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await mkdir(path.join(cwd, "src/app/beta"), { recursive: true })
    await writeFile(
      path.join(cwd, "src/app/beta/layout.tsx"),
      [
        'import * as React from "react"',
        "",
        'import { PliantRoot } from "@pliantui/react"',
        "",
        "export default function BetaLayout({",
        "  children,",
        "}: {",
        "  children: React.ReactNode",
        "}) {",
        '  return <PliantRoot surface="beta">{children}</PliantRoot>',
        "}",
        "",
      ].join("\n")
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["beta"]?.baseIds.source).toBe("mounted")
    expect(output.warnings).toContainEqual({
      file: "src/app/beta/layout.tsx",
      line: 10,
      message:
        "Content passed as children isn't followed, so the nodes in it are in no inventory.",
    })
  })

  it("puts the slots of a region from the app's own hook where they render", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    // useHookedRegion is called as hooks.useHookedRegion(), and its slots
    // render before the footer.
    expect(help?.baseOrder["hooked"]).toEqual(["one", "two", "hooked-footer"])
  })

  it("reports ids passed into the app's own hook", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await writeFile(
      path.join(cwd, "hooks/use-hooked-region.tsx"),
      [
        'import { usePliantRegion } from "@pliantui/react"',
        "",
        'export function useHookedRegion(id = "hooked") {',
        "  return usePliantRegion(id, { one: <p>One</p>, two: <p>Two</p> })",
        "}",
        "",
      ].join("\n")
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["help"]?.baseIds.source).toBe("mounted")
    expect(output.warnings).toContainEqual({
      file: "hooks/use-hooked-region.tsx",
      line: 4,
      message:
        "The id of a region can't be read: the hook's argument id, which isn't followed; write ids and slots inside the hook.",
    })
  })

  it("stops at components that wrap each other", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await writeFile(
      path.join(cwd, "components/cycle.tsx"),
      [
        'import { memo } from "react"',
        "",
        "export const A = memo(B)",
        "const B = memo(A)",
        "",
      ].join("\n")
    )
    await edit(
      cwd,
      "app/help/page.tsx",
      "<HookedPanel />",
      "<HookedPanel />\n      <A />"
    )
    await edit(
      cwd,
      "app/help/page.tsx",
      'import { HookedPanel } from "@/components/hooked-panel"',
      'import { A } from "@/components/cycle"\nimport { HookedPanel } from "@/components/hooked-panel"'
    )
    const { exitCode } = await runCli(cwd, ["scan"])

    expect(exitCode).toBe(0)
  })

  it("treats only the app folder's layouts as App Router layouts", async () => {
    const outer = await createFixtureDirectory("scan-nested")
    // The project sits in a folder named app, which isn't its app folder.
    const { output } = await scanJson(path.join(outer, "app/project"))

    expect(output.inventory["shell"]?.baseIds).toEqual({
      ids: [],
      source: "mounted",
    })
    expect(output.warnings.map((warning) => warning.file)).toEqual([
      "components/shell/layout.tsx",
      "views/home.tsx",
    ])
  })

  it("marks a layout's surface as not read in full when a route can't be read", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await writeFile(
      path.join(cwd, "app/(shop)/account/page.tsx"),
      [
        "export default makePage()",
        "",
        "function makePage() {",
        "  return function AccountPage() {",
        "    return <p>Account</p>",
        "  }",
        "}",
        "",
      ].join("\n")
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["shop"]?.baseIds.source).toBe("mounted")
    expect(output.warnings).toContainEqual({
      file: "app/(shop)/account/page.tsx",
      line: 1,
      message:
        "The default export of this route can't be read as a component, so its nodes are in no inventory.",
    })
  })

  it("marks the surfaces that may render what it can't reach", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await writeFile(
      path.join(cwd, "components/unused-panel.tsx"),
      [
        'import { PliantRegion } from "@/components/pliant/pliant-region"',
        "",
        "export function UnusedPanel() {",
        '  return <PliantRegion id="unused" slots={{ first: <p>First</p> }} />',
        "}",
        "",
      ].join("\n")
    )
    const { output } = await scanJson(cwd)

    expect(output.warnings).toContainEqual({
      file: "components/unused-panel.tsx",
      line: 4,
      message:
        "<PliantRegion> isn't rendered under a PliantRoot the scan can follow, so it's in no inventory.",
    })
    // No surface renders that file, so any of them might.
    expect(
      Object.values(output.inventory).map(({ baseIds }) => baseIds.source)
    ).toEqual(["mounted", "mounted", "mounted", "mounted", "mounted"])
  })

  it("marks only the surface that renders the file of what it can't reach", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "app/help/page.tsx",
      "export default function HelpPage() {",
      'const unused = <PliantRegion id="unused" slots={{ a: <p>A</p> }} />\n\nexport default function HelpPage() {'
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["help"]?.baseIds.source).toBe("mounted")
    expect(output.inventory["/orders"]?.baseIds.source).toBe("inventory")
    expect(output.inventory["shop"]?.baseIds.source).toBe("inventory")
  })

  it("lists in baseOrder only what baseParents lists, with the same parents", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)

    for (const { baseParents, baseOrder } of Object.values(output.inventory)) {
      for (const [parent, children] of Object.entries(baseOrder)) {
        expect(Object.keys(baseParents)).toContain(parent)
        for (const child of children) {
          expect(baseParents[child]).toBe(parent)
        }
      }
    }
    // nested sits in a slot of a region whose id can't be read, so the slot
    // has no known parent and holds nothing in baseOrder.
    const reports = output.inventory["reports"]
    expect(reports?.baseParents["nested"]).toBe("first")
    expect(reports?.baseOrder).toEqual({
      nested: ["deep"],
      overview: ["summary"],
    })
  })

  it("warns about children it can't see instead of listing nothing", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)

    expect(output.inventory["settings"]?.baseIds).toEqual({
      ids: [],
      source: "mounted",
    })
    expect(output.warnings).toContainEqual({
      file: "components/providers.tsx",
      line: 6,
      message:
        "Content passed as children isn't followed, so the nodes in it are in no inventory.",
    })
  })

  it("gives core's resolveLayers what it needs", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await runCli(cwd, ["scan"])
    const inventory = await readInventory(cwd)

    const resolve = (surface: string, target: string, into: string) =>
      resolveLayers(
        [overlay(surface, [{ op: "move", target, to: { into } }])],
        { surface, ...inventory[surface] }
      ).unapplied.map((op) => op.reason)

    expect(resolve("/orders", "page/slots/details", "summary")).toEqual([])
    expect(resolve("/orders", "page/slots/details", "sidebar")).toEqual([
      "missing-container",
    ])
    // A surface the scan couldn't read in full may have nodes it missed.
    expect(resolve("reports", "overview/slots/summary", "sidebar")).toEqual([
      "dormant",
    ])
  })

  it("reports what it can't read instead of guessing", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(0)
    expect(output.inventory["reports"]?.baseIds).toEqual({
      ids: [
        "body",
        "deep",
        "first",
        "nested",
        "overview",
        "reports-table",
        "summary",
      ],
      source: "mounted",
    })
    // The regions whose ids can't be read have no known parent for their
    // slots.
    expect(output.inventory["reports"]?.baseParents).toEqual({
      nested: "first",
      deep: "nested",
      overview: null,
      summary: "overview",
      "reports-table": null,
    })
    expect(
      output.warnings.map(
        ({ file, line, message }) => `${file}:${String(line)} ${message}`
      )
    ).toEqual([
      "components/providers.tsx:6 Content passed as children isn't followed, so the nodes in it are in no inventory.",
      'app/orders/columns.tsx:22 The column "2fa" of orders-table is left out: overlays can only address column ids that start with a letter and contain only letters, digits, - and _.',
      "app/reports/page.tsx:38 A slot of overview can't be read: the computed key [`${prefix}-total`].",
      "app/reports/page.tsx:39 A slot of overview can't be read: the spread ...extra.",
      "app/reports/page.tsx:44 The id of a region can't be read: regionId().",
      "app/reports/page.tsx:50 The id of a region can't be read: chart.",
      "app/reports/page.tsx:19 A column of reports-table can't be read: the columns fields.map((field) => ({ accessorKey:....",
    ])
  })

  it("rejects a slot id that starts with a digit", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "app/orders/order-details.tsx",
      "address: <p>",
      '"2024": <p>'
    )
    const { stdout, exitCode } = await runCli(cwd, ["scan"])

    expect(exitCode).toBe(1)
    expect(stdout).toContain(
      'app/orders/order-details.tsx:20 The slot "2024" in shipping starts with a digit.'
    )
    expect(existsSync(path.join(cwd, inventoryFile))).toBe(false)
  })

  it("rejects a region id that starts with a digit", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(cwd, "app/orders/page.tsx", 'id="page"', 'id="1st-page"')
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(1)
    expect(output.written).toBe(false)
    expect(output.errors.map((error) => error.message)).toEqual([
      'The region id "1st-page" starts with a digit. Node ids must start with a letter.',
    ])
  })

  it("rejects a node id used in two places", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(cwd, "app/orders/page.tsx", 'id="page"', 'id="shipping"')
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(1)
    expect(output.errors.map((error) => error.message)).toContain(
      "shipping is rendered in both the top of the surface and details on /orders. Node ids must be unique on a surface."
    )
  })

  it("records what each id is, so a change of kind shows", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await runCli(cwd, ["scan"])
    const before = (await readInventory(cwd))["/orders"]?.ids ?? {}
    // The badge in the status slot gets a manifest, so its kind changes.
    await runCli(cwd, ["manifest", "--yes"])
    await runCli(cwd, ["scan"])
    const after = (await readInventory(cwd))["/orders"]?.ids ?? {}

    expect(before["status"]).toEqual(before["address"])
    expect(after["status"]?.kind).toBe("app:badge")
    expect(after["status"]?.hash).not.toBe(before["status"]?.hash)
    expect(after["address"]).toEqual(before["address"])
    expect(after["page"]?.hash).not.toBe(after["address"]?.hash)
    expect(after["orders-table"]?.hash).not.toBe(after["page"]?.hash)
  })

  it("says when a layout's surface spans the pages that reuse an id", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(cwd, "app/(shop)/page.tsx", 'id="shop-home"', 'id="gallery"')
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(1)
    expect(output.errors.map((error) => error.message)).toContain(
      "gallery is rendered in both the top of the surface and details on shop. Node ids must be unique on a surface. shop is rendered by a layout, so it spans every page under that layout."
    )
  })

  it("says with --json whether it wrote the file", async () => {
    const cwd = await createFixtureDirectory("scan-app")

    expect((await scanJson(cwd)).output.written).toBe(true)
    expect((await scanJson(cwd)).output.written).toBe(false)
  })

  describe("--check", () => {
    it("passes when the inventory is up to date", async () => {
      const cwd = await createFixtureDirectory("scan-app")
      await runCli(cwd, ["scan"])
      const { stdout, exitCode } = await runCli(cwd, ["scan", "--check"])

      expect(exitCode).toBe(0)
      expect(stdout).toContain(`${inventoryFile} is up to date.`)
    })

    it("fails when the inventory is out of date, without writing it", async () => {
      const cwd = await createFixtureDirectory("scan-app")
      await runCli(cwd, ["scan"])
      const saved = await readFile(path.join(cwd, inventoryFile), "utf8")
      await edit(cwd, "app/orders/order-details.tsx", "invoice:", "receipt:")
      const { stdout, exitCode } = await runCli(cwd, ["scan", "--check"])

      expect(exitCode).toBe(1)
      expect(stdout).toContain(`${inventoryFile} is out of date.`)
      expect(await readFile(path.join(cwd, inventoryFile), "utf8")).toBe(saved)
    })

    it("fails when there is no inventory", async () => {
      const cwd = await createFixtureDirectory("scan-app")
      const { output, exitCode } = await scanJson(cwd, "--check")

      expect(exitCode).toBe(1)
      expect(output.upToDate).toBe(false)
      expect(existsSync(path.join(cwd, inventoryFile))).toBe(false)
    })
  })
})
