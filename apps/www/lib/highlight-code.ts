import type { ShikiTransformer } from "shiki"

// The themes' comment colours fall below 4.5:1 contrast on the code
// background, so comments get a darker grey in light mode and a lighter one in
// dark mode.
const commentColors: Record<string, string> = {
  "#6E7781": "#57606A",
  "#8B8B8B94": "#A3A3A3",
}

// Keeps each code block's source on its `code` element, so the copy button
// copies exactly what the page shows.
export const transformers: ShikiTransformer[] = [
  {
    code(node) {
      node.properties["__raw__"] = this.source
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
