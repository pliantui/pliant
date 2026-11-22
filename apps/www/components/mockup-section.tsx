import * as React from "react"

import { ComponentPreviewTabs } from "@/components/component-preview-tabs"
import { ComponentCode } from "@/components/component-source"
import { mockupPages, type MockupPage } from "@/lib/components/mockup-pages"
import { mockups, type MockupSlug } from "@/registry/examples/mockups"

type Section =
  | "preview"
  | "installation"
  | "usage"
  | "asks"
  | "rules"
  | "examples"
  | "options"
  | "accessibility"

function isMockupSlug(slug: string): slug is MockupSlug {
  return Object.hasOwn(mockups, slug)
}

// Renders `code spans` written with backticks in the page data.
function Inline({ text }: { text: string }) {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? (
        <code key={index}>{part}</code>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      )
    )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div
      tabIndex={0}
      className="typeset-scroll scroll-fade-x scrollbar-none rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 *:[table]:w-full"
    >
      <table>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function render(page: MockupPage, section: Section) {
  switch (section) {
    case "preview": {
      if (!isMockupSlug(page.slug)) {
        throw new Error(`No preview for ${page.slug}`)
      }
      return (
        <ComponentPreviewTabs
          component={mockups[page.slug]()}
          source={
            <ComponentCode
              code={`${page.usage.imports}\n\n${page.usage.code}`}
              language="tsx"
            />
          }
        />
      )
    }
    case "installation":
      return (
        <p>
          The <code>{page.registryItem}</code> registry item isn&apos;t
          published, so there&apos;s nothing to install. It depends on{" "}
          <Inline
            text={new Intl.ListFormat("en", { type: "conjunction" }).format(
              page.dependencies.map((dependency) => `\`${dependency}\``)
            )}
          />
          .
        </p>
      )
    case "usage":
      return (
        <>
          <ComponentCode code={page.usage.imports} language="tsx" />
          <ComponentCode code={page.usage.code} language="tsx" />
        </>
      )
    case "asks":
      return (
        <Table
          head={["Ask", "What changes"]}
          rows={page.asks.map(({ prompt, result }) => [
            prompt,
            <Inline key="result" text={result} />,
          ])}
        />
      )
    case "rules":
      return (
        <ul>
          {page.rules.map((rule) => (
            <li key={rule}>
              <Inline text={rule} />
            </li>
          ))}
        </ul>
      )
    case "examples":
      return page.examples.map((example) => (
        <React.Fragment key={example.title}>
          <h3>{example.title}</h3>
          <p>
            <Inline text={example.description} />
          </p>
          <ComponentCode code={example.code} language="tsx" />
        </React.Fragment>
      ))
    case "options":
      return page.options.map((options) => (
        <React.Fragment key={options.component}>
          <h3>{options.component}</h3>
          <Table
            head={["Prop", "Type", "Default", "Description"]}
            rows={options.props.map((prop) => [
              <code key="name">{prop.name}</code>,
              <code key="type">{prop.type}</code>,
              prop.default ? <code key="default">{prop.default}</code> : "",
              <Inline key="description" text={prop.description} />,
            ])}
          />
        </React.Fragment>
      ))
    case "accessibility":
      return (
        <ul>
          {page.accessibility.map((line) => (
            <li key={line}>
              <Inline text={line} />
            </li>
          ))}
        </ul>
      )
  }
}

// One section of a component page that shares the template for components
// that aren't built yet, filled from `lib/components/mockup-pages`.
export function MockupSection({
  slug,
  section,
}: {
  slug: string
  section: Section
}) {
  const page = mockupPages.find((entry) => entry.slug === slug)
  if (!page) throw new Error(`No mockup page for ${slug}`)
  return render(page, section)
}
