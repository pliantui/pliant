export interface NavItem {
  href: string
  label: string
}

// Sections own the routes below them, so `/docs` stays current on every docs
// page. The home page only matches itself.
export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  const section = href.split("/").slice(0, 2).join("/")
  return pathname === section || pathname.startsWith(`${section}/`)
}
