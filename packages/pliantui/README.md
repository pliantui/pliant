# pliantui

A CLI for adding Pliant to your shadcn app.

```bash
npx pliantui init
```

Adds `@pliantui/react` and the `pliant-region` component to a Next.js App Router project that already uses shadcn/ui. It asks before each step and prints the next step when it finishes.

```bash
npx pliantui manifest
```

Reads the `cva` and `tailwind-variants` definitions in your ui folder, without running your code, and writes a manifest for every component that uses one. You review what it found before anything is written; pass `--yes` to skip the review.

See the [CLI docs](https://github.com/pliantui/pliant/blob/main/apps/www/content/docs/cli.mdx).

Pliant is in early development. See https://github.com/pliantui/pliant.
