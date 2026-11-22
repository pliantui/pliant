import Link from "next/link"

import { site } from "@/lib/site"

const links = [
  { title: "Docs", href: "/docs" },
  { title: "Components", href: "/docs/components" },
  { title: "Examples", href: "/examples/orders" },
  { title: "Roadmap", href: "/roadmap" },
  { title: "Changelog", href: "/changelog" },
  { title: "GitHub", href: site.repository, external: true },
  { title: "License", href: site.links.license, external: true },
  { title: "Code of conduct", href: site.links.codeOfConduct, external: true },
  { title: "Security policy", href: site.links.security, external: true },
] as const

const linkClassName =
  "rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function SiteFooter() {
  return (
    <footer className="group-has-[[data-slot=docs]]/body:hidden">
      <div className="container-wrapper px-4 xl:px-6">
        <div className="flex min-h-(--footer-height) flex-col items-center justify-center gap-3 py-6 text-center text-xs leading-loose text-muted-foreground sm:text-sm">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1">
              {links.map((link) => (
                <li key={link.title}>
                  {"external" in link ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClassName}
                    >
                      {link.title}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClassName}>
                      {link.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <p className="px-1">
            Built on the design of the{" "}
            <a
              href="https://ui.shadcn.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              shadcn/ui
            </a>{" "}
            site, used under its{" "}
            <a
              href={site.links.shadcnLicense}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              MIT license
            </a>
            . The source code is available on{" "}
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
