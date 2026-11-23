"use client"

import * as React from "react"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  Columns3Icon,
  GripVerticalIcon,
  LoaderIcon,
  MoreVerticalIcon,
  PlusIcon,
} from "lucide-react"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sectionsDataset, type Section } from "@/lib/acme/data"
import { PliantDataTable } from "@/registry/pliant/pliant-data-table"
import { PliantDataTableColumnHeader } from "@/registry/pliant/pliant-data-table-column-header"
import {
  pliantDataTableFeatures,
  type PliantDataTableFeatures,
} from "@/registry/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/registry/pliant/pliant-data-table-pagination"

import { SurfaceAsks } from "./surface-asks"

const nodeId = "acme-sections"

interface SectionsState {
  selected: ReadonlySet<number>
  toggle: (id: number) => void
  toggleStatus: (id: number) => void
}

const SectionsContext = React.createContext<SectionsState | null>(null)

function useSections() {
  const state = React.use(SectionsContext)
  if (!state) throw new Error("useSections must be used in SectionsTable")
  return state
}

function SelectCell({ section }: { section: Section }) {
  const { selected, toggle } = useSections()
  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={selected.has(section.id)}
        onCheckedChange={() => {
          toggle(section.id)
        }}
        aria-label={`Select ${section.header}`}
      />
    </div>
  )
}

function RowMenu({ section }: { section: Section }) {
  const { toggleStatus } = useSections()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
        >
          <MoreVerticalIcon />
          <span className="sr-only">{section.header} options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onSelect={() => {
            toggleStatus(section.id)
          }}
        >
          {section.status === "Done" ? "Mark in process" : "Mark as done"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(section.header)
          }}
        >
          Copy title
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const columnHelper = createColumnHelper<PliantDataTableFeatures, Section>()

const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    size: 32,
    enableHiding: false,
    header: () => null,
    cell: () => (
      <GripVerticalIcon
        aria-hidden="true"
        className="size-3 text-muted-foreground"
      />
    ),
  }),
  columnHelper.display({
    id: "select",
    size: 40,
    enableHiding: false,
    header: () => <span className="sr-only">Select</span>,
    cell: ({ row }) => <SelectCell section={row.original} />,
  }),
  columnHelper.accessor("header", {
    size: 340,
    enableHiding: false,
    meta: { label: "Header" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.header}</span>
    ),
  }),
  columnHelper.accessor("type", {
    size: 150,
    meta: { label: "Section Type" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.type}
      </Badge>
    ),
  }),
  columnHelper.accessor("status", {
    size: 130,
    meta: { label: "Status" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.status === "Done" ? (
          <CheckCircle2Icon className="fill-green-500 text-background dark:fill-green-400" />
        ) : (
          <LoaderIcon />
        )}
        {row.original.status}
      </Badge>
    ),
  }),
  columnHelper.accessor("target", {
    size: 90,
    meta: { label: "Target" },
    header: ({ column }) => (
      <div className="-mr-2.5 flex justify-end pr-4">
        <PliantDataTableColumnHeader column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="pr-4 text-right tabular-nums">{row.original.target}</div>
    ),
  }),
  columnHelper.accessor("limit", {
    size: 90,
    meta: { label: "Limit" },
    header: ({ column }) => (
      <div className="-mr-2.5 flex justify-end pr-4">
        <PliantDataTableColumnHeader column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="pr-4 text-right tabular-nums">{row.original.limit}</div>
    ),
  }),
  columnHelper.accessor("reviewer", {
    size: 170,
    meta: { label: "Reviewer" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) =>
      row.original.reviewer ?? (
        <span className="text-muted-foreground">Unassigned</span>
      ),
  }),
  columnHelper.display({
    id: "actions",
    size: 48,
    enableHiding: false,
    header: () => <span className="sr-only">Options</span>,
    cell: ({ row }) => <RowMenu section={row.original} />,
  }),
])

function formatAggregate(value: unknown) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
      value
    )
  }
  return typeof value === "string" ? value : "—"
}

