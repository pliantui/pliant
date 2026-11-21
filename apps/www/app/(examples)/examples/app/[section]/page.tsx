import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isSection, sections } from "../sections"

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }))
}

export async function generateMetadata(
  props: PageProps<"/examples/app/[section]">
): Promise<Metadata> {
  const { section } = await props.params
  return isSection(section) ? { title: sections[section].title } : {}
}

export default async function SectionPage(
  props: PageProps<"/examples/app/[section]">
) {
  const { section } = await props.params
  if (!isSection(section)) {
    notFound()
  }
  const { title } = sections[section]
  return (
    <div className="flex flex-col gap-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Pick a link as your start page from its options menu, or close the
        sidebar. Both are kept for your next visit.
      </p>
    </div>
  )
}
