#!/usr/bin/env bash
# Fails unless every dependency is installed at the given version in every
# workspace package, so a version swap that didn't take can't pass silently.
# Usage: assert-versions.sh <version> "<dependency>..." <package>...
set -euo pipefail

version=$1
dependencies=$2
shift 2

for package in "$@"; do
  for dependency in $dependencies; do
    pnpm --filter "$package" exec node -e '
      const [dependency, want] = process.argv.slice(1)
      const { version } = JSON.parse(
        require("node:fs").readFileSync("node_modules/" + dependency + "/package.json", "utf8")
      )
      if (version !== want) throw new Error(dependency + " is " + version + ", not " + want)
    ' "$dependency" "$version"
  done
done
