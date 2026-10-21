# Contributing

## Commit messages

Every commit message is a [Conventional Commit](https://www.conventionalcommits.org/): `type(scope)!: subject`.

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`.
- Scope is optional. Usual scopes: repertoire, plan, hive, brand, landing, qloo, spotify, lastfm, research, api, e2e, repo, release, deps, av.
- `!` before the colon marks a breaking change.
- Body and footers (for example `Co-Authored-By:`) are free-form.

Example: `fix(research): keep the ask in view when a run pauses`

The `commit-msg` hook (simple-git-hooks, installed by `pnpm install`) and the CI `commitlint` job on pull requests enforce this. History before the adoption commit is not linted.

## Release notes

`NEXT_TAG=v1.0.2 pnpm release-notes` prints the notes for unreleased conventional commits (git-cliff, config in `cliff.toml`).
