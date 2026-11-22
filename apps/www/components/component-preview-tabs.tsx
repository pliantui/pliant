"use client"

import * as React from "react"
import { cn } from "cn"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ComponentPreviewTabs({
  className,
  previewClassName,
  align = "center",
  component,
  source,
  ...props
}: React.ComponentProps<"div"> & {
  previewClassName?: string | undefined
  align?: "center" | "start" | "end" | undefined
  component: React.ReactNode
  source: React.ReactNode
}) {
  return (
    <div
      data-slot="component-preview"
      data-not-typeset
      className={cn("group relative mt-4 mb-12 flex flex-col gap-2", className)}
      {...props}
    >
      <Tabs defaultValue="preview" className="gap-4">
        <TabsList className="justify-start gap-4 rounded-none bg-transparent px-0">
          {["preview", "code"].map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 text-base text-muted-foreground capitalize hover:text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none! dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent"
            >
              {value}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          value="preview"
          className="rounded-2xl border"
          // The preview is interactive, so it isn't a tab stop of its own.
          tabIndex={-1}
        >
          <div
            data-align={align}
            className={cn(
              "flex min-h-72 w-full justify-center p-4 data-[align=center]:items-center data-[align=end]:items-end data-[align=start]:items-start sm:p-10",
              previewClassName
            )}
          >
            {component}
          </div>
        </TabsContent>
        <TabsContent
          value="code"
          className="*:data-rehype-pretty-code-figure:mx-0 *:data-rehype-pretty-code-figure:mt-0"
        >
          {source}
        </TabsContent>
      </Tabs>
    </div>
  )
}
