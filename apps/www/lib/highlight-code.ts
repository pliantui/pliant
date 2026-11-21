import type { ShikiTransformer } from "shiki"

// Each pair turns the npm form of a command into the same command for pnpm,
// yarn and bun.
const commands: [npm: string, pnpm: string, yarn: string, bun: string][] = [
  ["npm install", "pnpm add", "yarn add", "bun add"],
  ["npx create-", "pnpm create ", "yarn create ", "bunx --bun create-"],
  ["npm create", "pnpm create", "yarn create", "bun create"],
  ["npx", "pnpm dlx", "yarn dlx", "bunx --bun"],
  ["npm run", "pnpm", "yarn", "bun"],
]

// Keeps each code block's source on its `code` element, so the copy button
// copies exactly what the page shows. An npm command also gets its pnpm, yarn
// and bun forms, which the docs show as package-manager tabs.
export const transformers: ShikiTransformer[] = [
  {
    code(node) {
      const raw = this.source
      node.properties["__raw__"] = raw

      const command = commands.find(([npm]) => raw.startsWith(npm))
      if (!command) return
      const [npm, pnpm, yarn, bun] = command
      node.properties["__npm__"] = raw
      node.properties["__pnpm__"] = raw.replace(npm, pnpm)
      node.properties["__yarn__"] = raw.replace(npm, yarn)
      node.properties["__bun__"] = raw.replace(npm, bun)
    },
  },
]
