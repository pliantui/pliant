import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { execa } from "execa"
import { afterAll, describe, expect, it } from "vitest"

import { loadOverlay, resolveLayers, validateOverlay } from "@pliantui/core"

import {
  createFixtureDirectory,
  removeFixtureDirectories,
  runCli,
} from "./helpers"

afterAll(removeFixtureDirectories)

const typescriptCli = createRequire(import.meta.url).resolve(
  "typescript/bin/tsc"
)

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

function overlayInput(surface: string, ops: unknown[]) {
  return {
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R7S800",
    surface,
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  }
}

function overlay(surface: string, ops: unknown[]) {
  const result = loadOverlay(overlayInput(surface, ops))
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

  it("places each region from one hook where its own member renders", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("inventory")
    // useTwoRegions returns { a, b }: both regions keep their slots. A
    // region renders no element of its own, so the banner the component
    // renders between both.a and both.b sits in the slot that holds the
    // component, between the two regions.
    expect(help?.baseOrder["two-a"]).toEqual(["a1"])
    expect(help?.baseOrder["two-b"]).toEqual(["b1"])
    expect(help?.baseOrder["pair"]).toEqual(["two-a", "two-banner", "two-b"])
  })

  it("places a region and a table where the component renders each", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    // The table is rendered by passing it to <Grid table={table} />.
    expect(help?.baseOrder["mixed"]).toEqual([
      "mixed-banner",
      "mixed-region",
      "mixed-table",
    ])
    expect(help?.baseParents["mixed-table"]).toBe("mixed")
    expect(help?.baseOrder["tables"]).toEqual([
      "table-two",
      "tables-banner",
      "table-one",
    ])
  })

  it("puts a region in the node it's rendered in", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    // inner-a renders inside the card-body slot of another region.
    expect(help?.baseParents["inner-a"]).toBe("card-body")
    expect(help?.baseOrder["card-body"]).toEqual(["inner-a"])
    expect(help?.baseOrder["nested"]).toEqual(["card", "inner-b"])
  })

  // Each puts a use of both.b before the banner, where it renders only if
  // the scan counts it.
  it.each([
    {
      name: "JSX made in an effect",
      statement:
        "React.useEffect(() => {\n    show(<Peek region={both.b} />)\n  }, [both])",
      before: "",
    },
    {
      name: "JSX made in an event handler",
      statement: "",
      before:
        '<button type="button" onClick={() => show(<Peek region={both.b} />)} />',
    },
    {
      name: "a prop of an HTML element",
      statement: "",
      before: "<div data-region={both.b} />",
    },
    {
      name: "a read of a list's length",
      statement: "",
      before: "{both.b.entries.length}",
    },
    {
      name: "an event handler prop of a component",
      statement: "",
      before: "<Peek onPick={() => both.b.entries} />",
    },
    {
      name: "JSX returned by a function the component never renders",
      statement:
        "const onOpen = () => {\n    return <Peek region={both.b} />\n  }\n  React.useDebugValue(onOpen)",
      before: "",
    },
  ])("doesn't count $name as rendering", async ({ statement, before }) => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/two-panel.tsx",
      "  React.useDebugValue(show)",
      `  React.useDebugValue(show)\n  ${statement}`
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      "      <Peek />",
      `      <Peek />\n      ${before}`
    )
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("inventory")
    expect(help?.baseOrder["pair"]).toEqual(["two-a", "two-banner", "two-b"])
  })

  it("counts what a portal renders where the component renders it", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/two-panel.tsx",
      "      <Peek />",
      [
        "      <Peek />",
        "      {createPortal(",
        "        <>",
        "          <Peek region={both.b} />",
        '          <PliantRegion id="portaled" slots={{ inside: <p>In</p> }} />',
        "        </>,",
        "        document.body",
        "      )}",
      ].join("\n")
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      'import * as React from "react"',
      'import * as React from "react"\nimport { createPortal } from "react-dom"'
    )
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("inventory")
    expect(help?.baseOrder["pair"]).toEqual([
      "two-b",
      "portaled",
      "two-a",
      "two-banner",
    ])
    expect(help?.baseOrder["portaled"]).toEqual(["inside"])
  })

  // Each renders both.b before both.a through a different rendering path.
  it.each([
    {
      name: "a useMemo callback",
      statement:
        "const early = React.useMemo(() => <Peek region={both.b} />, [both])",
      before: "{early}",
    },
    {
      name: "a named .map callback",
      statement:
        "function renderEarly() {\n    return <Peek region={both.b} />\n  }",
      before: '{["early"].map(renderEarly)}',
    },
  ])("follows $name", async ({ statement, before }) => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/two-panel.tsx",
      "  React.useDebugValue(show)",
      `  React.useDebugValue(show)\n  ${statement}`
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      "      <Peek />",
      `      <Peek />\n      ${before}`
    )
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("inventory")
    expect(help?.baseOrder["pair"]).toEqual(["two-b", "two-a", "two-banner"])
  })

  it("warns about a component that renders a region where the scan can't follow", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    // ItemList declares no region itself: it renders a PliantRegion. Passed
    // through context, it isn't rendered anywhere the scan follows.
    await edit(
      cwd,
      "components/two-panel.tsx",
      "  React.useDebugValue(show)",
      [
        "  React.useDebugValue(show)",
        "  const Context = React.createContext<React.ReactNode>(null)",
        "  React.useDebugValue(",
        "    <Context.Provider value={<ItemList items={[]} renderItem={() => null} />} />",
        "  )",
      ].join("\n")
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      'import { PliantRegion } from "@/components/pliant/pliant-region"',
      'import { ItemList } from "@/components/item-list"\nimport { PliantRegion } from "@/components/pliant/pliant-region"'
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["help"]?.baseIds.source).toBe("mounted")
    expect(output.warnings).toContainEqual(
      expect.objectContaining({
        file: "components/two-panel.tsx",
        message:
          "<ItemList> isn't rendered under a PliantRoot the scan can follow, so it's in no inventory.",
      })
    )
  })

  it("counts a spread into a component's props as passing the value on", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/two-panel.tsx",
      "      <Peek />",
      "      <Peek />\n      <Peek {...both.b} />"
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["help"]?.baseOrder["pair"]).toEqual([
      "two-b",
      "two-a",
      "two-banner",
    ])
  })

  it("doesn't place a lone region only rendered in an effect", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/destructured-panel.tsx",
      "const { entries } = usePliantRegion(",
      "const region = usePliantRegion("
    )
    await edit(
      cwd,
      "components/destructured-panel.tsx",
      "  return (",
      "  useEffect(() => {\n    console.log(<i>{region.entries.length}</i>, <b>{region.entries}</b>)\n  }, [region])\n  return ("
    )
    await edit(
      cwd,
      "components/destructured-panel.tsx",
      "{entries.map(",
      "{[].map("
    )
    await edit(
      cwd,
      "components/destructured-panel.tsx",
      'import { usePliantRegion } from "@pliantui/react/region"',
      'import { useEffect } from "react"\n\nimport { usePliantRegion } from "@pliantui/react/region"'
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["help"]?.baseIds.source).toBe("mounted")
    expect(output.warnings.map((warning) => warning.message)).toContain(
      "Where DestructuredPanel renders destructured can't be told, so its place among its other nodes isn't known."
    )
  })

  it("places regions destructured from one hook where each renders", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/two-panel.tsx",
      "const both = useTwoRegions()",
      "const { a, b } = useTwoRegions()"
    )
    await edit(cwd, "components/two-panel.tsx", "both.a.entries", "a.entries")
    await edit(cwd, "components/two-panel.tsx", "both.b.entries", "b.entries")
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("inventory")
    expect(help?.baseOrder["pair"]).toEqual(["two-a", "two-banner", "two-b"])
  })

  it("warns about regions a hook returns in an array", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "hooks/use-two-regions.tsx",
      "return { a, b }",
      "return [a, b] as const"
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      "const both = useTwoRegions()",
      "const [first, second] = useTwoRegions()"
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      "both.a.entries",
      "first.entries"
    )
    await edit(
      cwd,
      "components/two-panel.tsx",
      "both.b.entries",
      "second.entries"
    )
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("mounted")
    expect(help?.baseParents["a1"]).toBe("two-a")
    expect(help?.baseParents["b1"]).toBe("two-b")
    expect(output.warnings).toContainEqual({
      file: "components/two-panel.tsx",
      line: 21,
      message:
        "Where TwoPanel renders two-a and two-b can't be told, so their place among its other nodes isn't known.",
    })
  })

  it("places the slots of a destructured region where they render", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    // `const { entries } = usePliantRegion(…)`.
    expect(help?.baseOrder["destructured"]).toEqual([
      "d1",
      "d2",
      "destructured-footer",
    ])
  })

  it("places the slots of a region destructured from its variable", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/destructured-panel.tsx",
      "const { entries } = usePliantRegion(",
      "const region = usePliantRegion("
    )
    await edit(
      cwd,
      "components/destructured-panel.tsx",
      "  return (",
      "  const { entries } = region\n  return ("
    )
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("inventory")
    expect(help?.baseOrder["destructured"]).toEqual([
      "d1",
      "d2",
      "destructured-footer",
    ])
  })

  it("warns when it can't tell where a region's slots render", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "components/two-panel.tsx",
      "{both.b.entries.map(",
      "{[].map("
    )
    const { output } = await scanJson(cwd)
    const help = output.inventory["help"]

    expect(help?.baseIds.source).toBe("mounted")
    // The slots are still listed.
    expect(help?.baseParents["b1"]).toBe("two-b")
    expect(output.warnings).toContainEqual({
      file: "components/two-panel.tsx",
      line: 21,
      message:
        "Where TwoPanel renders two-b can't be told, so its place among its other nodes isn't known.",
    })
  })

  it("reports ids passed into the app's own hook", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await writeFile(
      path.join(cwd, "hooks/use-hooked-region.tsx"),
      [
        'import { usePliantRegion } from "@pliantui/react/region"',
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
    // Core checks baseIds, baseParents and baseOrder against each other.
    for (const [surface, entry] of Object.entries(inventory)) {
      expect(() => resolveLayers([], { surface, ...entry })).not.toThrow()
      expect(
        validateOverlay(overlayInput(surface, [{ op: "hide", target: "x" }]), {
          layers: { overlays: [], surface, ...entry },
        }).success
      ).toBe(true)
    }
  })

  it("type-checks as core's options", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await runCli(cwd, ["scan"])
    await writeFile(
      path.join(cwd, "lib/pliant/use-inventory.ts"),
      [
        'import { resolveLayers, validateOverlay } from "@pliantui/core"',
        "",
        'import { inventory } from "./inventory.generated"',
        "",
        'const { baseIds, baseParents, baseOrder } = inventory["/orders"]',
        "",
        "export const resolved = resolveLayers([], {",
        '  surface: "/orders",',
        "  baseIds,",
        "  baseParents,",
        "  baseOrder,",
        "})",
        "",
        "export const validated = validateOverlay(null, {",
        '  layers: { overlays: [], surface: "shop", ...inventory.shop },',
        "})",
        "",
      ].join("\n")
    )
    const result = await execa(
      "node",
      [
        typescriptCli,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--module",
        "esnext",
        "--moduleResolution",
        "bundler",
        "--target",
        "es2022",
        "--ignoreConfig",
        path.join(cwd, "lib/pliant/use-inventory.ts"),
      ],
      { reject: false }
    )

    expect(result.stdout).toBe("")
    expect(result.exitCode).toBe(0)
  })

  it("leaves out a region a table renders in each row", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await edit(
      cwd,
      "app/orders/columns.tsx",
      'columnHelper.display({ id: "actions", cell: () => <RowActions /> })',
      '{ id: "actions", cell: () => <PliantRegion id="row-tools" slots={{ edit: <p>Edit</p> }} /> }'
    )
    await edit(
      cwd,
      "app/orders/columns.tsx",
      "columns = columnHelper.columns([",
      "columns = ["
    )
    await edit(cwd, "app/orders/columns.tsx", "\n])", "\n]")
    await edit(
      cwd,
      "app/orders/columns.tsx",
      'import { RowActions } from "@/components/row-actions"',
      'import { PliantRegion } from "@/components/pliant/pliant-region"'
    )
    const { output } = await scanJson(cwd)
    const orders = output.inventory["/orders"]

    expect(orders?.baseIds.source).toBe("mounted")
    expect(orders?.baseIds.ids).not.toContain("row-tools")
    // The columns are read, so the reference to them isn't reported.
    expect(
      output.warnings.filter(({ message }) => message.startsWith("columns "))
    ).toEqual([])
    expect(
      output.warnings
        .filter(({ file }) => file === "app/orders/columns.tsx")
        .map(({ message }) => message)
    ).toEqual([
      "<PliantRegion> renders a region or table once per row or item here, so its id isn't unique and it's left out of /orders.",
      'The column "2fa" of orders-table is left out: overlays can only address column ids that start with a letter and contain only letters, digits, - and _.',
    ])
  })

  it("reports what it can't read instead of guessing", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(0)
    expect(output.inventory["reports"]?.baseIds).toEqual({
      ids: ["deep", "first", "nested", "overview", "reports-table", "summary"],
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
      'app/orders/columns.tsx:24 The column "2fa" of orders-table is left out: overlays can only address column ids that start with a letter and contain only letters, digits, - and _.',
      "app/reports/page.tsx:38 A slot of overview can't be read: the computed key [`${prefix}-total`].",
      "app/reports/page.tsx:39 A slot of overview can't be read: the spread ...extra.",
      "app/reports/page.tsx:44 The id of a region can't be read: regionId().",
      // A region rendered once per item would repeat its id.
      "app/reports/page.tsx:49 <PliantRegion> renders a region or table once per row or item here, so its id isn't unique and it's left out of reports.",
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

describe("pliantui scan, for what it can't follow", () => {
  it.each([
    {
      name: "twice",
      body: '<>{children}<PliantRegion id="frame" slots={{ body: children }} /></>',
    },
    {
      name: "in either branch",
      body: 'open ? <div>{children}</div> : <PliantRegion id="frame" slots={{ body: children }} />',
    },
  ])("reports children a component renders $name", async ({ body }) => {
    const cwd = await createFixtureDirectory("scan-unfollowed")
    await mkdir(path.join(cwd, "app/children-twice"))
    await writeFile(
      path.join(cwd, "app/children-twice/page.tsx"),
      [
        'import type * as React from "react"',
        "",
        'import { PliantRoot } from "@pliantui/react"',
        "",
        'import { Banner } from "@/components/banner"',
        'import { PliantRegion } from "@/components/pliant/pliant-region"',
        "",
        "function Frame({",
        "  open,",
        "  children,",
        "}: {",
        "  open?: boolean",
        "  children: React.ReactNode",
        "}) {",
        `  return ${body}`,
        "}",
        "",
        "export default function ChildrenTwicePage() {",
        "  return (",
        '    <PliantRoot surface="children-twice">',
        "      <Frame open>",
        "        <Banner />",
        "      </Frame>",
        "    </PliantRoot>",
        "  )",
        "}",
        "",
      ].join("\n")
    )
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(1)
    expect(output.errors.map((error) => error.message)).toContain(
      "banner is rendered in both the top of the surface and body on children-twice. Node ids must be unique on a surface."
    )
  })

  it("follows a context's default value in code it doesn't walk", async () => {
    const cwd = await createFixtureDirectory("scan-unfollowed")
    await writeFile(
      path.join(cwd, "components/panel-context.tsx"),
      [
        'import { createContext, useContext } from "react"',
        "",
        'import { PliantRegion } from "@/components/pliant/pliant-region"',
        "",
        "const PanelContext = createContext(",
        '  <PliantRegion id="context-panel" slots={{ body: <p>Body</p> }} />',
        ")",
        "",
        "export function ShowPanel() {",
        "  return <div>{useContext(PanelContext)}</div>",
        "}",
        "",
      ].join("\n")
    )
    await mkdir(path.join(cwd, "app/context-default"))
    await writeFile(
      path.join(cwd, "app/context-default/page.tsx"),
      [
        'import { Loader } from "fake-loader"',
        "",
        'import { PliantRoot } from "@pliantui/react"',
        "",
        'import { ShowPanel } from "@/components/panel-context"',
        "",
        "export default function ContextDefaultPage() {",
        "  return (",
        '    <PliantRoot surface="context-default">',
        "      <Loader>{() => <ShowPanel />}</Loader>",
        "    </PliantRoot>",
        "  )",
        "}",
        "",
      ].join("\n")
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["context-default"]?.baseIds.source).toBe("mounted")
    expect(output.warnings).toContainEqual({
      file: "app/context-default/page.tsx",
      line: 10,
      message:
        "<ShowPanel> may render a region or table the scan doesn't follow there, so context-default isn't read in full.",
    })
  })

  it("treats a component from a package whose types aren't built as the package's", async () => {
    const cwd = await createFixtureDirectory("scan-unfollowed")
    await mkdir(path.join(cwd, "node_modules/unbuilt-ui"), { recursive: true })
    await writeFile(
      path.join(cwd, "node_modules/unbuilt-ui/package.json"),
      JSON.stringify({
        name: "unbuilt-ui",
        type: "module",
        exports: {
          ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        },
      })
    )
    await edit(
      cwd,
      "app/direct/page.tsx",
      'import { PliantActivity } from "@pliantui/react/region"',
      'import { PliantActivity } from "@pliantui/react/region"\nimport { Card } from "unbuilt-ui"'
    )
    await edit(
      cwd,
      "app/direct/page.tsx",
      "<DefaultBanner />",
      "<Card>\n        <DefaultBanner />\n      </Card>"
    )
    const { output } = await scanJson(cwd)

    expect(output.inventory["direct"]?.baseIds).toEqual({
      ids: ["banner", "body", "message", "panel"],
      source: "inventory",
    })
  })

  // Each surface renders the banner, a component that renders a region, in
  // its own way. The direct surface renders it plainly, so the banner is
  // reached on some surface either way.
  it("places every region a surface renders, or marks the surface", async () => {
    const cwd = await createFixtureDirectory("scan-unfollowed")
    const { output, exitCode } = await scanJson(cwd)

    expect(exitCode).toBe(0)
    const placed = Object.entries(output.inventory)
      .filter(([, { baseIds }]) => baseIds.source === "inventory")
      .map(([surface, { baseIds }]) => [surface, baseIds.ids])
    expect(placed).toEqual([
      // `export default () => <Banner />`.
      ["anonymous-default", ["banner", "message"]],
      // Rendered through a component's `{children}`.
      ["children-frame", ["banner", "message"]],
      // `R.useMemo` under a default import.
      ["default-import-memo", ["banner", "message"]],
      ["direct", ["banner", "body", "message", "panel"]],
      // `renderHidden()` from another file, the one surface that renders it.
      ["helper-rendered", ["hidden", "more"]],
      ["hoc", ["banner", "message"]],
      // `useMemo` from a named import.
      ["named-memo", ["banner", "message"]],
      // An app component in a package's render prop that renders no region.
      ["package-field", ["banner", "message"]],
      ["re-export", ["banner", "message"]],
      ["render-prop", ["banner", "message"]],
      // `renderLevel()` calls itself.
      ["self-render", ["banner", "message"]],
      // An app component in a package's prop, here `fallback`, that renders
      // no region.
      ["suspense-fallback", ["banner", "message"]],
      ["use-callback", ["banner", "message"]],
    ])
    // Everything else is marked, each with what the scan couldn't follow.
    const marked: Record<string, string[]> = {}
    for (const { file, message } of output.warnings) {
      const surface = /so (\S+) isn't read in full\.$/.exec(message)?.[1]
      if (surface) {
        marked[surface] = [
          ...(marked[surface] ?? []),
          `${file} ${message.split(" ")[0] ?? ""}`,
        ]
      }
    }
    expect(marked).toEqual({
      "array-from": ["app/array-from/page.tsx renderRow"],
      "as-prop": ["app/as-prop/page.tsx <As>", "app/as-prop/page.tsx Banner"],
      // A class component isn't walked.
      "class-component": [
        "app/class-component/page.tsx <Panel>",
        "app/class-component/page.tsx Banner",
      ],
      "context-value": ["app/context-value/page.tsx renderBanner"],
      // A member of what `useContext()` returns is the app's own data.
      "context-member": [
        "app/context-member/page.tsx <ui.Banner>",
        "app/context-member/page.tsx UiContext",
      ],
      // What an unwalked render prop renders is followed through every
      // reference: a constant holding a region, a component that renders
      // one, or a helper that renders a component the scan can't follow.
      "constant-in-package-prop": [
        "app/constant-in-package-prop/page.tsx panel",
      ],
      "constant-in-render-prop": ["app/constant-in-render-prop/page.tsx panel"],
      "helper-renders-opaque": ["app/helper-renders-opaque/page.tsx <Section>"],
      "wrapper-in-render-prop": ["app/wrapper-in-render-prop/page.tsx <Wrap>"],
      // JSX in a function the walk doesn't render, like a render prop of a
      // package's component or a context's Consumer, is checked too.
      "context-consumer": ["app/context-consumer/page.tsx <ui.Banner>"],
      "package-render-prop": [
        "app/package-render-prop/page.tsx <grid.meta.Banner>",
      ],
      "package-render-prop-component": [
        "app/package-render-prop-component/page.tsx <MetaBanner>",
      ],
      "render-prop-context": [
        "app/render-prop-context/page.tsx UiContext",
        "app/render-prop-context/page.tsx <ui.Banner>",
      ],
      "context-member-variable": [
        "app/context-member-variable/page.tsx <Picked>",
        "app/context-member-variable/page.tsx useContext(UiContext).Banner",
        "app/context-member-variable/page.tsx UiContext",
      ],
      "create-element": ["app/create-element/page.tsx Banner"],
      // A default value, a wrapper's own output, and a container filled
      // after it's made are followed too.
      "default-prop": ["app/default-prop/page.tsx panel"],
      "map-registry": ["app/map-registry/page.tsx panels.get"],
      "wrapper-adds": ["app/wrapper-adds/page.tsx withPanel"],
      "wrapper-in-package": ["app/wrapper-in-package/page.tsx <Framed>"],
      // A module typed only by the app's own declaration files, here a
      // `.js` file with a `.d.ts` beside it and `declare module "*.mdx"`
      // reached through two aliases, is the app's code.
      "declared-js": ["app/declared-js/page.tsx <Legacy>"],
      "mdx-alias": ["app/mdx-alias/page.tsx <Notes>"],
      "mdx-module": ["app/mdx-module/page.tsx <Notes>"],
      // A component taken from what a function returns.
      "destructured-call": [
        "app/destructured-call/page.tsx <Picked>",
        "app/destructured-call/page.tsx getComponents",
      ],
      "dynamic-tag": [
        "app/dynamic-tag/page.tsx <Frame>",
        "app/dynamic-tag/page.tsx Banner",
      ],
      "factory-call": [
        "app/factory-call/page.tsx <Picked>",
        "app/factory-call/page.tsx pick",
      ],
      "hook-component": [
        "app/hook-component/page.tsx <Picked>",
        "app/hook-component/page.tsx useBannerComponent",
      ],
      // The region renderHidden makes, passed to a package's component, is
      // unwalked here even though PliantRegion is walked for the banner.
      "helper-in-package": ["components/hidden-region.tsx <PliantRegion>"],
      lazy: ['app/lazy/page.tsx import("@/components/helpers")'],
      // The module's default export is `memo(Banner)`.
      "lazy-memo": [
        'app/lazy-memo/page.tsx import("@/components/memo-banner")',
      ],
      // Tree renders itself and the banner.
      recursive: ["app/recursive/page.tsx Tree"],
      registry: [
        "app/registry/page.tsx <Component>",
        "app/registry/page.tsx registry",
        "app/registry/page.tsx Banner",
      ],
      "unrendered-variable": [
        "app/unrendered-variable/page.tsx <Banner>",
        "app/unrendered-variable/page.tsx [banner].map",
        "app/unrendered-variable/page.tsx banner",
      ],
    })
    for (const surface of Object.keys(marked)) {
      expect(output.inventory[surface]?.baseIds.source).toBe("mounted")
    }
  })
})
