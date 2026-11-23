"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  monthlyFigures,
  sectionTypes,
  visitors,
  type Section,
} from "@/lib/acme/data"
import { formatUsd } from "@/lib/acme/metrics"

import { SectionCards } from "./section-cards"
import { SectionsTable } from "./sections-table"
import type { View } from "./views"
import { VisitorsChart } from "./visitors-chart"

const count = new Intl.NumberFormat("en-US")
const month = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

function Page({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4 px-4 lg:px-6">{children}</div>
}

function SimpleList({
  items,
}: {
  items: readonly { title: string; detail: string }[]
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li
          key={item.title}
          className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
        >
          <span className="font-medium">{item.title}</span>
          <span className="text-muted-foreground">{item.detail}</span>
        </li>
      ))}
    </ul>
  )
}

function Lifecycle({ sections }: { sections: readonly Section[] }) {
  return (
    <Page>
      <div className="grid gap-4 md:grid-cols-2">
        {(["In Process", "Done"] as const).map((status) => {
          const rows = sections.filter((section) => section.status === status)
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle>{status}</CardTitle>
                <CardDescription>{rows.length} sections</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {rows.slice(0, 8).map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{row.header}</span>
                      <Badge variant="outline" className="shrink-0">
                        {row.type}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </Page>
  )
}

function Analytics() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <VisitorsChart />
      </div>
      <Page>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">New customers</TableHead>
                <TableHead className="text-right">Active accounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyFigures.map((row) => (
                <TableRow key={row.month}>
                  <TableCell>{month.format(new Date(row.month))}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {count.format(row.newCustomers)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {count.format(row.activeAccounts)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Page>
    </>
  )
}

function Team({ sections }: { sections: readonly Section[] }) {
  const reviewers = [
    ...new Set(sections.flatMap((section) => section.reviewer ?? [])),
  ].sort()
  return (
    <Page>
      <SimpleList
        items={reviewers.map((reviewer) => {
          const own = sections.filter(
            (section) => section.reviewer === reviewer
          )
          const open = own.filter((section) => section.status === "In Process")
          return {
            title: reviewer,
            detail: `${String(own.length)} sections, ${String(open.length)} in process`,
          }
        })}
      />
    </Page>
  )
}

function Search({ sections }: { sections: readonly Section[] }) {
  const [query, setQuery] = React.useState("")
  const matches = query.trim()
    ? sections.filter((section) =>
        section.header.toLowerCase().includes(query.trim().toLowerCase())
      )
    : []
  return (
    <Page>
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="acme-search">Search sections</Label>
        <Input
          id="acme-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
        />
      </div>
      {query.trim() && (
        <SimpleList
          items={
            matches.length > 0
              ? matches.map((section) => ({
                  title: section.header,
                  detail: section.status,
                }))
              : [{ title: "No sections match", detail: "" }]
          }
        />
      )}
    </Page>
  )
}

function QuickCreate({ onCreate }: { onCreate: (header: string) => void }) {
  const [header, setHeader] = React.useState("")
  return (
    <Page>
      <form
        className="flex max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (header.trim()) onCreate(header.trim())
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="acme-new-section">Section title</Label>
          <Input
            id="acme-new-section"
            value={header}
            onChange={(event) => {
              setHeader(event.target.value)
            }}
          />
        </div>
        <Button type="submit" className="w-fit">
          Add to the outline
        </Button>
      </form>
    </Page>
  )
}

export function AcmePage({
  view,
  sections,
  onSectionsChange,
  onView,
}: {
  view: View
  sections: Section[]
  onSectionsChange: React.Dispatch<React.SetStateAction<Section[]>>
  onView: (view: View) => void
}) {
  switch (view) {
    case "dashboard":
      return (
        <>
          <SectionCards />
          <div className="px-4 lg:px-6">
            <VisitorsChart />
          </div>
          <SectionsTable data={sections} onDataChange={onSectionsChange} />
        </>
      )
    case "lifecycle":
      return <Lifecycle sections={sections} />
    case "analytics":
      return <Analytics />
    case "projects":
      return (
        <Page>
          <SimpleList
            items={[
              {
                title: "Northwind proposal",
                detail: "Due Dec 12 · 40 sections",
              },
              { title: "Contoso renewal", detail: "Due Jan 9 · 18 sections" },
              { title: "Fabrikam pilot", detail: "Due Feb 2 · 12 sections" },
            ]}
          />
        </Page>
      )
    case "team":
      return <Team sections={sections} />
    case "data-library":
      return (
        <Page>
          <SimpleList
            items={[
              {
                title: "Proposal sections",
                detail: `${String(sections.length)} rows`,
              },
              {
                title: "Daily visitors",
                detail: `${String(visitors.length)} rows`,
              },
              {
                title: "Monthly figures",
                detail: `${String(monthlyFigures.length)} rows`,
              },
            ]}
          />
        </Page>
      )
    case "reports":
      return (
        <Page>
          <SimpleList
            items={[
              { title: "Monthly revenue", detail: "Updated Nov 22" },
              { title: "Visitor trends", detail: "Updated Nov 22" },
              { title: "Section status", detail: "Updated Nov 21" },
            ]}
          />
        </Page>
      )
    case "word-assistant":
      return (
        <Page>
          <SimpleList
            items={sectionTypes.slice(0, 4).map((type) => ({
              title: `${type} style guide`,
              detail: "Tone, length and structure",
            }))}
          />
        </Page>
      )
    case "proposal-templates":
    case "brand-guide":
      return (
        <Page>
          <SimpleList
            items={[
              { title: "Federal proposal", detail: "42 sections" },
              { title: "Commercial proposal", detail: "24 sections" },
            ]}
          />
        </Page>
      )
    case "settings":
      return (
        <Page>
          <div className="flex max-w-md flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="acme-name">Name</Label>
              <Input id="acme-name" defaultValue="Eddie Lake" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="acme-email">Email</Label>
              <Input
                id="acme-email"
                type="email"
                defaultValue="eddie@acme.example"
              />
            </div>
          </div>
        </Page>
      )
    case "help":
      return (
        <Page>
          <SimpleList
            items={[
              { title: "Getting started with proposals", detail: "Guide" },
              { title: "Assigning reviewers", detail: "Guide" },
              { title: "Contact support", detail: "support@acme.example" },
            ]}
          />
        </Page>
      )
    case "search":
      return <Search sections={sections} />
    case "inbox":
      return (
        <Page>
          <SimpleList
            items={[
              {
                title: "Maya Johnson",
                detail: "Architecture overview is ready",
              },
              { title: "Sarah Chen", detail: "Compliance notes added" },
              { title: "Raj Patel", detail: "API docs reviewed" },
            ]}
          />
        </Page>
      )
    case "quick-create":
      return (
        <QuickCreate
          onCreate={(header) => {
            onSectionsChange((rows) => [
              ...rows,
              {
                id: Math.max(0, ...rows.map((row) => row.id)) + 1,
                header,
                type: "Narrative",
                status: "In Process",
                target: 0,
                limit: 0,
                reviewer: null,
              },
            ])
            onView("dashboard")
          }}
        />
      )
  }
}
