import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ComingSoon } from "@/components/coming-soon"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"

interface Section {
  title: string
  description: string
  // A section that's coming soon says so. An unfinished one describes what
  // it's for, under the banner for features that aren't fully built.
  status: "coming-soon" | "unfinished"
}

// Sections of the site that have no content of their own yet. Each gets a
// page with its title and what the section is, so every nav link leads
// somewhere.
const sections = {
  components: {
    title: "Components",
    description:
      "Components that let your users reshape your app, built on shadcn/ui.",
    status: "coming-soon",
  },
  blocks: {
    title: "Blocks",
    description: "Ready-made page sections with Pliant wired in.",
    status: "coming-soon",
  },
  charts: {
    title: "Charts",
    description: "Charts and stat cards your users can reshape.",
    status: "unfinished",
  },
  playground: {
    title: "Playground",
    description: "Point at any part of an example and ask for a change.",
    status: "unfinished",
  },
  directory: {
    title: "Directory",
    description: "Registries whose components work with Pliant.",
    status: "coming-soon",
  },
  templates: {
    title: "Templates",
    description: "Ready-made app templates built with Pliant.",
    status: "coming-soon",
  },
  roadmap: {
    title: "Roadmap",
    description: "What Pliant can do today, and what it's working towards.",
    status: "coming-soon",
  },
  changelog: {
    title: "Changelog",
    description: "What changed in each Pliant release.",
    status: "coming-soon",
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
  const { title, description, status }: Section = sections[section]

  if (status === "coming-soon") {
    return (
      <PageHeader>
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <ComingSoon>{description}</ComingSoon>
      </PageHeader>
    )
  }

  return (
    <PageHeader>
      <PageHeaderHeading>{title}</PageHeaderHeading>
      <PageHeaderDescription>{description}</PageHeaderDescription>
      <NotImplementedBanner className="mt-4 max-w-2xl text-left" />
    </PageHeader>
  )
}
