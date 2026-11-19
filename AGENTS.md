# AGENTS.md

Standards for code and changes in this repository. They apply to every change, including small ones.

## Standard

This repository is held to the standard of [shadcn-ui/ui](https://github.com/shadcn-ui/ui). When unsure how to structure, name or configure something, check how shadcn does it and match it. Deviate only when shadcn's approach doesn't apply, and say why in the pull request.

Before writing a package, study how the best comparable library does it and match its conventions:

| Package              | Study                                 |
| -------------------- | ------------------------------------- |
| `pliantui` (CLI)     | `shadcn` CLI and `@shadcn/registry`   |
| `@pliantui/contract` | Zod                                   |
| `@pliantui/core`     | TanStack Table core, Zod              |
| `@pliantui/react`    | TanStack Table React adapter, Zustand |
| `@pliantui/server`   | Vercel AI SDK                         |
| `apps/www`           | shadcn's `apps/v4` docs               |

## Layout

- Only these paths exist: `.changeset`, `.github`, `apps/www`, `packages/{contract,core,react,server,pliantui,tests}`, the root config files, and the root documents (`README.md`, `CONTRIBUTING.md`, `RELEASING.md`, `SECURITY.md`, `LICENSE.md`, `AGENTS.md`, `CLAUDE.md`).
- No stray files: no notes, plans, reports, scratch scripts, logs or extra markdown. Planning and experiments live outside this repository.
- Documentation is MDX in `apps/www/content/docs`. Package `README.md` files stay short.
- File names are kebab-case. Tests sit next to the code as `*.test.ts`; integration tests go in `packages/tests`.

## Code

- Small, focused modules: one concept per file.
- Minimal public API. Everything exported from a package's `src/index.ts` is public and permanent. Export only what users need; keep the rest internal.
- Named exports only, except where a framework requires a default export (Next.js pages, layouts and routes; config files). ESLint enforces this.
- Naming follows shadcn's conventions: kebab-case files, PascalCase components, hooks starting with `use`, camelCase functions. One addition: Pliant's components carry the `Pliant` prefix (`PliantRegion`), because they sit next to the app's own components.
- No `any`. Use `unknown` and narrow it. No non-null assertions. Type assertions only at validated boundaries.
- Use only public React APIs. Never touch React internals (`_init`, `_payload`, `$$typeof` checks, `__SECRET_INTERNALS…`).
- No comments that narrate what the code does. Comment only a non-obvious why.
- No dead code: no commented-out code or unused exports.
- No new dependency without a reason stated in the pull request. Versions must be older than the 48-hour `minimumReleaseAge`.

## Writing for the public

Everything in this repository and on GitHub (code, comments, docs, READMEs, changesets, pull request titles and descriptions, issues) is written for a reader who knows only what is public.

- Don't refer to private planning: specification sections, phases, internal work or pull request codes, internal registers, release or marketing plans, approvals, or how the work was produced.
- Comments and docs describe what the code does now and why. Don't promise or narrate future work, and don't leave `TODO`s; pending work belongs in an issue or on the public roadmap.
- Link an issue in a comment only when it explains current behaviour, such as a known upstream bug, never to mark something as not done.
- Changesets are release notes: say what changed for users, in plain language.

## Checks

Run these before opening a pull request; all must pass:

```bash
pnpm check
pnpm check:packages
pnpm test
pnpm build
```

The `size-limit` budgets on `@pliantui/contract`, `@pliantui/core` and `@pliantui/react` are deliberate. Raising one needs a stated reason.

## Git

- Every change goes through a pull request from a branch. Pull requests are squash-merged, so the title becomes the commit on `main`.
- One logical change per pull request. Split large features into a sequence of small pull requests that each pass every check.
- Titles follow Conventional Commits with a scope: `feat(core): add layer resolution`. Scopes are `contract`, `core`, `react`, `server`, `pliantui`, `www`, `tests`, `ci` and `repo`. Imperative mood, lowercase, no trailing period.
- The pull request description says what changed and why, how it was tested, and links the issue if there is one.
- Add a changeset to every pull request that changes a published package.
