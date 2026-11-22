export interface NavItem {
  href: string
  label: string
}

function owns(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  const section = href.startsWith("/docs/")
    ? href
    : href.split("/").slice(0, 2).join("/")
  return pathname === section || pathname.startsWith(`${section}/`)
}

// Sections own the routes below them, so `/docs` stays current on every docs
// page, except where a more specific item, like the components in the docs,
// owns the route. The home page only matches itself.
export function getActiveHref(pathname: string, items: readonly NavItem[]) {
  return items
    .filter((item) => owns(pathname, item.href))
    .toSorted((a, b) => b.href.length - a.href.length)[0]?.href
}