const pastPerformance = [
  { name: "Northwind records platform", year: 2025, outcome: "Delivered" },
  { name: "Contoso patient portal", year: 2024, outcome: "Delivered" },
  { name: "Fabrikam claims review", year: 2024, outcome: "Extended" },
]

const keyPersonnel = [
  { name: "Eddie Lake", role: "Proposal lead" },
  { name: "Jamik Tashpulatov", role: "Technical lead" },
]

const focusDocuments = [
  "Request for proposal",
  "Evaluation criteria",
  "Pricing template",
  "Past performance questionnaire",
]

export function SectionsTable({
  data,
  onDataChange: setData,
}: {
  data: Section[]
  onDataChange: React.Dispatch<React.SetStateAction<Section[]>>
}) {
  const titleId = React.useId()
  const [tab, setTab] = React.useState("outline")
  const node = usePliantNodeProps(nodeId)
  const [selected, setSelected] = React.useState<ReadonlySet<number>>(
    () => new Set()
  )
  const options = usePliantTable(
    {
      features: pliantDataTableFeatures,
      data,
      columns,
      getRowId: (row) => String(row.id),
      initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    },
    { id: nodeId, dataset: sectionsDataset }
  )
  const table = useTable(options)

  const state = React.useMemo<SectionsState>(
    () => ({
      selected,
      toggle: (id) => {
        setSelected((current) => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        })
      },
      toggleStatus: (id) => {
        setData((rows) =>
          rows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status: row.status === "Done" ? "In Process" : "Done",
                }
              : row
          )
        )
      },
    }),
    [selected, setData]
  )

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        <h2 id={titleId} className="sr-only">
          Proposal sections
        </h2>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            aria-label="View"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3Icon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => {
                      column.toggleVisibility(value)
                    }}
                  >
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setData((rows) => [
                ...rows,
                {
                  id: Math.max(0, ...rows.map((row) => row.id)) + 1,
                  header: "New section",
                  type: "Narrative",
                  status: "In Process",
                  target: 0,
                  limit: 0,
                  reviewer: null,
                },
              ])
            }}
          >
            <PlusIcon />
            <span className="hidden lg:inline">Add Section</span>
            <span className="sr-only lg:hidden">Add Section</span>
          </Button>
        </div>
      </div>
      <TabsContent value="outline" className="flex flex-col gap-4 px-4 lg:px-6">
        <SectionsContext value={state}>
          <div {...node}>
            <PliantDataTable
              table={table}
              aria-labelledby={titleId}
              formatAggregate={formatAggregate}
            />
          </div>
        </SectionsContext>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="hidden text-sm text-muted-foreground lg:block">
            {selected.size} of {data.length} row(s) selected.
          </p>
          <PliantDataTablePagination table={table} />
        </div>
        <SurfaceAsks
          target={nodeId}
          label="the sections table"
          prompts={[
            "add a column for how far each section is over its limit",
            "highlight sections in process that are over their limit",
            "group by section type with the average target",
            "show each section's share of all target pages",
            "only show Eddie Lake's sections that are in process",
          ]}
        />
      </TabsContent>
      <TabsContent value="past-performance" className="px-4 lg:px-6">
        <ul className="divide-y rounded-lg border">
          {pastPerformance.map((entry) => (
            <li
              key={entry.name}
              className="flex items-center justify-between gap-4 p-4 text-sm"
            >
              <span className="font-medium">{entry.name}</span>
              <span className="text-muted-foreground">
                {entry.year} · {entry.outcome}
              </span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="key-personnel" className="px-4 lg:px-6">
        <ul className="divide-y rounded-lg border">
          {keyPersonnel.map((person) => (
            <li
              key={person.name}
              className="flex items-center justify-between gap-4 p-4 text-sm"
            >
              <span className="font-medium">{person.name}</span>
              <span className="text-muted-foreground">{person.role}</span>
            </li>
          ))}
        </ul>
      </TabsContent>
      <TabsContent value="focus-documents" className="px-4 lg:px-6">
        <ul className="divide-y rounded-lg border">
          {focusDocuments.map((document) => (
            <li key={document} className="p-4 text-sm font-medium">
              {document}
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  )
}
