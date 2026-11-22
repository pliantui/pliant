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
  headline: "Build pliant interfaces: apps your users can reshape.",
  summary:
    "Your users reshape your shadcn app, by hand or by asking, within the rules you set.",
  url,
  repository,
  links: {
    getStarted: "/docs",
    license: `${repository}/blob/main/LICENSE.md`,
    shadcnLicense: `${repository}/blob/main/apps/www/LICENSE-shadcn.md`,
    codeOfConduct: `${repository}/blob/main/CODE_OF_CONDUCT.md`,
    security: `${repository}/blob/main/SECURITY.md`,
  },
  navItems: [
    { href: "/", label: "Home" },
    { href: "/docs", label: "Docs" },
    { href: "/components", label: "Components" },
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
