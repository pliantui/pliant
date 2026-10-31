/** @type {import('prettier').Config} */
module.exports = {
  endOfLine: "lf",
  semi: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
  importOrder: [
    "^(react/(.*)$)|^(react$)",
    "^(next/(.*)$)|^(next$)",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@pliantui/(.*)$",
    "",
    "^@/(.*)$",
    "",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  overrides: [
    {
      files: "apps/www/**",
      options: {
        plugins: [
          "@ianvs/prettier-plugin-sort-imports",
          "prettier-plugin-tailwindcss",
        ],
        tailwindStylesheet: "./apps/www/app/globals.css",
        tailwindFunctions: ["cn", "cva"],
      },
    },
  ],
}
