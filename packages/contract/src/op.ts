import * as z from "zod"

import { actionsOpSchemas } from "./ops/actions"
import { dataOpSchemas } from "./ops/data"
import { formOpSchemas } from "./ops/form"
import { navOpSchemas } from "./ops/nav"
import { preferenceOpSchemas } from "./ops/preference"
import { presentationOpSchemas } from "./ops/presentation"
import { structureOpSchemas } from "./ops/structure"
import { universalOpSchemas } from "./ops/universal"

export const opSchemas = {
  ...universalOpSchemas,
  ...structureOpSchemas,
  ...formOpSchemas,
  ...presentationOpSchemas,
  ...navOpSchemas,
  ...actionsOpSchemas,
  ...dataOpSchemas,
  ...preferenceOpSchemas,
}

export const opSchema = z
  .discriminatedUnion("op", [
    opSchemas.setProp,
    opSchemas.rename,
    opSchemas.hide,
    opSchemas.show,
    opSchemas.move,
    opSchemas.collapse,
    opSchemas.pin,
    opSchemas.setLayout,
    opSchemas.span,
    opSchemas.insert,
    opSchemas.wrap,
    opSchemas.remove,
    opSchemas.setDefault,
    opSchemas.setPresentation,
    opSchemas.setSize,
    opSchemas.setLanding,
    opSchemas.promote,
    opSchemas.demote,
    opSchemas.bindShortcut,
    opSchemas.setSort,
    opSchemas.setFilter,
    opSchemas.clearFilter,
    opSchemas.setPage,
    opSchemas.setGroupBy,
    opSchemas.addDerived,
    opSchemas.addAggregate,
    opSchemas.formatField,
    opSchemas.addHighlight,
    opSchemas.addSortOption,
    opSchemas.addFilterControl,
    opSchemas.addPreset,
    opSchemas.setViewKind,
    opSchemas.configureChart,
    opSchemas.configureStat,
    opSchemas.removeUserItem,
    opSchemas.setColumnWidth,
    opSchemas.setDensity,
    opSchemas.setTextScale,
    opSchemas.setMotion,
  ])
  .meta({
    title: "Pliant op",
    description: "One change to a surface, validated against the op catalog.",
  })

export type Op = z.infer<typeof opSchema>

export type OpName = Op["op"]
