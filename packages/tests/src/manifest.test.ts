import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, describe, expect, it } from "vitest"

import { manifestSchema } from "@pliantui/contract"

import { createFixtureDirectory, runCli, tempDirectory } from "./helpers"
import { isManifestValid } from "./json-validator"

afterAll(async () => {
  await rm(tempDirectory, { recursive: true, force: true })
})

async function readManifests(cwd: string) {
  const module = (await import(
    pathToFileURL(path.join(cwd, "lib/pliant/manifests.generated.ts")).href
  )) as { manifests: Record<string, unknown> }
  return module.manifests
}

function expectValid(manifests: Record<string, unknown>) {
  for (const manifest of Object.values(manifests)) {
    expect(manifestSchema.safeParse(manifest).success).toBe(true)
    expect(isManifestValid(manifest)).toBe(true)
  }
}

function manifest(
  kind: string,
  description: string,
  capabilities: Record<string, unknown>
) {
  return {
    kind: `app:${kind}`,
    version: 1,
    description,
    capabilities: { ...capabilities, label: true, hideable: true },
  }
}

const buttonSizes = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
]

describe("pliantui manifest", () => {
  it("generates manifests for shadcn components", async () => {
    const cwd = await createFixtureDirectory("next-app")
    const { stdout, exitCode } = await runCli(cwd, ["manifest", "--yes"])

    expect(exitCode).toBe(0)
    const manifests = await readManifests(cwd)
    expectValid(manifests)
    expect(manifests).toEqual({
      Badge: manifest("badge", "Badge", {
        props: {
          variant: {
            values: ["default", "secondary", "destructive", "outline", "ghost"],
            default: "default",
            semantic: ["destructive"],
          },
        },
      }),
      Button: manifest("button", "Button", {
        props: {
          variant: {
            values: ["default", "destructive", "outline", "secondary", "ghost"],
            default: "default",
            semantic: ["destructive"],
          },
          size: { values: buttonSizes, default: "default" },
        },
      }),
      PaginationLink: manifest("pagination-link", "Pagination link", {
        props: { size: { values: buttonSizes, default: "icon" } },
      }),
      PaginationPrevious: manifest(
        "pagination-previous",
        "Pagination previous",
        { props: { size: { values: buttonSizes, default: "default" } } }
      ),
      PaginationNext: manifest("pagination-next", "Pagination next", {
        props: { size: { values: buttonSizes, default: "default" } },
      }),
      TabsList: manifest("tabs-list", "Tabs list", {
        props: { variant: { values: ["default", "line"], default: "default" } },
      }),
      Toggle: manifest("toggle", "Toggle", {
        props: {
          variant: { values: ["default", "outline"], default: "default" },
          size: { values: ["default", "sm", "lg"], default: "default" },
        },
      }),
      ToggleGroup: manifest("toggle-group", "Toggle group", {
        props: {
          variant: { values: ["default", "outline"], default: "default" },
          size: { values: ["default", "sm", "lg"], default: "default" },
        },
      }),
      ToggleGroupItem: manifest("toggle-group-item", "Toggle group item", {
        props: {
          variant: { values: ["default", "outline"], default: "default" },
          size: { values: ["default", "sm", "lg"], default: "default" },
        },
      }),
    })

    expect(stdout).toContain(
      [
        "SheetContent  components/ui/sheet.tsx",
        '  side  from union, default "right"',
        "    needs confirmation   top, right, bottom, left",
        "    right and left are kept as written, so they don't flip in right-to-left layouts.",
      ].join("\n")
    )
    expect(stdout).toContain(
      [
        "Sheet  components/ui/sheet.tsx",
        "  defaultOpen  default state, true or false",
        "    needs confirmation",
      ].join("\n")
    )
    expect(stdout).toContain(
      [
        "ToggleGroup  components/ui/toggle-group.tsx",
        '  variant  from context, default "default"',
      ].join("\n")
    )
    expect(stdout).toContain(
      [
        "ToggleGroupItem  components/ui/toggle-group.tsx",
        '  variant  from cva, default "default"',
        "    user                 default, outline",
        "    a value set on ToggleGroup wins over this one.",
      ].join("\n")
    )
    expect(stdout).toContain(
      "✔ Wrote 9 manifests to lib/pliant/manifests.generated.ts."
    )
    expect(stdout).toContain(
      "6 values and 3 default-state props need confirmation and were left out."
    )
  })

  it("applies the decisions file", async () => {
    const cwd = await createFixtureDirectory("next-app")
    await mkdir(path.join(cwd, "lib/pliant"), { recursive: true })
    await writeFile(
      path.join(cwd, "lib/pliant/manifest-decisions.json"),
      JSON.stringify({
        components: {
          SheetContent: {
            props: {
              side: {
                top: "hidden",
                right: "user",
                bottom: "hidden",
                left: "user",
              },
            },
          },
          Sheet: {
            defaults: { defaultOpen: { class: "user", persist: true } },
          },
          Tabs: {
            defaults: {
              defaultValue: { class: "user", values: ["account", "password"] },
            },
          },
          Button: { props: { variant: { link: "user", ghost: "hidden" } } },
        },
      })
    )

    const { exitCode } = await runCli(cwd, ["manifest", "--yes"])

    expect(exitCode).toBe(0)
    const manifests = await readManifests(cwd)
    expectValid(manifests)
    expect(manifests).toMatchObject({
      Button: {
        capabilities: {
          props: {
            variant: {
              values: [
                "default",
                "destructive",
                "outline",
                "secondary",
                "link",
              ],
            },
          },
        },
      },
      Sheet: {
        capabilities: {
          defaults: { defaultOpen: { type: "boolean", persist: true } },
        },
      },
      SheetContent: {
        capabilities: {
          props: { side: { values: ["right", "left"], default: "right" } },
        },
      },
      Tabs: {
        capabilities: {
          defaults: { defaultValue: { values: ["account", "password"] } },
        },
      },
    })
  })

  it("generates manifests for tailwind-variants components", async () => {
    const cwd = await createFixtureDirectory("tailwind-variants")
    const { stdout, exitCode } = await runCli(cwd, ["manifest", "--yes"])

    expect(exitCode).toBe(0)
    const manifests = await readManifests(cwd)
    expectValid(manifests)
    expect(manifests).toEqual({
      Button: manifest("button", "Button", {
        props: {
          color: {
            values: ["primary", "secondary", "danger"],
            default: "primary",
            semantic: ["danger"],
          },
          size: { values: ["sm", "md", "lg"], default: "md" },
        },
      }),
      ElevatedCard: manifest(
        "elevated-card",
        "A card that sits above the page.",
        {
          props: {
            shadow: { values: ["sm", "md", "lg"], default: "lg" },
            radius: { values: ["sm", "lg"], default: "lg" },
          },
        }
      ),
    })
    expect(stdout).toContain(
      ["  isLoading  from tv", "    state                true"].join("\n")
    )
    expect(stdout).toContain(
      ["  fullWidth  from tv", "    needs confirmation   true"].join("\n")
    )
  })

  it("reports what it can't read instead of guessing", async () => {
    const cwd = await createFixtureDirectory("edge-cases")
    const { stdout, exitCode } = await runCli(cwd, ["manifest", "--yes"])

    expect(exitCode).toBe(0)
    const manifests = await readManifests(cwd)
    expectValid(manifests)
    expect(manifests).toEqual({
      Alert: manifest("alert", "Alert", {
        props: {
          variant: {
            values: ["default", "warning", "destructive"],
            default: "default",
            semantic: ["warning", "destructive"],
          },
        },
      }),
      Banner: manifest("banner", "Banner", {
        props: { tone: { values: ["neutral", "brand"], default: "brand" } },
      }),
      Heading: manifest("heading", "Heading", {
        props: { align: { values: ["start", "center"] } },
      }),
      Segment: manifest("segment", "Segment", {
        props: { fill: { values: ["solid", "soft"], default: "soft" } },
      }),
      Chip: manifest("chip", "Chip", {
        props: {
          tone: { values: ["neutral", "brand"], default: "neutral" },
          size: { values: ["sm", "md", "lg"], default: "md" },
        },
      }),
      Note: manifest("note", "Note", {
        props: { density: { values: ["compact", "cozy"], default: "cozy" } },
      }),
      Panel: manifest("panel", "Panel", {
        props: { padding: { values: ["sm", "lg"] } },
      }),
      Stack: manifest("stack", "Stack", {}),
      Eyebrow: manifest("eyebrow", "Eyebrow", {}),
      Caption: manifest("caption", "Caption", {}),
      Kbd: manifest("kbd", "Kbd", {
        props: { size: { values: ["sm", "md"] } },
      }),
      Mark: manifest("mark", "Mark", {
        props: { tint: { values: ["plain"] } },
      }),
      Ribbon: manifest("ribbon", "Ribbon", {
        props: { corner: { values: ["top", "bottom"] } },
      }),
      RestBox: manifest("rest-box", "Rest box", {
        props: { padding: { values: ["sm", "lg"] } },
      }),
      SpreadBox: manifest("spread-box", "Spread box", {
        props: { padding: { values: ["sm", "lg"] } },
      }),
      Indirect: manifest("indirect", "Indirect", {
        props: { size: { values: ["sm", "lg"] } },
      }),
      Fallback: manifest("fallback", "Fallback", {
        props: { size: { values: ["sm", "lg"], default: "lg" } },
      }),
      Opaque: manifest("opaque", "Opaque", {}),
      Resized: manifest("resized", "Resized", {}),
      Toggle3D: manifest("toggle-3d", "Toggle 3D", {}),
      Grid2x2: manifest("grid-2x2", "Grid 2x2", {
        props: { gap: { values: ["sm", "lg"] } },
      }),
      HTML5Video: manifest("html5-video", "HTML5 video", {
        props: { gap: { values: ["sm", "lg"] } },
      }),
      LooseBox: manifest("loose-box", "Loose box", {
        props: { padding: { values: ["sm", "lg"] } },
      }),
      NestedBox: manifest("nested-box", "Nested box", {}),
      Swapped: manifest("swapped", "Swapped", {}),
      Mutated: manifest("mutated", "Mutated", {}),
      Tracked: manifest("tracked", "Tracked", {
        props: { size: { values: ["sm", "lg"] } },
      }),
      Drawer: manifest("drawer", "Drawer", {}),
      Step10Of12: manifest("step-10-of-12", "Step 10 of 12", {
        props: { gap: { values: ["sm", "lg"] } },
      }),
      Dot: manifest("dot", "Dot", {
        props: { size: { values: ["sm", "lg"] } },
      }),
      Line: manifest("line", "Line", {
        props: { weight: { values: ["thin", "thick"] } },
      }),
      Ring: manifest("ring", "Ring", {
        props: { width: { values: ["thin", "thick"] } },
      }),
      Label: manifest("label", "Label", {}),
      StatusPill: manifest("status-pill", "Status pill", {
        props: {
          severity: { values: ["low", "high"], semantic: ["low", "high"] },
          tone: { values: ["calm", "success"], semantic: ["success"] },
        },
      }),
      SplitButton: manifest("split-button", "Split button", {
        props: { size: { values: ["sm", "md"] } },
      }),
      Tag: manifest("tag", "Tag", {
        props: { shape: { values: ["square", "pill"] } },
      }),
    })

    for (const line of [
      'components/ui/alert.tsx:16 A compound variant of alertVariants refers to variant: "critical", which isn\'t a declared value.',
      "components/ui/alert.tsx:20 A compound variant of alertVariants refers to emphasis, which isn't a declared variant.",
      "components/ui/dynamic.tsx:10 The intent variant of panelVariants can't be read statically:",
      "components/ui/dynamic.tsx:24 The variants of stackVariants can't be read statically: makeConfig() isn't an object literal.",
      "components/ui/tag.tsx:12 The look variant of tagVariants can't be read statically: the computed key [accent].",
      "components/ui/tag.tsx:18 defaultVariants is nested inside the variants of tagVariants, where cva and tv treat it as a variant, so it has no effect. Move it next to variants.",
      "components/ui/eyebrow.tsx:5 cva() here can't be traced to class-variance-authority or tailwind-variants, so its variants aren't read.",
      "components/ui/namespaced.tsx:19 Legacy.cva() here can't be traced to class-variance-authority or tailwind-variants, so its variants aren't read.",
      "components/ui/indirect.tsx:28 The argument to indVariants can't be read statically, so Opaque's props that reach it are left out.",
      [
        "Opaque  components/ui/indirect.tsx",
        "  size  values not readable",
      ].join("\n"),
      ["Caption  components/ui/namespaced.tsx", "  variants not readable"].join(
        "\n"
      ),
      [
        "Resized  components/ui/indirect.tsx",
        "Swapped  components/ui/indirect.tsx",
      ].join("\n"),
      ["Tag  components/ui/tag.tsx", "  shape  from cva"].join("\n"),
      "  look  values not readable",
      "  intent  values not readable",
      ["  level  from cva", "    needs confirmation   1, 2"].join("\n"),
      "components/ui/split-button.tsx:18 SplitButton's size gets different defaults from different variant definitions (md, sm), so no default is set.",
      ["Stack  components/ui/dynamic.tsx", "  variants not readable"].join(
        "\n"
      ),
      ["  status  from cva", "    state                OPEN, CLOSED"].join(
        "\n"
      ),
    ]) {
      expect(stdout).toContain(line)
    }
    expect(stdout).not.toContain("emphasis  from")
    expect(stdout).not.toContain("defaultVariants of indVariants")
    expect(stdout).not.toContain("default size of indVariants")
    expect(stdout).not.toContain("default tone of toneVariants")
    for (const line of [
      "components/ui/star.tsx:20 legacyStyles() here can't be traced to class-variance-authority or tailwind-variants, so its variants aren't read.",
      "components/ui/indirect.tsx:71 options is changed after it's created, so it can't be read statically, and Mutated's props that reach toneVariants are left out.",
      "components/ui/mutated-config.tsx:12 drawerConfig is changed after it's created, so it can't be read statically, and the variants of drawerVariants are left out.",
      [
        "Swapped  components/ui/indirect.tsx",
        "Toggle3D  components/ui/indirect.tsx",
      ].join("\n"),
      ["Label  components/ui/star.tsx", "  variants not readable"].join("\n"),
    ]) {
      expect(stdout).toContain(line)
    }
    expect(
      existsSync(path.join(cwd, "components/ui/side-effect-ran.txt"))
    ).toBe(false)
    expect(stdout).not.toContain("from union")
  })

  it("explains when there is no components.json", async () => {
    const cwd = await createFixtureDirectory("next-app")
    await rm(path.join(cwd, "components.json"))

    const { stdout, exitCode } = await runCli(cwd, ["manifest", "--yes"])

    expect(exitCode).toBe(1)
    expect(stdout).toContain(
      `No components.json found in ${cwd}. Run npx shadcn@latest init to create one, then try again.`
    )
  })

  it("explains when the ui folder is missing", async () => {
    const cwd = await createFixtureDirectory("next-app")
    await rm(path.join(cwd, "components/ui"), { recursive: true })

    const { stdout, exitCode } = await runCli(cwd, ["manifest", "--yes"])

    expect(exitCode).toBe(1)
    expect(stdout).toContain(
      "The ui folder components/ui from components.json does not exist."
    )
    await expect(
      readFile(path.join(cwd, "lib/pliant/manifests.generated.ts"))
    ).rejects.toThrow()
  })
})
