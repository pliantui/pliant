import type { Metadata } from "next"

import { Provider } from "@/components/provider"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Pliant",
    template: "%s – Pliant",
  },
  description: "Let the users of your shadcn app reshape it to fit their work.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Provider>
      </body>
    </html>
  )
}
