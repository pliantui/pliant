import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

import { SiteUrl } from "@/components/site-url"

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    SiteUrl,
    ...components,
  } satisfies MDXComponents
}
