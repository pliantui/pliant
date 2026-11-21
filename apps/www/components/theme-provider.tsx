"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function isEditable(target: EventTarget | null) {
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function ThemeShortcut() {
  const { setTheme, resolvedTheme } = useTheme()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "d" || e.key === "D") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        if (isEditable(e.target)) return

        e.preventDefault()
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    }

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
      {...props}
    >
      <ThemeShortcut />
      {children}
    </NextThemesProvider>
  )
}
