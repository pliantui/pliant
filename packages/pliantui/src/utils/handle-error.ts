import * as z from "zod"

import { highlighter } from "./highlighter"
import { logger } from "./logger"

export function handleError(error: unknown): never {
  logger.break()
  logger.error(
    "Something went wrong. Please check the error below for more details."
  )
  logger.error("If the problem persists, please open an issue on GitHub.")
  logger.error("")
  if (typeof error === "string") {
    logger.error(error)
  } else if (error instanceof z.ZodError) {
    logger.error("Validation failed:")
    for (const issue of error.issues) {
      logger.error(
        `- ${highlighter.info(issue.path.join(".") || "(root)")}: ${issue.message}`
      )
    }
  } else if (error instanceof Error) {
    logger.error(error.message)
  }
  logger.break()
  process.exit(1)
}
