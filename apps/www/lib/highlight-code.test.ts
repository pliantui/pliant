import { codeToHtml } from "shiki"
import { expect, it } from "vitest"

import { transformers } from "@/lib/highlight-code"

it("gives comments a colour with enough contrast in both themes", async () => {
  const html = await codeToHtml("const a = 1 // a comment", {
    lang: "ts",
    themes: { light: "github-light-default", dark: "vesper" },
    defaultColor: false,
    transformers,
  })

  expect(html).toContain("--shiki-light:#57606A")
  expect(html).toContain("--shiki-dark:#A3A3A3")
  expect(html).not.toContain("#6E7781")
  expect(html).not.toContain("#8B8B8B94")
})
