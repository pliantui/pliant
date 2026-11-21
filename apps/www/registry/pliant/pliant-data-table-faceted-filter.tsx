"use client"

import type { Column, RowData } from "@tanstack/react-table"
import { CirclePlus } from "lucide-react"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

import type { PliantDataTableFeatures } from "./pliant-data-table-features"

declare module "@pliantui/react" {
  interface PliantMessages {
    dataTableSelected: (count: string) => string
    dataTableClearFilter: string
  }
}

const facetedFilterMessages = {
  dataTableSelected: (count) => `${count} selected`,
  dataTableClearFilter: "Clear filter",
} satisfies Partial<PliantMessages>

/** A value a faceted filter can pick. */
type PliantDataTableFacet = string | number | boolean

function isFacet(value: unknown): value is PliantDataTableFacet {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

// The values a column's filter picks: an `in` or `eq` filter, or a bare list
// or value from another filter UI.
function pickedOf(filter: unknown): PliantDataTableFacet[] {
  const operator = read(filter, "operator")
  const value =
    operator === "in" || operator === "eq" ? read(filter, "value") : filter
  return (Array.isArray(value) ? value : [value]).filter(isFacet)
}

const defaultNumber = new Intl.NumberFormat("en")

function defaultFormatNumber(value: number) {
  return defaultNumber.format(value)
}

/**
 * A filter for a column with a few distinct values, such as a status: a
 * menu of the values in the rows the other filters leave, each with its
 * number of rows. With `multiple`, users can pick several values, which
 * filter as `in`; otherwise one, which filters as `eq`. The button shows
 * what is picked.
 */
function PliantDataTableFacetedFilter<TData extends RowData, TValue>({
  column,
  title,
  multiple = true,
  formatValue = String,
  formatNumber = defaultFormatNumber,
}: {
  /** The column to filter. */
  column: Column<PliantDataTableFeatures, TData, TValue>
  /** The filter's name, such as the column's label. */
  title: string
  /** Whether users can pick more than one value. */
  multiple?: boolean
  /** Names a value. Defaults to the value as text. */
  formatValue?: (value: PliantDataTableFacet) => string
  /** Formats the number of rows. Defaults to English digit grouping. */
  formatNumber?: (value: number) => string
}) {
  const messages = usePliantMessages(facetedFilterMessages)
  const picked = pickedOf(column.getFilterValue())
  const counts = column.getFacetedUniqueValues()
  const options = [
    ...new Set([...[...counts.keys()].filter(isFacet), ...picked]),
  ]
    .map((value) => ({
      value,
      key: JSON.stringify(value),
      label: formatValue(value),
      count: counts.get(value) ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const pickedLabels = options
    .filter(({ value }) => picked.includes(value))
    .map(({ label }) => label)

  function pick(values: PliantDataTableFacet[]) {
    const [first] = values
    column.setFilterValue(
      first === undefined
        ? undefined
        : multiple
          ? { operator: "in", value: values }
          : { operator: "eq", value: first }
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <CirclePlus />
          {title}
          {pickedLabels.length > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {formatNumber(pickedLabels.length)}
              </Badge>
              <span className="hidden gap-1 lg:flex">
                {pickedLabels.length > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {messages.dataTableSelected(
                      formatNumber(pickedLabels.length)
                    )}
                  </Badge>
                ) : (
                  pickedLabels.map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {label}
                    </Badge>
                  ))
                )}
              </span>
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {multiple ? (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.key}
              checked={picked.includes(option.value)}
              onSelect={(event) => {
                event.preventDefault()
              }}
              onCheckedChange={(checked) => {
                pick(
                  checked
                    ? [...picked, option.value]
                    : picked.filter((value) => value !== option.value)
                )
              }}
            >
              {option.label}
              <span className="ml-auto pl-4 font-mono text-xs">
                {formatNumber(option.count)}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          <DropdownMenuRadioGroup
            value={picked[0] === undefined ? "" : JSON.stringify(picked[0])}
            onValueChange={(key) => {
              const option = options.find((other) => other.key === key)
              pick(option ? [option.value] : [])
            }}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.key} value={option.key}>
                {option.label}
                <span className="ml-auto pl-4 font-mono text-xs">
                  {formatNumber(option.count)}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
        {picked.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center"
              onSelect={() => {
                pick([])
              }}
            >
              {messages.dataTableClearFilter}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { PliantDataTableFacetedFilter, type PliantDataTableFacet }
