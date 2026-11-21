const repository = "https://github.com/pliantui/pliant"

export const site = {
  name: "Pliant",
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
