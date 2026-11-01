import * as z from "zod"

import { actionsOpSchemas } from "./ops/actions"
import { dataOpSchemas } from "./ops/data"
import { formOpSchemas } from "./ops/form"
import { navOpSchemas } from "./ops/nav"
import { preferenceOpSchemas } from "./ops/preference"
import { presentationOpSchemas } from "./ops/presentation"
import { structureOpSchemas } from "./ops/structure"
import { universalOpSchemas } from "./ops/universal"

export const opSchema = z.discriminatedUnion("op", [
  ...universalOpSchemas,
  ...structureOpSchemas,
  ...formOpSchemas,
  ...presentationOpSchemas,
  ...navOpSchemas,
  ...actionsOpSchemas,
  ...dataOpSchemas,
  ...preferenceOpSchemas,
])

export type Op = z.infer<typeof opSchema>

export type OpName = Op["op"]
