import { execSync } from "node:child_process"

// `changeset version` doesn't update pnpm-lock.yaml.
// See https://github.com/changesets/changesets/issues/421.
execSync("pnpm exec changeset version", { stdio: "inherit" })
execSync("pnpm install --lockfile-only", { stdio: "inherit" })
