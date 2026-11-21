---
"pliantui": minor
---

Add `pliantui init`. In a Next.js App Router project that already uses shadcn/ui, it adds `@pliantui/react` with your package manager and the `pliant-region` component with `shadcn add`, then prints how to wrap a page in `PliantRoot`. It asks before each step, and `--yes` skips the questions. Run it again and it skips what is already installed.
