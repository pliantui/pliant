"use client"

import { CheckIcon, CopyIcon, TerminalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConfig, type Config } from "@/hooks/use-config"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

type PackageManager = Config["packageManager"]

function isPackageManager(value: string): value is PackageManager {
  return (
    value === "pnpm" || value === "npm" || value === "yarn" || value === "bun"
  )
}

export function CodeBlockCommand({
  __npm__,
  __yarn__,
  __pnpm__,
  __bun__,
}: {
  __npm__: string
  __yarn__: string
  __pnpm__: string
  __bun__: string
}) {
  const [config, setConfig] = useConfig()
  const { isCopied, copyToClipboard } = useCopyToClipboard()

  const tabs: Record<PackageManager, string> = {
    pnpm: __pnpm__,
    npm: __npm__,
    yarn: __yarn__,
    bun: __bun__,
  }

  return (
    <div className="relative overflow-x-auto">
      <Tabs
        value={config.packageManager}
        className="gap-0"
        onValueChange={(value) => {
          if (isPackageManager(value)) {
            setConfig({ ...config, packageManager: value })
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1">
          <div
            className="flex size-4 items-center justify-center rounded-[1px] bg-foreground opacity-70"
            aria-hidden="true"
          >
            <TerminalIcon className="size-3 text-code" />
          </div>
          <TabsList
            aria-label="Package manager"
            className="rounded-none bg-transparent p-0"
          >
            {Object.keys(tabs).map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="h-7 border border-transparent pt-0.5 shadow-none! data-[state=active]:border-input data-[state=active]:bg-background!"
              >
                {key}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="no-scrollbar overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => (
            <TabsContent key={key} value={key} className="mt-0 px-4 py-3.5">
              <pre>
                <code
                  className="relative font-mono text-sm leading-none"
                  data-language="bash"
                >
                  {value}
                </code>
              </pre>
            </TabsContent>
          ))}
        </div>
      </Tabs>
      <Button
        data-slot="copy-button"
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 z-10 size-7 opacity-70 hover:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          void copyToClipboard(tabs[config.packageManager])
        }}
      >
        <span className="sr-only">Copy</span>
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <span role="status" className="sr-only">
        {isCopied ? "Copied" : ""}
      </span>
    </div>
  )
}
