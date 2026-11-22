import Link from "next/link"

import { CodeBlockCommand } from "@/components/code-block-command"
import { site } from "@/lib/site"

const item = `${site.url}/r/pliant-region.json`

export function Install() {
  return (
    <section
      aria-labelledby="install-heading"
      className="container-wrapper border-t"
    >
      <div className="container flex flex-col items-center gap-4 py-12 text-center md:py-16">
        <h2
          id="install-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Add it to your app
        </h2>
        <p className="max-w-xl text-muted-foreground">
          Add a Pliant region with the shadcn CLI, then follow the{" "}
          <Link
            href="/docs/installation"
            className="font-medium text-foreground underline underline-offset-4"
          >
            installation guide
          </Link>{" "}
          to connect it to your app.
        </p>
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border bg-code text-left text-code-foreground">
          <CodeBlockCommand
            __pnpm__={`pnpm dlx shadcn@latest add ${item}`}
            __npm__={`npx shadcn@latest add ${item}`}
            __yarn__={`yarn dlx shadcn@latest add ${item}`}
            __bun__={`bunx --bun shadcn@latest add ${item}`}
          />
        </div>
      </div>
    </section>
  )
}
