import { stripVTControlCharacters } from "node:util"

import { detectProject } from "../init/detect-project"
import type { Check } from "./check"

const reactPackage = "@pliantui/react"

/** Whether the project is a Next.js App Router app with `@pliantui/react`. */
export async function checkProject(cwd: string): Promise<Check[]> {
  let project: Awaited<ReturnType<typeof detectProject>>
  try {
    project = await detectProject(cwd)
  } catch (error) {
    const message =
      error instanceof Error ? stripVTControlCharacters(error.message) : ""
    return [
      {
        name: "project",
        status: "fail",
        message,
        fix: "Run pliantui doctor in your app's folder, or pass --cwd.",
      },
      {
        name: "react-package",
        status: "skip",
        message: `${reactPackage} can't be checked without a package.json.`,
      },
    ]
  }
  if (!project.supported) {
    return [
      {
        name: "project",
        status: "fail",
        message: `${project.description} isn't supported. Pliant needs Next.js with an app or src/app folder.`,
        fix: "Run pliantui doctor in a Next.js App Router project.",
      },
      {
        name: "react-package",
        status: "skip",
        message: `${reactPackage} is checked only in a Next.js App Router project.`,
      },
    ]
  }
  return [
    {
      name: "project",
      status: "pass",
      message: "Next.js App Router project.",
    },
    reactPackage in project.dependencies
      ? {
          name: "react-package",
          status: "pass",
          message: `${reactPackage} is in package.json.`,
        }
      : {
          name: "react-package",
          status: "fail",
          message: `${reactPackage} isn't in package.json.`,
          fix: "Run npx pliantui init.",
        },
  ]
}
