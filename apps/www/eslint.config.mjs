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
    // Registry components show text from `usePliantMessages`, so apps can
    // replace it through `PliantRoot`'s `messages`.
    files: ["registry/**/*.tsx"],
    ignores: ["registry/**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/\\p{L}/u]",
          message: "Show text from usePliantMessages, not a literal.",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(alt|aria-description|aria-label|aria-placeholder|aria-roledescription|aria-valuetext|placeholder|title)$/] > Literal",
          message: "Show text from usePliantMessages, not a literal.",
        },
      ],
    },
  },
  {
    files: ["app/**/{page,layout,route}.{ts,tsx}"],
    rules: {
      "no-restricted-exports": "off",
    },
  }
)
