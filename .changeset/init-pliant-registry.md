---
"pliantui": minor
---

`pliantui init` now adds the `@pliant` registry to `components.json` and installs components by name, with `shadcn add @pliant/pliant-region`. After it runs, you can add any other Pliant component the same way, such as `npx shadcn@latest add @pliant/pliant-data-table`. An `@pliant` entry you already have is kept unless you pass `--registry` with another URL.
