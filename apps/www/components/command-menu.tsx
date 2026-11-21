"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import type { Root } from "fumadocs-core/page-tree"
import {
  useStaticSearch,
  type SearchResultItem,
  type SearchResultRecord,
} from "fumadocs-core/search/client"
import { ArrowRightIcon, CornerDownLeftIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useMutationObserver } from "@/hooks/use-mutation-observer"
import { getDocsGroups } from "@/lib/docs-nav"
import type { NavItem } from "@/lib/nav"

const groupClassName =
  "p-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"

function nodeText(node: React.ReactNode) {
  return typeof node === "string" ? node : ""
}

function commandFilter(value: string, search: string, keywords?: string[]) {
  const extendedValue = `${value} ${keywords?.join(" ") ?? ""}`
  return extendedValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
}

export function CommandMenu({
  tree,
  navItems,
}: {
  tree: Root
  navItems: readonly NavItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [renderDelayedGroups, setRenderDelayedGroups] = React.useState(false)
  const [selectedType, setSelectedType] = React.useState<"page" | null>(null)

  // The index is exported at build time and searched in the browser, so
  // search needs no server.
  const { search, onSearchChange, isLoading, data } = useStaticSearch()

  const groups = React.useMemo(() => getDocsGroups(tree), [tree])

  const handleOpenChange = React.useCallback((open: boolean) => {
    setOpen(open)
    if (!open) setRenderDelayedGroups(false)
  }, [])

  // The long groups render a frame after the dialog opens, so it opens
  // without delay.
  React.useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      setRenderDelayedGroups(true)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [open])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
        setRenderDelayedGroups(false)
      }
    }

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [])

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      handleOpenChange(false)
      command()
    },
    [handleOpenChange]
  )

  const highlightPage = React.useCallback(() => {
    setSelectedType("page")
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative h-8 w-full justify-start rounded-lg border-none bg-muted pl-3 text-foreground shadow-none transition-colors hover:bg-muted/50 md:w-48 lg:w-40 xl:w-64 dark:bg-card"
        >
          <span className="hidden xl:inline-flex">Search documentation...</span>
          <span className="inline-flex xl:hidden">Search...</span>
        </Button>
      </DialogTrigger>
      <CommandDialogContent className="rounded-xl border-none bg-clip-padding p-2 pb-11 shadow-2xl ring-4 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800">
        <DialogHeader className="sr-only">
          <DialogTitle>Search documentation</DialogTitle>
          <DialogDescription>
            Search the docs and jump to a page.
          </DialogDescription>
        </DialogHeader>
        <Command
          className="rounded-none bg-transparent **:data-[slot=command-input]:h-9! **:data-[slot=command-input]:py-0 **:data-[slot=command-input-wrapper]:mb-0 **:data-[slot=command-input-wrapper]:h-9! **:data-[slot=command-input-wrapper]:rounded-md **:data-[slot=command-input-wrapper]:border **:data-[slot=command-input-wrapper]:border-input **:data-[slot=command-input-wrapper]:bg-input/50"
          filter={commandFilter}
        >
          <div className="relative">
            <CommandInput
              placeholder="Search documentation..."
              aria-label="Search documentation"
              onValueChange={(value) => {
                React.startTransition(() => {
                  onSearchChange(value)
                })
              }}
            />
            {isLoading && (
              <div className="pointer-events-none absolute top-1/2 right-3 z-10 flex -translate-y-1/2 items-center justify-center">
                <Spinner className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <CommandList className="no-scrollbar min-h-80 scroll-pt-2 scroll-pb-1.5">
            <CommandEmpty className="py-12 text-center text-sm text-muted-foreground">
              {isLoading ? "Searching..." : "No results found."}
            </CommandEmpty>
            <CommandGroup heading="Pages" className={groupClassName}>
              {navItems.map((item) => (
                <CommandMenuItem
                  key={item.href}
                  value={`Navigation ${item.label}`}
                  keywords={["nav", "navigation", item.label.toLowerCase()]}
                  onHighlight={highlightPage}
                  onSelect={() => {
                    runCommand(() => {
                      router.push(item.href)
                    })
                  }}
                >
                  <ArrowRightIcon />
                  {item.label}
                </CommandMenuItem>
              ))}
            </CommandGroup>
            {renderDelayedGroups ? (
              <>
                {groups.map((group) => (
                  <CommandGroup
                    key={group.id}
                    heading={group.name}
                    className={groupClassName}
                  >
                    {group.pages.map((page) => (
                      <CommandMenuItem
                        key={page.url}
                        value={`${nodeText(group.name)} ${nodeText(page.name)}`}
                        onHighlight={highlightPage}
                        onSelect={() => {
                          runCommand(() => {
                            router.push(page.url)
                          })
                        }}
                      >
                        <ArrowRightIcon />
                        {page.name}
                      </CommandMenuItem>
                    ))}
                  </CommandGroup>
                ))}
                <SearchResults
                  search={search}
                  results={data?.items}
                  onSelect={(url) => {
                    runCommand(() => {
                      router.push(url)
                    })
                  }}
                />
              </>
            ) : null}
          </CommandList>
        </Command>
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center gap-2 rounded-b-xl border-t border-t-neutral-100 bg-neutral-50 px-4 text-xs font-medium text-muted-foreground dark:border-t-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center gap-2">
            <CommandMenuKbd>
              <CornerDownLeftIcon />
            </CommandMenuKbd>{" "}
            {selectedType === "page" ? "Go to Page" : null}
          </div>
        </div>
      </CommandDialogContent>
    </Dialog>
  )
}

function CommandMenuItem({
  children,
  className,
  onHighlight,
  ...props
}: React.ComponentProps<typeof CommandItem> & {
  onHighlight?: () => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  const onMutation = React.useCallback<MutationCallback>(
    (mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "aria-selected" &&
          ref.current?.getAttribute("aria-selected") === "true"
        ) {
          onHighlight?.()
        }
      }
    },
    [onHighlight]
  )
  useMutationObserver(ref, onMutation)

  return (
    <CommandItem
      ref={ref}
      className={cn(
        "h-9 rounded-md border border-transparent px-3! font-medium data-[selected=true]:border-input data-[selected=true]:bg-input/50",
        className
      )}
      {...props}
    >
      {children}
    </CommandItem>
  )
}

function CommandMenuKbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-background px-1 font-sans text-[0.7rem] font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function SearchResults({
  search,
  results,
  onSelect,
}: {
  search: string
  results: SearchResultItem[] | undefined
  onSelect: (url: string) => void
}) {
  const uniqueResults = React.useMemo(() => {
    const records = (results ?? []).filter(
      (item): item is SearchResultRecord => item.type !== "table"
    )

    return records.filter(
      (item, index, self) =>
        !(
          item.type === "text" && item.content.trim().split(/\s+/).length <= 1
        ) && index === self.findIndex((other) => other.content === item.content)
    )
  }, [results])

  if (!search.trim() || uniqueResults.length === 0) return null

  return (
    <CommandGroup
      heading="Search Results"
      className="px-0! **:[[cmdk-group-heading]]:scroll-mt-16 **:[[cmdk-group-heading]]:p-3! **:[[cmdk-group-heading]]:pb-1!"
    >
      {uniqueResults.map((item) => (
        <CommandItem
          key={item.id}
          data-type={item.type}
          onSelect={() => {
            onSelect(item.url)
          }}
          className="h-9 rounded-md border border-transparent px-3! font-normal data-[selected=true]:border-input data-[selected=true]:bg-input/50"
          // The index already matched these; the query keeps them in the list.
          keywords={[item.content, search]}
          value={`${item.content} ${item.type}`}
        >
          <div className="line-clamp-1 text-sm">{item.content}</div>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

function CommandDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[15%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
