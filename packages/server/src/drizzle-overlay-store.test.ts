import { PGlite } from "@electric-sql/pglite"
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { drizzleOverlayStore } from "./drizzle-overlay-store"
import { pliantOverlayHistory, pliantOverlays } from "./drizzle-overlay-tables"
import { key, record, testOverlayStore } from "./overlay-store-suite"

const client = new PGlite()
const db = drizzle({ client, schema: { pliantOverlays, pliantOverlayHistory } })

beforeAll(async () => {
  const statements = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson({ pliantOverlays, pliantOverlayHistory })
  )
  for (const statement of statements) {
    await client.exec(statement)
  }
}, 60_000)

afterAll(() => client.close())

async function emptyStore() {
  await db.delete(pliantOverlays)
  await db.delete(pliantOverlayHistory)
  return drizzleOverlayStore(db)
}

describe("drizzleOverlayStore", () => {
  testOverlayStore(emptyStore)

  it("stores nothing when its history row can't be written", async () => {
    const store = await emptyStore()
    await db.insert(pliantOverlayHistory).values({
      ...key,
      version: 1,
      record: record("x", 1),
      by: "ana",
      updatedAt: record("x", 1).updatedAt,
    })
    await expect(
      store.put(key, record("a", 1), null, { by: "ana" })
    ).rejects.toThrow()
    expect(await store.get(key)).toBeUndefined()
  })
})
