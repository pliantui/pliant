export default {
  extends: ["@commitlint/config-conventional"],
  defaultIgnores: false,
  // Dependabot always capitalizes "Bump", and its titles can't be configured.
  ignores: [(message) => /^build\((?:repo|ci)\): Bump \S/.test(message)],
  rules: {
    "scope-empty": [2, "never"],
    "scope-enum": [
      2,
      "always",
      ["contract", "core", "server", "pliantui", "www", "tests", "ci", "repo"],
    ],
  },
}
