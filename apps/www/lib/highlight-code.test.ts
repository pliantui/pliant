import { codeToHast } from "shiki"
import { describe, expect, it } from "vitest"

import { transformers } from "@/lib/highlight-code"

async function codeProperties(source: string) {
  const root = await codeToHast(source, {
    lang: "bash",
    theme: "github-light-default",
    transformers,
  })
  const pre = root.children[0]
  if (pre?.type !== "element") throw new Error("no pre element")
  const code = pre.children[0]
  if (code?.type !== "element") throw new Error("no code element")
  return code.properties
}

describe("transformers", () => {
  it("keeps the source of every block for its copy button", async () => {
    const source = 'echo "hello"\nls'
    const properties = await codeProperties(source)

    expect(properties["__raw__"]).toBe(source)
    expect(properties["__npm__"]).toBeUndefined()
  })

  it("leaves multi-line blocks and other commands as plain code", async () => {
    for (const source of [
      "npm install a\nnpm run dev",
      "npxyz",
      "npm install",
    ]) {
      const properties = await codeProperties(source)
      expect(properties["__raw__"]).toBe(source)
      expect(properties["__npm__"]).toBeUndefined()
    }
  })

  it.each([
    [
      "npx pliantui init",
      "pnpm dlx pliantui init",
      "yarn dlx pliantui init",
      "bunx --bun pliantui init",
    ],
    [
      "npm install @pliantui/react",
      "pnpm add @pliantui/react",
      "yarn add @pliantui/react",
      "bun add @pliantui/react",
    ],
    ["npm run build", "pnpm build", "yarn build", "bun run build"],
    [
      "npx create-next-app@latest",
      "pnpm create next-app@latest",
      "yarn create next-app@latest",
      "bunx --bun create-next-app@latest",
    ],
  ])("gives %s for every package manager", async (npm, pnpm, yarn, bun) => {
    const properties = await codeProperties(npm)

    expect(properties).toMatchObject({
      __npm__: npm,
      __pnpm__: pnpm,
      __yarn__: yarn,
      __bun__: bun,
    })
  })
})
