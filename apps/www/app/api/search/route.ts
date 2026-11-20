import { createFromSource } from "fumadocs-core/search/server"

import { source } from "@/lib/source"

// The index is exported once at build time and searched in the browser.
export const revalidate = false

export const { staticGET: GET } = createFromSource(source)
