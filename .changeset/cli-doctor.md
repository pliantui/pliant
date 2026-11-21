---
"pliantui": minor
---

Add `pliantui doctor`. It checks that Pliant is set up correctly and prints how to fix what isn't: a Next.js App Router project with `components.json`, `@pliantui/react` in `package.json`, Pliant's components in your `components` folder, a `PliantPrePaint` with the same `surface` in the route of every `PliantRoot`, and an inventory from `pliantui scan` that is up to date. It exits with code 1 when a check fails, and `--json` prints the checks for scripts and agents.
