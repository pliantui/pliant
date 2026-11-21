import Link from "next/link"

import { CopyCommand } from "@/components/copy-command"
import { GitHubIcon } from "@/components/github-icon"
import { buttonVariants } from "@/components/ui/button"
import { site } from "@/lib/site"

export default function HomePage() {
  return (
    <main id="main" className="flex-1">
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Build pliant interfaces: apps your users can reshape.
        </h1>
        <p className="max-w-2xl text-lg text-balance text-fd-muted-foreground">
          Pliant adds per-user and per-team customization to your shadcn app,
          within the rules you set.
        </p>
        <CopyCommand command={site.installCommand} />
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={site.links.getStarted}
            className={buttonVariants({ size: "lg" })}
          >
            Get started
          </Link>
          <a
            href={site.repository}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>
      </section>
      <section className="border-t">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Try it on your own app
          </h2>
          <CopyCommand command={site.installCommand} />
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={site.links.getStarted}
              className={buttonVariants({ variant: "outline" })}
            >
              Read the docs
            </Link>
            <a
              href={site.repository}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <GitHubIcon />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
