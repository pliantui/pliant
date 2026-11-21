import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"

import {
  createFixtureDirectory,
  removeFixtureDirectories,
  runCli,
} from "./helpers"

afterAll(removeFixtureDirectories)

interface Check {
  name: string
  status: "pass" | "warn" | "fail" | "skip"
  message: string
  fix?: string
  problems?: { file: string; line: number; message: string }[]
}

async function doctor(cwd: string) {
  const { stdout, exitCode } = await runCli(cwd, ["doctor", "--json"])
  const output = JSON.parse(stdout) as { ok: boolean; checks: Check[] }
  const check = (name: string) => {
    const found = output.checks.find((item) => item.name === name)
    if (!found) {
      throw new Error(`doctor printed no ${name} check.`)
    }
    return found
  }
  return { ...output, exitCode, check }
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

// A project with an up-to-date inventory, as after `pliantui scan`.
async function scannedApp() {
  const cwd = await createFixtureDirectory("doctor-app")
  const { exitCode } = await runCli(cwd, ["scan"])
  expect(exitCode).toBe(0)
  return cwd
}

describe("pliantui doctor", () => {
  it("passes in a project that is set up", async () => {
    const cwd = await scannedApp()
    const result = await doctor(cwd)
    expect(result.exitCode).toBe(0)
    expect(result.ok).toBe(true)
    expect(
      Object.fromEntries(
        result.checks.map((check) => [check.name, check.status])
      )
    ).toEqual({
      project: "pass",
      "react-package": "pass",
      "components-json": "pass",
      components: "pass",
      "pre-paint": "pass",
      inventory: "pass",
      manifests: "skip",
    })
    expect(result.check("components").message).toContain("pliant-region")
  })

  it("prints each check with how to fix what fails", async () => {
    const cwd = await createFixtureDirectory("doctor-app")
    const { stdout, exitCode } = await runCli(cwd, ["doctor"])
    expect(exitCode).toBe(1)
    expect(stdout).toContain("✔ Next.js App Router project.")
    expect(stdout).toContain("✖ lib/pliant/inventory.generated.ts is missing.")
    expect(stdout).toContain("Run npx pliantui scan and commit the result.")
    expect(stdout).toContain("1 failed.")
  })

  describe("setup", () => {
    it("fails outside a Next.js App Router project", async () => {
      const cwd = await scannedApp()
      await rm(path.join(cwd, "app"), { recursive: true })
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("project")).toMatchObject({
        status: "fail",
        message: expect.stringContaining("Pages Router") as unknown,
      })
    })

    it("fails without @pliantui/react", async () => {
      const cwd = await scannedApp()
      await edit(cwd, "package.json", '"@pliantui/react": "^0.0.1",', "")
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("react-package")).toMatchObject({
        status: "fail",
        fix: "Run npx pliantui init.",
      })
    })

    it("fails without components.json and skips what needs it", async () => {
      const cwd = await scannedApp()
      await rm(path.join(cwd, "components.json"))
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("components-json")).toMatchObject({
        status: "fail",
        fix: "Run npx shadcn@latest init to create one.",
      })
      for (const name of ["components", "pre-paint", "inventory"]) {
        expect(result.check(name).status).toBe("skip")
      }
    })

    it("warns when no Pliant components were added", async () => {
      const cwd = await scannedApp()
      await rm(path.join(cwd, "components/pliant/pliant-region.tsx"))
      const result = await doctor(cwd)
      expect(result.check("components")).toMatchObject({
        status: "warn",
        message: "No Pliant components found in components/pliant.",
      })
    })
  })

  describe("pre-paint", () => {
    it("fails when a page's PliantRoot renders no PliantPrePaint", async () => {
      const cwd = await scannedApp()
      await edit(
        cwd,
        "app/orders/page.tsx",
        "<PliantPrePaint surface={surface} />",
        ""
      )
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("pre-paint")).toMatchObject({
        status: "fail",
        problems: [
          {
            file: path.normalize("app/orders/page.tsx"),
            line: 10,
            message:
              "PliantRoot renders /orders with no PliantPrePaint in this route.",
          },
        ],
      })
    })

    it("fails when PliantPrePaint renders another surface", async () => {
      const cwd = await scannedApp()
      await edit(
        cwd,
        "app/orders/page.tsx",
        "<PliantPrePaint surface={surface} />",
        '<PliantPrePaint surface="/order" />'
      )
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("pre-paint").problems).toEqual([
        expect.objectContaining({
          message:
            "PliantRoot renders /orders, but the PliantPrePaint in app/orders/page.tsx renders /order.",
          status: "fail",
        }),
      ])
    })

    it("finds PliantPrePaint in a layout above the page", async () => {
      const cwd = await scannedApp()
      expect((await doctor(cwd)).check("pre-paint").status).toBe("pass")
      await edit(
        cwd,
        "app/reports/layout.tsx",
        '<PliantPrePaint surface="/reports" />',
        ""
      )
      const result = await doctor(cwd)
      expect(result.check("pre-paint")).toMatchObject({
        status: "fail",
        problems: [
          expect.objectContaining({
            file: path.normalize("app/reports/page.tsx"),
          }),
        ],
      })
    })

    it("warns when PliantPrePaint is in a page below a layout's PliantRoot", async () => {
      const cwd = await scannedApp()
      await writeFile(
        path.join(cwd, "app/reports/layout.tsx"),
        [
          'import { PliantRoot } from "@pliantui/react"',
          "",
          "export default function ReportsLayout({",
          "  children,",
          "}: {",
          "  children: React.ReactNode",
          "}) {",
          '  return <PliantRoot surface="/reports">{children}</PliantRoot>',
          "}",
          "",
        ].join("\n")
      )
      await writeFile(
        path.join(cwd, "app/reports/page.tsx"),
        [
          'import { PliantPrePaint } from "@pliantui/react/pre-paint"',
          "",
          "export default function ReportsPage() {",
          '  return <PliantPrePaint surface="/reports" />',
          "}",
          "",
        ].join("\n")
      )
      const result = await doctor(cwd)
      expect(result.check("pre-paint")).toMatchObject({
        status: "warn",
        problems: [
          {
            file: path.normalize("app/reports/layout.tsx"),
            line: 8,
            status: "warn",
            message: expect.stringContaining(
              path.normalize("app/reports/page.tsx")
            ) as unknown,
          },
        ],
      })
    })

    it("warns when PliantPrePaint is in one of the app's components", async () => {
      const cwd = await scannedApp()
      await writeFile(
        path.join(cwd, "components/reports-head.tsx"),
        [
          'import { PliantPrePaint } from "@pliantui/react/pre-paint"',
          "",
          "export function ReportsHead() {",
          '  return <PliantPrePaint surface="/reports" />',
          "}",
          "",
        ].join("\n")
      )
      await writeFile(
        path.join(cwd, "app/reports/layout.tsx"),
        [
          'import { ReportsHead } from "@/components/reports-head"',
          "",
          "export default function ReportsLayout({",
          "  children,",
          "}: {",
          "  children: React.ReactNode",
          "}) {",
          "  return (",
          "    <>",
          "      <ReportsHead />",
          "      {children}",
          "    </>",
          "  )",
          "}",
          "",
        ].join("\n")
      )
      const result = await doctor(cwd)
      expect(result.check("pre-paint")).toMatchObject({
        status: "warn",
        problems: [
          {
            file: path.normalize("app/reports/page.tsx"),
            status: "warn",
            message: expect.stringContaining(
              path.normalize("components/reports-head.tsx")
            ) as unknown,
          },
        ],
      })
    })

    it("warns when it can't tell which routes render a PliantRoot", async () => {
      const cwd = await createFixtureDirectory("doctor-app")
      await mkdir(path.join(cwd, "components"), { recursive: true })
      await writeFile(
        path.join(cwd, "components/orders-shell.tsx"),
        [
          'import { PliantRoot } from "@pliantui/react"',
          "",
          "export function OrdersShell({ children }: { children: React.ReactNode }) {",
          '  return <PliantRoot surface="/orders">{children}</PliantRoot>',
          "}",
          "",
        ].join("\n")
      )
      expect((await runCli(cwd, ["scan"])).exitCode).toBe(0)
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(0)
      expect(result.check("pre-paint")).toMatchObject({
        status: "warn",
        problems: [
          expect.objectContaining({
            file: path.normalize("components/orders-shell.tsx"),
          }),
        ],
      })
    })

    it("warns when a PliantRoot's surface can't be read", async () => {
      const cwd = await scannedApp()
      await edit(
        cwd,
        "app/reports/page.tsx",
        '<PliantRoot surface="/reports">',
        "<PliantRoot surface={String(Date.now())}>"
      )
      const result = await doctor(cwd)
      expect(result.check("pre-paint")).toMatchObject({
        status: "warn",
        problems: [
          expect.objectContaining({
            message:
              "The surface of this PliantRoot can't be read, so its PliantPrePaint can't be matched.",
          }),
        ],
      })
    })
  })

  describe("inventory", () => {
    it("fails when the inventory is out of date", async () => {
      const cwd = await scannedApp()
      await edit(
        cwd,
        "app/orders/page.tsx",
        "status: <p>Status</p>",
        "status: <p>Status</p>, notes: <p>Notes</p>"
      )
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("inventory")).toMatchObject({
        status: "fail",
        message: "lib/pliant/inventory.generated.ts is out of date.",
      })
    })

    it("fails when the scan finds an error", async () => {
      const cwd = await scannedApp()
      await edit(cwd, "app/orders/page.tsx", 'id="summary"', 'id="Summary"')
      const result = await doctor(cwd)
      expect(result.exitCode).toBe(1)
      expect(result.check("inventory")).toMatchObject({
        status: "fail",
        problems: [
          expect.objectContaining({
            message: expect.stringContaining('"Summary"') as unknown,
          }),
        ],
      })
    })
  })

  it("prints an error as JSON with --json", async () => {
    const cwd = await createFixtureDirectory("doctor-app")
    const { stdout, exitCode } = await runCli(cwd, [
      "doctor",
      "--json",
      "--cwd",
      "missing",
    ])
    expect(exitCode).toBe(1)
    expect(JSON.parse(stdout)).toEqual({
      ok: false,
      error: expect.stringContaining("does not exist") as unknown,
    })
  })

  it("notes manifests without checking them", async () => {
    const cwd = await scannedApp()
    await writeFile(
      path.join(cwd, "lib/pliant/manifests.generated.ts"),
      "export const manifests = {}\n"
    )
    const result = await doctor(cwd)
    expect(result.check("manifests")).toMatchObject({
      status: "skip",
      message:
        "Found lib/pliant/manifests.generated.ts. Whether it's up to date isn't checked.",
    })
  })
})
