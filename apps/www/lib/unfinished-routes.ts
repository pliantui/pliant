import { posts } from "@/lib/blog"
import { examples } from "@/lib/examples"
import { sections } from "@/lib/sections"
import { getUnfinishedDocs } from "@/lib/unfinished-docs"

// The pages that preview parts of Pliant that aren't built: the home page's
// showcase, and the blocks, charts and playground, whose asks include
// scripted answers.
const previewPages = ["/", "/blocks", "/charts", "/playground"]

// Every page that shows unfinished work, as paths. A path ending in `/*`
// covers the pages below it too.
export async function getUnfinishedRoutes(): Promise<string[]> {
  return [
    ...previewPages,
    ...examples
      .filter((example) => example.unfinished)
      .flatMap((example) => [example.href, `${example.href}/*`]),
    ...Object.keys(sections).map((section) => `/${section}`),
    ...posts
      .filter((post) => post.unfinished)
      .map((post) => `/blog/${post.slug}`),
    ...(await getUnfinishedDocs()),
  ]
}
