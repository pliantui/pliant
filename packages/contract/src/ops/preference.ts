import * as z from "zod"

export const preferenceOpSchemas = {
  setDensity: z.strictObject({
    op: z.literal("setDensity"),
    target: z.literal("@surface"),
    density: z.enum(["compact", "default", "comfortable"]),
  }),
  setTextScale: z.strictObject({
    op: z.literal("setTextScale"),
    target: z.literal("@app"),
    scale: z.union([
      z.literal(1),
      z.literal(1.125),
      z.literal(1.25),
      z.literal(1.5),
    ]),
  }),
  setMotion: z.strictObject({
    op: z.literal("setMotion"),
    target: z.literal("@app"),
    motion: z.enum(["full", "reduced"]),
  }),
}
