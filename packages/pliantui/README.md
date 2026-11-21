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

```bash
npx pliantui scan
```

Lists the node ids on each surface of your app, and which node holds which, for core's `baseIds` and `baseParents`. Pass `--check` in CI.

```bash
npx pliantui skills add
```

Copies Pliant's skills for coding agents into your project, to `.claude/skills` if you have a `.claude` folder and `.agents/skills` if not. Ask your agent to set up Pliant and it follows the `setup` skill.

See the [CLI docs](https://github.com/pliantui/pliant/blob/main/apps/www/content/docs/cli.mdx).

Pliant is in early development. See https://github.com/pliantui/pliant.
