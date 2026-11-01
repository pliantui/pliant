# Releasing

This monorepo publishes its packages independently with [Changesets](https://github.com/changesets/changesets):

- **`pliantui`** — the CLI.
- **`@pliantui/contract`** — schemas, types and the op catalog.
- **`@pliantui/core`** — the headless overlay engine.
- **`@pliantui/server`** — the server handler and AI pipeline.

`@pliantui/contract`, `@pliantui/core` and `@pliantui/server` are marked `"private": true` until they have code to ship; removing `private` is part of their first release (see [First release of a package](#first-release-of-a-package)). While a package is private, Changesets neither versions nor publishes it, so:

- don't add changesets that name it: a changeset for only private packages is never consumed and keeps the release workflow stuck creating version pull requests until it is deleted, and one that mixes private and public packages fails `changeset version`. `pnpm changeset` already hides private packages, so this only happens with hand-written changesets;
- no public package may depend on it, or every Changesets command fails.

## 1. Add a changeset

Every change that should publish needs a changeset:

```bash
pnpm changeset
```

Select the affected packages and the bump level. A pull request with no changeset publishes nothing.

## 2. Stable release

Stable releases are automated by `.github/workflows/release.yml` on push to `main`. It follows the [Changesets automation guide](https://changesets.dev/guide/automating), with each step in its own job and only the permissions that step needs:

1. **select-mode** decides whether there are changesets to version, packages to publish, or nothing to do.
2. **version** opens or updates a **"chore(repo): version packages"** pull request that bumps versions and writes changelogs.
3. When that pull request is merged, **pack** builds every package under `packages/` and packs the ones whose current version isn't on npm yet. It has no write permissions.
4. **publish** publishes the packed tarballs to npm and creates GitHub releases. It is the only job with publish credentials, and it doesn't build anything.

## First release of a package

npm trusted publishing can only be configured for a package that already exists on npm, so a package's first version is published by hand:

1. In the pull request that makes the package ready, remove `"private": true` and add a changeset for it.
2. When the version pull request opens, check out its branch and publish the package's new version from it. `pnpm publish` replaces `workspace:` ranges with real versions, which `npm publish` does not:

   ```bash
   gh pr checkout <number>
   pnpm install --frozen-lockfile
   pnpm build:packages
   pnpm --filter @pliantui/<package> publish --access public --no-git-checks
   ```

3. On npmjs.com, add a trusted publisher for the package: repository `pliantui/pliant`, workflow `release.yml`.
4. Merge the version pull request before merging anything else that changes the package, so the version on `main` matches the one on npm. The release workflow skips a version that is already on npm, so tag it at the version pull request's merge commit and create its GitHub release by hand:

   ```bash
   gh release create "@pliantui/<package>@<version>" --target <merge commit SHA> --notes "<the version's CHANGELOG.md entry>"
   ```

Every later version is published by the release workflow.

## Repository settings

- **General → Pull Requests:** allow squash merging only, with the default commit message set to **Pull request title**, and enable **Automatically delete head branches**.
- **Rules → Rulesets:** a ruleset for the default branch that blocks deletion and force pushes, requires linear history, and requires a pull request merged by squash with these status checks passing: `commitlint`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `pnpm check:packages`, `actionlint`, `pnpm test (Node.js 22.12.0)`, `pnpm test (Node.js 24)` and `pnpm test (zod 4.1.0)`.
- **Actions → General:** enable **Allow GitHub Actions to create and approve pull requests**, so the release workflow can open the version pull request.
- **Features:** enable **Discussions** with a **General** category. The issue templates link there for help.
- **Security:** enable **Private vulnerability reporting**. `SECURITY.md` links to it.

## Notes

- The version pull request is opened with the workflow's `GITHUB_TOKEN`, and GitHub doesn't trigger workflows from that token. Required checks don't run on it on their own; close and reopen it to run them before merging.
- Trusted publishing needs npm 11.5.1 or later. The release jobs use the Node.js version in `.nvmrc`, whose bundled npm meets this.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 2880` (48h), so freshly published dependency versions are not installed until they are two days old.
