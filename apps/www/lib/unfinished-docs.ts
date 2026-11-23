import { source } from "@/lib/source"

// A docs page for something that isn't fully built says so with the
// unfinished note, which carries the marker the unfinished work check reads.
const unfinishedNote = /<NotImplementedBanner\b|data-unfinished=/

// Whether a docs page's MDX source says it's for something not fully built.
export function isUnfinishedDoc(raw: string) {
  return unfinishedNote.test(raw)
}

// The URLs of the docs pages for things that aren't fully built, so the
// sidebars and indexes can mark them.
export async function getUnfinishedDocs(): Promise<string[]> {
  const pages = source.getPages()
  const unfinished = await Promise.all(
    pages.map(async (page) => isUnfinishedDoc(await page.data.getText("raw")))
  )
  return pages.filter((_, index) => unfinished[index]).map((page) => page.url)
}
