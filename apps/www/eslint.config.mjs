import nextVitals from "eslint-config-next/core-web-vitals"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"

import base from "../../eslint.config.mjs"

const letters = "/\\p{L}/u"
const textAttributes =
  "/^(alt|aria-description|aria-label|aria-placeholder|aria-roledescription|aria-valuetext|placeholder|title)$/"
// Where text shows: an element's children and the attributes read as text.
const textContainers = [
  "JSXElement > JSXExpressionContainer",
  "JSXFragment > JSXExpressionContainer",
  `JSXAttribute[name.name=${textAttributes}] > JSXExpressionContainer`,
]
// Text written in place, alone or as an operand of `?:`, `&&`, `||` or `??`.
const textSelectors = [
  `JSXText[value=${letters}]`,
  `JSXAttribute[name.name=${textAttributes}] > Literal`,
  ...textContainers.flatMap((container) => [
    `${container} > Literal[value=${letters}]`,
    `${container} > TemplateLiteral > TemplateElement[value.cooked=${letters}]`,
    ...["ConditionalExpression", "LogicalExpression"].flatMap((operator) => [
      `${container} > ${operator} > Literal[value=${letters}]`,
      `${container} > ${operator} > TemplateLiteral > TemplateElement[value.cooked=${letters}]`,
    ]),
  ]),
]

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
    files: ["registry/pliant/**/*.tsx"],
    ignores: ["registry/pliant/**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...textSelectors.map((selector) => ({
          selector,
          message: "Show text from usePliantMessages, not a literal.",
        })),
      ],
    },
  },
  {
    files: ["app/**/{page,layout,route,not-found}.{ts,tsx}"],
    rules: {
      "no-restricted-exports": "off",
    },
  },
  {
    // Docs snippets are code readers copy into their own app, so they follow
    // the app's conventions, like a page's default export.
    files: ["snippets/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-exports": "off",
    },
  }
)
