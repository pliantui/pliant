import type { drizzleOverlayStore } from "@pliantui/server/drizzle"

// Stands in for the app's own Drizzle client, such as
// `drizzle(process.env.DATABASE_URL)` from `drizzle-orm/node-postgres`.
export declare const db: Parameters<typeof drizzleOverlayStore>[0]
