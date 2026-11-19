import Ajv from "ajv/dist/2020"
import { describe, expect, it } from "vitest"
import * as z from "zod"

import { languageTagSchema } from "./language-tag"

const wellFormed = [
  "en",
  "fr-CA",
  "EN-us",
  "zh-Hant-TW",
  "zh-yue-HK",
  "sr-Latn-RS",
  "es-419",
  "de-CH-1996",
  "sl-rozaj-biske",
  "de-DE-u-co-phonebk",
  "en-US-x-twain",
  "ja-t-it",
  "qaa-Qaaa-QM-x-southern",
  "abcd",
  "und",
]

const malformed = [
  "",
  "e",
  "en-US-",
  "en_US",
  "en-",
  "-en",
  "en--US",
  "en-u",
  "en-x",
  "x-private",
  "i-klingon",
  "en-US-x-toolongsubtag",
  "1en",
  "en US",
  "en-a-b",
  `en${"-variant".repeat(8)}`,
]

describe("languageTagSchema", () => {
  it.each(wellFormed)("accepts %s", (tag) => {
    expect(languageTagSchema.safeParse(tag).success).toBe(true)
  })

  it.each(malformed)("rejects %j", (tag) => {
    expect(languageTagSchema.safeParse(tag).success).toBe(false)
  })

  it("agrees with its JSON Schema", () => {
    const validate = new Ajv({ strict: true }).compile(
      z.toJSONSchema(languageTagSchema)
    )
    for (const tag of [...wellFormed, ...malformed]) {
      expect(validate(tag), tag).toBe(languageTagSchema.safeParse(tag).success)
    }
  })

  it("accepts every tag Intl accepts", () => {
    const accepted = [...wellFormed, ...malformed].filter((tag) => {
      try {
        return Intl.getCanonicalLocales(tag).length === 1
      } catch {
        return false
      }
    })
    expect(accepted.length).toBeGreaterThan(10)
    for (const tag of accepted) {
      expect(languageTagSchema.safeParse(tag).success, tag).toBe(true)
    }
  })
})
