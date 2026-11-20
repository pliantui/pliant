import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
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
  hashes: Record<string, string>
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
    expect(Object.keys(inventory)).toEqual(["/orders", "reports"])
    const orders = inventory["/orders"]
    expect(orders?.baseIds).toEqual({
      ids: [
        "address",
        "billing",
        "details",
        "invoice",
        "orders-table",
        "orders-table/columns/actions",
        "orders-table/columns/cents",
        "orders-table/columns/customer_name",
        "orders-table/columns/id",
        "page",
        "refunds",
        "revenue",
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
      // Rendered through a component that passes its children on.
      "orders-table": null,
    })
    expect(Object.keys(orders?.hashes ?? {}).sort()).toEqual(
      orders?.baseIds.ids
    )
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
      ids: ["body", "first", "overview", "reports-table", "summary"],
      source: "mounted",
    })
    // The regions whose ids can't be read have no known parent for their
    // slots.
    expect(output.inventory["reports"]?.baseParents).toEqual({
      overview: null,
      summary: "overview",
      "reports-table": null,
    })
    expect(
      output.warnings.map(
        ({ file, line, message }) => `${file}:${String(line)} ${message}`
      )
    ).toEqual([
      'app/orders/columns.tsx:22 The column "2fa" of orders-table is left out: overlays can only address column ids that start with a letter and contain only letters, digits, - and _.',
      "app/reports/page.tsx:38 A slot of overview can't be read: the computed key [`${prefix}-total`].",
      "app/reports/page.tsx:39 A slot of overview can't be read: the spread ...extra.",
      "app/reports/page.tsx:43 The id of a region can't be read: regionId().",
      "app/reports/page.tsx:45 The id of a region can't be read: chart.",
      "app/reports/page.tsx:19 A column of reports-table can't be read: the columns fields.map((field) => ({ accessorKey:....",
      "components/unused-panel.tsx:4 <PliantRegion> isn't rendered under a PliantRoot the scan can follow, so it's in no inventory.",
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

  it("hashes what each id is, so a change of kind shows", async () => {
    const cwd = await createFixtureDirectory("scan-app")
    await runCli(cwd, ["scan"])
    const before = (await readInventory(cwd))["/orders"]?.hashes ?? {}
    // The badge in the status slot gets a manifest, so its kind changes.
    await runCli(cwd, ["manifest", "--yes"])
    await runCli(cwd, ["scan"])
    const after = (await readInventory(cwd))["/orders"]?.hashes ?? {}

    expect(before["status"]).toBe(before["address"])
    expect(after["status"]).not.toBe(before["status"])
    expect(after["address"]).toBe(before["address"])
    expect(after["page"]).not.toBe(after["address"])
    expect(after["orders-table"]).not.toBe(after["page"])
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
