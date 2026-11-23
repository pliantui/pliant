import { site } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="group-has-[[data-slot=docs]]/body:hidden">
      <div className="container-wrapper px-4 xl:px-6">
        <div className="flex h-(--footer-height) items-center justify-center">
          <p className="px-1 text-center text-xs leading-loose text-muted-foreground sm:text-sm">
            Built by {site.author}. The source code is available on{" "}
            <a
              href={site.repository}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
