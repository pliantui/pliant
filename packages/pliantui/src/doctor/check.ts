import type { Diagnostic } from "../utils/diagnostic"

export type CheckStatus = "pass" | "warn" | "fail" | "skip"

/** Something a check found, and whether it fails the check or warns. */
export interface Problem extends Diagnostic {
  status: "fail" | "warn"
}

/** The result of one of `doctor`'s checks, with how to fix it. */
export interface Check {
  name: string
  status: CheckStatus
  message: string
  fix?: string | undefined
  problems?: Problem[] | undefined
}

export function problemsOf(
  status: Problem["status"],
  diagnostics: readonly Diagnostic[]
): Problem[] {
  return diagnostics.map((diagnostic) => ({ ...diagnostic, status }))
}
