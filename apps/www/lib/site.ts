const repository = "https://github.com/pliantui/pliant"

export const site = {
  name: "Pliant",
  description: "Let the users of your shadcn app reshape it to fit their work.",
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
    { href: "/examples/orders", label: "Examples" },
  ],
} as const

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#0a0a0a",
}
