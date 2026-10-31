#!/usr/bin/env node
import { Command } from "commander"

import packageJson from "../package.json" with { type: "json" }

const program = new Command()
  .name("pliantui")
  .description("make your shadcn app reshapeable by its users")
  .version(packageJson.version, "-v, --version", "display the version number")

program.parse()
