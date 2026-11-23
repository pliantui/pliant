import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader, PageHeaderHeading } from "@/components/page-header"
import { UnfinishedStrip } from "@/components/unfinished-strip"
import { sections, type Section } from "@/lib/sections"

type SectionName = keyof typeof sections

function isSection(value: string): value is SectionName {
  return Object.hasOwn(sections, value)
}

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }))
}

export async function generateMetadata(
  props: PageProps<"/[section]">
): Promise<Metadata> {
  const { section } = await props.params
  if (!isSection(section)) notFound()

  return {
    title: sections[section].title,
    description: sections[section].description,
    robots: { index: false },
  }
}

export default async function SectionPage(props: PageProps<"/[section]">) {
  const { section } = await props.params
  if (!isSection(section)) notFound()
  const { title, description }: Section = sections[section]

  return (
    <PageHeader>
      <UnfinishedStrip />
      <PageHeaderHeading>{title}</PageHeaderHeading>
      <ComingSoon>{description}</ComingSoon>
    </PageHeader>
  )
}
