import reactHooks from "eslint-plugin-react-hooks"
import { defineConfig } from "eslint/config"
import globals from "globals"

import base from "../../eslint.config.mjs"

export default defineConfig(
  base,
  reactHooks.configs.flat["recommended-latest"],
  {
    languageOptions: {
      globals: globals.browser,
    },
  }
)
