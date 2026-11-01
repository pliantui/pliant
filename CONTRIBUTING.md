# Contributing

Thanks for your interest in contributing to Pliant. We're happy to have you here.

Please take a moment to review this document before submitting your first pull request. We also recommend checking open issues and pull requests to see if someone else is working on something similar.

## About this repository

This repository is a monorepo.

- We use [pnpm](https://pnpm.io) and [`workspaces`](https://pnpm.io/workspaces) for development.
- We use [Turborepo](https://turbo.build/repo) as our build system.
- We use [changesets](https://github.com/changesets/changesets) for managing releases.

## Structure

```
apps
└── www
    ├── app
    └── content
packages
├── contract
├── core
├── pliantui
├── server
└── tests
```

| Path                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `apps/www`          | The Next.js application for the documentation site. |
| `apps/www/content`  | The documentation, written in MDX.                  |
| `packages/contract` | The `@pliantui/contract` package.                   |
| `packages/core`     | The `@pliantui/core` package.                       |
| `packages/server`   | The `@pliantui/server` package.                     |
| `packages/pliantui` | The `pliantui` CLI.                                 |
| `packages/tests`    | Integration tests for the CLI.                      |

## Development

### Fork this repo

You can fork this repo by clicking the fork button in the top right corner of this page.

### Clone on your local machine

```bash
git clone https://github.com/your-username/pliant.git
```

### Navigate to project directory

```bash
cd pliant
```

### Create a new branch

```bash
git checkout -b my-new-branch
```

### Install dependencies

```bash
pnpm install
```

### Run a workspace

Use `pnpm --filter=[WORKSPACE]` to run a script in a workspace.

1. To run the documentation site:

```bash
pnpm --filter=www dev
```

2. To build a package in watch mode:

```bash
pnpm --filter=@pliantui/core dev
```

## Documentation

Documentation is written in [MDX](https://mdxjs.com) and lives in `apps/www/content/docs`. Run the site locally with `pnpm --filter=www dev`.

## Checks

Before opening a pull request, run:

```bash
pnpm check
pnpm check:packages
pnpm test
pnpm build
```

`pnpm check` runs lint, typecheck, format and workspace checks. `pnpm check:packages` builds the packages and validates them with [publint](https://publint.dev), [Are the Types Wrong?](https://arethetypeswrong.github.io) and [size-limit](https://github.com/ai/size-limit).

## Commit convention

Commits follow [Conventional Commits](https://www.conventionalcommits.org): `category(scope): message`, using one of these categories:

- `feat`: a new feature
- `fix`: a bug fix
- `refactor`: a code change that is neither a fix nor a feature
- `docs`: documentation only
- `build`: the build system or dependencies
- `test`: adding or changing tests
- `ci`: continuous integration configuration
- `perf`: a performance improvement
- `style`: formatting only, no code change
- `revert`: reverts a previous commit
- `chore`: anything else

The scope is required and is one of `contract`, `core`, `server`, `pliantui`, `www`, `tests`, `ci` or `repo`. Write the message in the imperative mood, in lowercase, with no trailing period.

For example: `feat(core): add layer resolution`. Retitle reverts to match, for example `revert(core): add layer resolution`.

## Pull requests

- Keep each pull request to one logical change. Split large features into a sequence of small pull requests.
- Pull requests are squash-merged, so the pull request title becomes the commit on `main`. CI checks that the title follows the commit convention. Dependabot's titles are the one exception: they start with a capitalised "Bump", which Dependabot can't be configured to change.
- Fill in the pull request template: what changed and why, how it was tested, and the related issue.

## Changesets

If your change affects a published package, add a changeset. Dependabot pull requests that change a published package's `dependencies` or `peerDependencies` need one too; a maintainer adds it before merging.

To add a changeset, run:

```bash
pnpm changeset
```

See [RELEASING.md](RELEASING.md) for how releases work.

## Testing

Tests are written with [Vitest](https://vitest.dev). Run them from the root of the repository:

```bash
pnpm test
```

Please make sure the tests pass before submitting a pull request, and include tests for new features.
