import { loader } from "fumadocs-core/source"
import { metaSchema, pageSchema } from "fumadocs-core/source/schema"
import { applyMdxPreset } from "fumadocs-mdx/config"
import { defineDocs } from "fumadocs-mdx/macro"
import rehypePrettyCode from "rehype-pretty-code"

import { transformers } from "@/lib/highlight-code"

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset({
      rehypeCodeOptions: false,
      rehypePlugins: (plugins) => [
        [
          rehypePrettyCode,
          {
            theme: { dark: "vesper", light: "github-light-default" },
            transformers,
          },
        ],
        ...plugins,
      ],
    }),
  },
  meta: {
    schema: metaSchema,
  },
})

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
})
