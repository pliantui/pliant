import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { CodeBlockCommand } from "@/components/code-block-command"
import { ComponentSource } from "@/components/component-source"

interface RegistryItem {
  name: string
  dependencies?: string[]
  registryDependencies?: string[]
  files: { path: string }[]
}

function isRegistry(value: unknown): value is { items: RegistryItem[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray(value.items)
  )
}

function Command({ npm, run }: { npm: string; run: boolean }) {
  return (
    <figure data-rehype-pretty-code-figure="">
      <CodeBlockCommand
        __npm__={`${run ? "npx" : "npm install"} ${npm}`}
        __pnpm__={`${run ? "pnpm dlx" : "pnpm add"} ${npm}`}
        __yarn__={`${run ? "yarn dlx" : "yarn add"} ${npm}`}
        __bun__={`${run ? "bunx --bun" : "bun add"} ${npm}`}
      />
    </figure>
  )
}

// The Manual tab's steps for a registry item, read from `registry.json` so
// they match what the CLI installs. Render it inside `<Steps>`.
export async function ComponentManualInstall({ name }: { name: string }) {
  const registry: unknown = JSON.parse(
    await readFile(join(process.cwd(), "registry.json"), "utf8")
  )
  const item = isRegistry(registry)
    ? registry.items.find((entry) => entry.name === name)
    : undefined
  if (!item) throw new Error(`No registry item named ${name}`)
  const components = item.registryDependencies ?? []

  return (
    <>
      <h3>Install the dependencies.</h3>
      <Command npm={(item.dependencies ?? []).join(" ")} run={false} />
      {components.length > 0 && (
        <>
          <h3>Add the shadcn/ui components it builds on.</h3>
          <Command npm={`shadcn@latest add ${components.join(" ")}`} run />
        </>
      )}
      <h3>Copy and paste the following code into your project.</h3>
      {item.files.map(({ path }) => (
        <ComponentSource
          key={path}
          src={path}
          title={path.replace(/^registry\/pliant\//, "components/pliant/")}
        />
      ))}
      <h3>Update the import paths to match your project setup.</h3>
    </>
  )
}
