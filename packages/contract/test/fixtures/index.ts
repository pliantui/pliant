import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import * as z from "zod"

const fixtureSchema = z.object({
  valid: z.array(z.unknown()).min(1),
  invalid: z.array(z.unknown()).min(1),
  crossField: z.array(z.unknown()).optional(),
})

export type Fixture = z.infer<typeof fixtureSchema>

export function readFixture(name: string) {
  return fixtureSchema.parse(
    JSON.parse(
      readFileSync(path.join(import.meta.dirname, `${name}.json`), "utf8")
    )
  )
}

export function readOpFixtures() {
  return new Map(
    readdirSync(path.join(import.meta.dirname, "ops")).map((file) => {
      const name = path.basename(file, ".json")
      return [name, readFixture(`ops/${name}`)] as const
    })
  )
}
