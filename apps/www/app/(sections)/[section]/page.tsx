import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"

// Sections of the site that have no content of their own yet. Each gets a
// page with its title and what the section is, so every nav link leads
// somewhere.
const sections = {
  components: {
    title: "Components",
    description:
      "Components that let your users reshape your app, built on shadcn/ui.",
  },
  blocks: {
    title: "Blocks",
    description: "Ready-made page sections with Pliant wired in.",
  },
  charts: {
    title: "Charts",
    description: "Charts and stat cards your users can reshape.",
  },
  playground: {
    title: "Playground",
    description: "Point at any part of an example and ask for a change.",
  },
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
} as const

type Section = keyof typeof sections

function isSection(value: string): value is Section {
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
  const { title, description } = sections[section]

  return (
    <PageHeader>
      <PageHeaderHeading>{title}</PageHeaderHeading>
      <PageHeaderDescription>{description}</PageHeaderDescription>
    </PageHeader>
  )
}
