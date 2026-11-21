import type { Metadata } from "next"
import { cn } from "cn"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { fontVariables } from "@/lib/fonts"
import { META_THEME_COLORS, site } from "@/lib/site"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s - ${site.name}`,
  },
  description: site.description,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        fontVariables,
        "[--header-height:calc(var(--spacing)*14)] lg:[--header-height:calc(var(--spacing)*16)]"
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `,
          }}
        />
        <meta name="theme-color" content={META_THEME_COLORS.light} />
      </head>
      <body className="group/body overscroll-none antialiased [--footer-height:calc(var(--spacing)*14)] xl:[--footer-height:calc(var(--spacing)*24)]">
        <ThemeProvider>
          <TooltipProvider delayDuration={0}>
            {/* The ask panel docks to the right edge, or the bottom on phones;
                the layout makes room for it so it covers none of the page. */}
            <div
              data-slot="layout"
              className="group/layout relative z-10 flex min-h-svh flex-col bg-background max-sm:has-[[data-slot=pliant-ask-panel]]:pb-[60dvh] sm:has-[[data-slot=pliant-ask-panel]]:pr-96"
            >
              <SiteHeader />
              <main
                id="main"
                tabIndex={-1}
                className="flex min-h-0 flex-1 flex-col outline-none"
              >
                {children}
              </main>
              <SiteFooter />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
