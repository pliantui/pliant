# pliantui

A CLI for adding Pliant to your shadcn app.

```bash
npx pliantui manifest
```

Reads the `cva` and `tailwind-variants` definitions in your ui folder, without running your code, and writes a manifest for each component that has options users could change. You review what it found before anything is written; pass `--yes` to skip the review.

Pliant is in early development. See https://github.com/pliantui/pliant.
