"use client"

import * as React from "react"
import { CheckIcon, FileIcon, TerminalIcon } from "lucide-react"

import { CopyButton } from "@/components/copy-button"
import { getIconForLanguageExtension } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

interface ViewerFile {
  target: string
  code: string
  html: string
}

function InstallButton({
  components,
  command,
}: {
  components: readonly string[]
  command: string
}) {
  const { isCopied, copyToClipboard } = useCopyToClipboard()

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-1 px-2 shadow-none"
        onClick={() => {
          void copyToClipboard(command)
        }}
      >
        {isCopied ? <CheckIcon /> : <TerminalIcon />}
        <span>
          <span className="sr-only">
            Copy the command that adds the components this block uses:{" "}
          </span>
          npx shadcn add {components.join(" ")}
        </span>
      </Button>
      <span role="status" className="sr-only">
        {isCopied ? "Copied" : ""}
      </span>
    </>
  )
}

// Shows a block with Preview and Code views, like shadcn's block viewer.
// The preview renders in the page rather than an iframe, so the block's
// asks and Reset work with the page's `PliantRoot`.
export function BlockViewer({
  name,
  description,
  components,
  command,
  files,
  children,
}: {
  name: string
  description: string
  // The published components the block uses, and the command that adds
  // them.
  components: readonly string[]
  command: string | undefined
  files: readonly ViewerFile[]
  children: React.ReactNode
}) {
  const [active, setActive] = React.useState(files[0]?.target)
  const file = files.find((entry) => entry.target === active) ?? files[0]
  const titleId = `${name}-title`

  return (
    <section
      id={name}
      aria-labelledby={titleId}
      className="flex min-w-0 scroll-mt-24 flex-col gap-4"
    >
      <Tabs defaultValue="preview" className="gap-4">
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:pl-2">
          <TabsList className="grid h-8! grid-cols-2 items-center rounded-lg p-1 *:data-[slot=tabs-trigger]:h-6 *:data-[slot=tabs-trigger]:rounded-sm *:data-[slot=tabs-trigger]:px-2 *:data-[slot=tabs-trigger]:text-xs">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          <Separator
            orientation="vertical"
            className="mx-2 hidden h-4! sm:block"
          />
          <h2 id={titleId} className="text-sm font-medium">
            <a href={`#${name}`} className="underline-offset-2 hover:underline">
              {description}
            </a>
          </h2>
          <div className="flex w-full items-center gap-2 lg:ml-auto lg:w-auto">
            <span className="font-mono text-xs text-muted-foreground">
              {name}
            </span>
            <Separator orientation="vertical" className="mx-1 h-4!" />
            <span className="text-xs text-muted-foreground">
              Block not published yet
            </span>
            {command && (
              <>
                <Separator
                  orientation="vertical"
                  className="mx-1 hidden h-4! sm:block"
                />
                <span className="hidden sm:inline-flex">
                  <InstallButton components={components} command={command} />
                </span>
              </>
            )}
          </div>
        </div>
        <TabsContent
          value="preview"
          forceMount
          // The preview stays mounted while the code shows, so the block
          // keeps its changes.
          className="data-[state=inactive]:hidden"
          tabIndex={-1}
        >
          <div className="relative rounded-xl bg-[radial-gradient(#d4d4d4_1px,transparent_1px)] bg-size-[20px_20px] p-2 sm:p-4 dark:bg-[radial-gradient(#404040_1px,transparent_1px)]">
            <div className="relative overflow-hidden rounded-lg border bg-background p-4 sm:p-6 md:rounded-xl">
              {children}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="code">
          <div className="flex flex-col overflow-hidden rounded-xl border bg-code text-code-foreground md:h-[36rem] md:flex-row">
            <div className="flex shrink-0 flex-col border-b md:w-64 md:border-r md:border-b-0">
              <div className="flex h-12 items-center border-b px-4 text-sm font-medium">
                Files
              </div>
              <ul aria-label="Files" className="flex flex-col py-1">
                {files.map((entry) => (
                  <li key={entry.target}>
                    <button
                      type="button"
                      aria-pressed={entry.target === file?.target}
                      className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm whitespace-nowrap outline-none hover:bg-muted-foreground/15 focus-visible:bg-muted-foreground/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-muted-foreground/15"
                      onClick={() => {
                        setActive(entry.target)
                      }}
                    >
                      <FileIcon aria-hidden="true" className="size-4" />
                      {entry.target}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {file && (
              <figure
                data-rehype-pretty-code-figure=""
                className="relative mx-0! mt-0 flex min-h-0 min-w-0 flex-1 flex-col rounded-none border-none"
              >
                <figcaption
                  data-language="tsx"
                  className="flex h-12 shrink-0 items-center gap-2 border-b px-4 py-2 text-code-foreground [&_svg]:size-4 [&_svg]:text-code-foreground [&_svg]:opacity-70"
                >
                  {getIconForLanguageExtension("tsx")}
                  {file.target}
                </figcaption>
                <CopyButton value={file.code} className="top-2.5" />
                <div
                  key={file.target}
                  data-not-typeset
                  className="min-h-0 flex-1 overflow-auto [&>pre]:no-scrollbar [&>pre]:max-h-[32rem] [&>pre]:overflow-auto [&>pre]:px-4 [&>pre]:py-3.5 [&>pre]:text-sm [&>pre]:outline-none [&>pre]:focus-visible:ring-[3px] [&>pre]:focus-visible:ring-ring/50 md:[&>pre]:max-h-none"
                  dangerouslySetInnerHTML={{ __html: file.html }}
                />
              </figure>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
