import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader, PageHeaderHeading } from "@/components/page-header"

interface Section {
  title: string
  description: string
}

// Sections of the site that have no content of their own yet. Each gets a
// page with its title and what the section is, so every nav link leads
// somewhere.
const sections = {
  directory: {
    title: "Directory",
    description: "Registries whose components work with Pliant.",
  },
  templates: {
    title: "Templates",
    description: "Ready-made app templates built with Pliant.",
  },
  roadmap: {
    title: "Roadmap",
    description: "What Pliant can do today, and what it's working towards.",
  },
  changelog: {
    title: "Changelog",
    description: "What changed in each Pliant release.",
  },
} satisfies Record<string, Section>

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
      <PageHeaderHeading>{title}</PageHeaderHeading>
      <ComingSoon>{description}</ComingSoon>
    </PageHeader>
  )
}
