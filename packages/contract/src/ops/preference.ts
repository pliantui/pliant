import * as z from "zod"

export const preferenceOpSchemas = [
  z.object({
    op: z.literal("setDensity"),
    target: z.literal("@surface"),
    density: z.enum(["compact", "default", "comfortable"]),
  }),
  z.object({
    op: z.literal("setTextScale"),
    target: z.literal("@app"),
    scale: z.union([
      z.literal(1),
      z.literal(1.125),
      z.literal(1.25),
      z.literal(1.5),
    ]),
  }),
  z.object({
    op: z.literal("setMotion"),
    target: z.literal("@app"),
    motion: z.enum(["full", "reduced"]),
  }),
] as const
