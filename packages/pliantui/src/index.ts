#!/usr/bin/env node
import { Command } from "commander"

import packageJson from "../package.json" with { type: "json" }
import { init } from "./commands/init"
import { manifest } from "./commands/manifest"
import { skills } from "./commands/skills"

process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

const program = new Command()
  .name("pliantui")
  .description("make your shadcn app reshapeable by its users")
  .version(packageJson.version, "-v, --version", "display the version number")

program.addCommand(init)
program.addCommand(manifest)
program.addCommand(skills)

program.parse()
