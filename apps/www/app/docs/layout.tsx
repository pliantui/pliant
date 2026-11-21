import { DocsLayout } from "fumadocs-ui/layouts/docs"

import { source } from "@/lib/source"

// The site header carries the search, theme and GitHub controls, so the docs
// layout leaves them out.
export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{ title: "Documentation", url: "/docs" }}
      searchToggle={{ enabled: false }}
      themeSwitch={{ enabled: false }}
    >
      {children}
    </DocsLayout>
  )
}
