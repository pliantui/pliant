import type { ShikiTransformer } from "shiki"

// Keeps each code block's source on its `code` element, so the copy button
// copies exactly what the page shows.
export const transformers: ShikiTransformer[] = [
  {
    code(node) {
      node.properties["__raw__"] = this.source
    },
  },
]
