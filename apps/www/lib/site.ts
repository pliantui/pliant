declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SITE_URL?: string
    }
  }
}

const repository = "https://github.com/pliantui/pliant"

// Inlined when the site is built, so set it in the build environment to serve
// the site from another address.
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""
const url =
  configuredUrl === ""
    ? "https://pliantui-www.pliantui-dev.workers.dev"
    : configuredUrl.replace(/\/+$/, "")

export const site = {
  name: "Pliant",
  description: "Let the users of your shadcn app reshape it to fit their work.",
  headline: "Your app, shaped by the people who use it.",
  summary:
    "Point at any part of your shadcn app and ask for a change. Pliant reshapes it with your own components, within the rules you set.",
  author: "Hitesh Shivkumar",
  url,
  repository,
  links: {
    getStarted: "/docs",
    launchPost: "/blog/introducing-pliant",
    tour: "/tour",
  },
  navItems: [
    { href: "/", label: "Home" },
    { href: "/docs", label: "Docs" },
    { href: "/docs/components", label: "Components" },
    { href: "/blocks", label: "Blocks" },
    { href: "/charts", label: "Charts" },
    { href: "/examples/orders", label: "Examples" },
    { href: "/playground", label: "Playground" },
    { href: "/directory", label: "Directory" },
    { href: "/templates", label: "Templates" },
  ],
} as const

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#0a0a0a",
}
