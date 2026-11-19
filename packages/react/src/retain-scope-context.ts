import { createContext } from "react"

import type { RetainScope } from "./retention"

export const RetainScopeContext = createContext<RetainScope | null>(null)
