import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { stripVTControlCharacters } from "node:util"
import prompts from "prompts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { manifest } from "./manifest"

const files: Record<string, string> = {
  "components.json": JSON.stringify({
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
    },
  }),
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      jsx: "react-jsx",
      strict: true,
      paths: { "@/*": ["./*"] },
    },
  }),
  "lib/utils.ts":
    "export const cn = (...classes: string[]) => classes.join(' ')\n",
  "components/ui/button.tsx": `
import { cva } from "class-variance-authority"

const buttonVariants = cva("inline-flex", {
  variants: {
    variant: {
      default: "bg-primary",
      destructive: "bg-destructive",
      link: "underline",
    },
  },
  defaultVariants: { variant: "default" },
})

export function Button({ variant }: { variant?: "default" | "destructive" | "link" }) {
  return <button className={buttonVariants({ variant })} />
}
`,
  "components/ui/panel.tsx": `
export function Panel(props: {
  open?: boolean
  defaultOpen?: boolean
  size?: number
  defaultSize?: number
  value?: string
  defaultValue?: string
}) {
  return <div data-open={props.open ?? props.defaultOpen} />
}
`,
}

class ExitError extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`)
  }
}

let cwd: string
let output: string[]

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "pliantui-manifest-"))
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
    await writeFile(path.join(cwd, file), content)
  }
  output = []
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    output.push(stripVTControlCharacters(args.join(" ")))
  })
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code)
  })
  setTerminal(true)
})

function setTerminal(isTTY: boolean) {
  Object.defineProperty(process.stdin, "isTTY", {
    value: isTTY,
    configurable: true,
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  setTerminal(false)
  await rm(cwd, { recursive: true, force: true })
})

async function run(...args: string[]) {
  await manifest.parseAsync(["--cwd", cwd, ...args], { from: "user" })
}

async function writeTsConfig(paths: Record<string, string[]>) {
  await writeFile(
    path.join(cwd, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { jsx: "react-jsx", paths } })
  )
}

async function readManifests(lib = "lib") {
  const source = await readFile(
    path.join(cwd, lib, "pliant/manifests.generated.ts"),
    "utf8"
  )
  const module = (await import(
    `data:text/javascript,${encodeURIComponent(source)}`
  )) as {
    manifests: Record<
      string,
      { kind: string; capabilities: Record<string, unknown> }
    >
  }
  return module.manifests
}

async function readDecisionsFile(): Promise<unknown> {
  return JSON.parse(
    await readFile(path.join(cwd, "lib/pliant/manifest-decisions.json"), "utf8")
  )
}

describe("pliantui manifest review", () => {
  it("writes what the developer confirms and saves the decisions", async () => {
    prompts.inject([
      true,
      [1, 2, 3],
      10,
      90,
      ["overview", " activity", ""],
      [0],
    ])
    await run()

    const manifests = await readManifests()
    expect(manifests["Button"]?.capabilities["props"]).toEqual({
      variant: {
        values: ["default", "destructive"],
        default: "default",
        semantic: ["destructive"],
      },
    })
    expect(manifests["Panel"]?.capabilities["defaults"]).toEqual({
      defaultOpen: { type: "boolean", persist: true },
      defaultSize: { type: "number", min: 10, max: 90 },
      defaultValue: { values: ["overview", "activity"] },
    })
    expect(manifests["Button"]).toMatchObject({
      kind: "app:button",
      capabilities: { label: true, hideable: true },
    })
    expect(await readDecisionsFile()).toEqual({
      namespace: "app",
      components: {
        Button: {
          props: {
            variant: {
              default: "user",
              destructive: "semantic",
              link: "hidden",
            },
          },
        },
        Panel: {
          defaults: {
            defaultOpen: { class: "user", persist: true },
            defaultSize: { class: "user", min: 10, max: 90 },
            defaultValue: { class: "user", values: ["overview", "activity"] },
          },
        },
      },
    })
    expect(output).toContain(
      "✔ Saved your decisions to lib/pliant/manifest-decisions.json."
    )
  })

  it("keeps saved decisions on the next run", async () => {
    prompts.inject([true, [0, 1], [0]])
    await run()
    const first = await readManifests()

    output = []
    await run("--yes")

    expect(await readManifests()).toEqual(first)
    expect(output.join("\n")).not.toContain("need confirmation")
  })

  it("lets the developer change the inferred classes", async () => {
    prompts.inject([false, [0, 2], [], [0], [1], []])
    await run()

    const manifests = await readManifests()
    expect(manifests["Button"]?.capabilities).toEqual({
      props: { variant: { values: ["default", "link"], default: "default" } },
      label: true,
    })
    expect(manifests["Panel"]).toBeUndefined()
    expect(await readDecisionsFile()).toMatchObject({
      components: {
        Button: { capabilities: { hideable: false } },
        Panel: { capabilities: { label: false } },
      },
    })
  })

  it("writes nothing when the review is cancelled", async () => {
    prompts.inject([new Error("cancelled")])

    await expect(run()).rejects.toEqual(new ExitError(1))
    expect(output).toContain("Review cancelled. Nothing was written.")
    expect(output.join("\n")).not.toContain("Something went wrong")
    await expect(
      readFile(path.join(cwd, "lib/pliant/manifests.generated.ts"))
    ).rejects.toThrow()
  })

  it("skips the review with --yes and leaves out what needs confirmation", async () => {
    await run("--yes")

    const manifests = await readManifests()
    expect(manifests["Button"]?.capabilities["props"]).toEqual({
      variant: {
        values: ["default", "destructive"],
        default: "default",
        semantic: ["destructive"],
      },
    })
    expect(manifests["Panel"]).toBeUndefined()
    expect(output).toContain(
      "1 value and 3 default-state props need confirmation and were left out. Run pliantui manifest without --yes to review them."
    )
    expect(await readDecisionsFile()).toEqual({
      namespace: "app",
      components: {},
    })
  })

  it("namespaces kinds and keeps the namespace on later runs", async () => {
    await run("--yes", "--namespace", "acme")
    expect((await readManifests())["Button"]?.kind).toBe("acme:button")

    await run("--yes")
    expect((await readManifests())["Button"]?.kind).toBe("acme:button")
    expect(await readDecisionsFile()).toMatchObject({ namespace: "acme" })
  })

  it.each(["pliant", "Acme", "acme_ui"])(
    "rejects the namespace %s",
    async (namespace) => {
      await expect(run("--yes", "--namespace", namespace)).rejects.toEqual(
        new ExitError(1)
      )
      expect(output.join("\n")).toContain("namespace")
      await expect(
        readFile(path.join(cwd, "lib/pliant/manifests.generated.ts"))
      ).rejects.toThrow()
    }
  )

  it("asks for --yes when there is no terminal to review in", async () => {
    setTerminal(false)

    await expect(run()).rejects.toEqual(new ExitError(1))
    expect(output).toContain(
      "The review needs an interactive terminal. Run pliantui manifest in one, or pass --yes to use the inferred classes."
    )
    await expect(
      readFile(path.join(cwd, "lib/pliant/manifests.generated.ts"))
    ).rejects.toThrow()
  })

  it("resolves aliases with the longest matching tsconfig path", async () => {
    await writeTsConfig({
      "@/*": ["./src/*"],
      "@/components/*": ["./components/*"],
    })

    await run("--yes")

    expect(Object.keys(await readManifests("src/lib"))).toEqual(["Button"])
  })

  it("tries each tsconfig path target in turn", async () => {
    await writeTsConfig({ "@/*": ["./src/*", "./*"] })

    await run("--yes")

    expect(Object.keys(await readManifests())).toEqual(["Button"])
  })
})
