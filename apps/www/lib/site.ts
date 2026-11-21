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
  url,
  repository,
  links: {
    getStarted: "/docs",
    license: `${repository}/blob/main/LICENSE.md`,
    codeOfConduct: `${repository}/blob/main/CODE_OF_CONDUCT.md`,
    security: `${repository}/blob/main/SECURITY.md`,
  },
  nav: [
    { title: "Docs", href: "/docs" },
    { title: "Examples", href: "/examples/orders" },
  ],
} as const
