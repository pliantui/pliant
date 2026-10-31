import nextVitals from "eslint-config-next/core-web-vitals"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"

import base from "../../eslint.config.mjs"

export default defineConfig(
  globalIgnores(["next-env.d.ts"]),
  // next/typescript registers @typescript-eslint again; the base config already does.
  nextVitals.map((config) =>
    config.name === "next/typescript" ? { ...config, plugins: {} } : config
  ),
  base,
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["app/**/{page,layout,route}.{ts,tsx}"],
    rules: {
      "no-restricted-exports": "off",
    },
  }
)
