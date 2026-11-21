import Link from "next/link"

import { site } from "@/lib/site"

const links = [
  { title: "Docs", href: "/docs" },
  { title: "Examples", href: "/examples/orders" },
  { title: "GitHub", href: site.repository, external: true },
  { title: "License", href: site.links.license, external: true },
  { title: "Code of conduct", href: site.links.codeOfConduct, external: true },
  { title: "Security policy", href: site.links.security, external: true },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-4 px-4 py-8 lg:px-6">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map((link) => (
              <li key={link.title}>
                {"external" in link ? (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm text-fd-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {link.title}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className="rounded-sm text-fd-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {link.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-fd-muted-foreground">
          Released under the MIT license.
        </p>
      </div>
    </footer>
  )
}
