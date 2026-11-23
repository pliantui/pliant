export interface Section {
  title: string
  description: string
}

// Sections of the site that have no content of their own yet. Each gets a
// page with its title and what the section is, so every nav link leads
// somewhere.
export const sections = {
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
  tour: {
    title: "Product tour",
    description:
      "A 60-second video tour of Pliant: point at part of an app, ask for a change, and keep it.",
  },
} satisfies Record<string, Section>
