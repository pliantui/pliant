import type { Diagnostic } from "../utils/diagnostic"

export type CheckStatus = "pass" | "warn" | "fail" | "skip"

/** The result of one of `doctor`'s checks, with how to fix it. */
export interface Check {
  name: string
  status: CheckStatus
  message: string
  fix?: string | undefined
  problems?: Diagnostic[] | undefined
}
