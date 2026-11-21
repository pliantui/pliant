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
  // A placeholder says the section is coming soon. A mockup shows what the
  // section is, under the banner for features that aren't fully built.
  status: "placeholder" | "mockup"
}

// Sections of the site that have no content of their own yet. Each gets a
// page with its title and what the section is, so every nav link leads
// somewhere.
const sections = {
  components: {
    title: "Components",
    description:
      "Components that let your users reshape your app, built on shadcn/ui.",
    status: "placeholder",
  },
  blocks: {
    title: "Blocks",
    description: "Ready-made page sections with Pliant wired in.",
    status: "placeholder",
  },
  charts: {
    title: "Charts",
    description: "Charts and stat cards your users can reshape.",
    status: "mockup",
  },
  playground: {
    title: "Playground",
    description: "Point at any part of an example and ask for a change.",
    status: "mockup",
  },
  directory: {
    title: "Directory",
    description: "Registries whose components work with Pliant.",
    status: "placeholder",
  },
  templates: {
    title: "Templates",
    description:
      "Ready-made app templates and premium components, built with Pliant.",
    status: "placeholder",
  },
  roadmap: {
    title: "Roadmap",
    description: "What Pliant can do today, and what it's working towards.",
    status: "placeholder",
  },
  changelog: {
    title: "Changelog",
    description: "What changed in each Pliant release.",
    status: "placeholder",
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

  if (status === "placeholder") {
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
