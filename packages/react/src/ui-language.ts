import { languageTagSchema } from "@pliantui/contract"

import { isDevelopment } from "./is-development"

function pageLanguage() {
  if (typeof document === "undefined") {
    return undefined
  }
  const lang = languageTagSchema.safeParse(document.documentElement.lang)
  return lang.success ? lang.data : undefined
}

/**
 * Checks the `lang` an app passes. A malformed tag is ignored, so the page
 * language applies instead.
 */
export function checkLanguage(lang: string | undefined) {
  if (lang === undefined || languageTagSchema.safeParse(lang).success) {
    return lang
  }
  if (isDevelopment) {
    console.warn(`Pliant: lang "${lang}" isn't a BCP 47 tag; using <html lang>`)
  }
  return undefined
}

/** The UI language: the app's `lang`, else the page's `<html lang>`. */
export function uiLanguage(lang: string | undefined) {
  return lang ?? pageLanguage()
}
