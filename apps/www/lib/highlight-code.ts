import type { ShikiTransformer } from "shiki"

const commands: [npm: string, pnpm: string, yarn: string, bun: string][] = [
  ["npm install ", "pnpm add ", "yarn add ", "bun add "],
  ["npx create-", "pnpm create ", "yarn create ", "bunx --bun create-"],
  ["npm create ", "pnpm create ", "yarn create ", "bun create "],
  ["npx ", "pnpm dlx ", "yarn dlx ", "bunx --bun "],
  ["npm run ", "pnpm ", "yarn ", "bun run "],
]

// The themes' comment colours fall below 4.5:1 contrast on the code
// background, so comments get a darker grey in light mode and a lighter one in
// dark mode.
const commentColors: Record<string, string> = {
  "#6E7781": "#57606A",
  "#8B8B8B94": "#A3A3A3",
}

// Keeps each code block's source on its `code` element, so the copy button
// copies exactly what the page shows. A one-line npm command also gets its
// pnpm, yarn and bun forms, which the docs show as package-manager tabs.
export const transformers: ShikiTransformer[] = [
  {
    code(node) {
      const raw = this.source
      node.properties["__raw__"] = raw

      if (raw.trim().includes("\n")) return
      const command = commands.find(([npm]) => raw.startsWith(npm))
      if (!command) return
      const [npm, pnpm, yarn, bun] = command
      node.properties["__npm__"] = raw
      node.properties["__pnpm__"] = raw.replace(npm, pnpm)
      node.properties["__yarn__"] = raw.replace(npm, yarn)
      node.properties["__bun__"] = raw.replace(npm, bun)
    },
    span(node) {
      const style = node.properties.style
      if (typeof style !== "string") return
      node.properties.style = style.replace(
        /#[0-9A-F]{6,8}/gi,
        (color) => commentColors[color.toUpperCase()] ?? color
      )
    },
  },
]
