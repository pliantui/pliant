import { textSchema } from "./text"

export const labelSchema = textSchema(80).min(1)
