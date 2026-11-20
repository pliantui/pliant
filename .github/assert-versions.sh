#!/usr/bin/env bash
# Fails unless every dependency is installed at the given version in every
# workspace package, so a version swap that didn't take can't pass silently.
# Usage: assert-versions.sh <version> "<dependency>..." <package>...
set -euo pipefail

version=$1
dependencies=$2
shift 2

if [ "$#" -eq 0 ]; then
  echo "assert-versions.sh: no packages given" >&2
  exit 1
fi

for package in "$@"; do
  for dependency in $dependencies; do
    pnpm --filter "$package" --fail-if-no-match exec node -e '
      const [dependency, want] = process.argv.slice(1)
      const { version } = JSON.parse(
        require("node:fs").readFileSync("node_modules/" + dependency + "/package.json", "utf8")
      )
      if (version !== want) throw new Error(dependency + " is " + version + ", not " + want)
    ' "$dependency" "$version"
  done
done
