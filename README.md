# create-fsd-architecture

Create frontend starter projects with a complete
[Feature-Sliced Design](https://feature-sliced.design/) structure.

[![npm version](https://img.shields.io/npm/v/create-fsd-architecture?style=flat-square&logo=npm&label=release)](https://www.npmjs.com/package/create-fsd-architecture)
[![Weekly downloads](https://img.shields.io/npm/dw/create-fsd-architecture?style=flat-square&logo=npm&label=downloads%2Fweek)](https://www.npmjs.com/package/create-fsd-architecture)
[![Total downloads](https://img.shields.io/npm/dt/create-fsd-architecture?style=flat-square&logo=npm&label=total%20downloads)](https://www.npmjs.com/package/create-fsd-architecture)
[![Node.js version](https://img.shields.io/node/v/create-fsd-architecture?style=flat-square&logo=nodedotjs&label=node)](https://www.npmjs.com/package/create-fsd-architecture)

[![Contributors](https://img.shields.io/github/contributors/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/graphs/contributors)
[![Forks](https://img.shields.io/github/forks/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/forks)
[![Stars](https://img.shields.io/github/stars/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/stargazers)
[![Open issues](https://img.shields.io/github/issues/FSD-CLI/cli?style=flat-square&logo=github&label=issues%20open)](https://github.com/FSD-CLI/cli/issues?q=is%3Aissue%20is%3Aopen)
[![Closed issues](https://img.shields.io/github/issues-closed/FSD-CLI/cli?style=flat-square&logo=github&label=issues%20closed)](https://github.com/FSD-CLI/cli/issues?q=is%3Aissue%20is%3Aclosed)
[![License](https://img.shields.io/github/license/FSD-CLI/cli?style=flat-square&label=license)](https://github.com/FSD-CLI/cli/blob/main/LICENSE)

[![CI workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/ci.yml?branch=main&style=flat-square&logo=githubactions&label=CI)](https://github.com/FSD-CLI/cli/actions/workflows/ci.yml)
[![Dependency security workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/dependency-security.yml?branch=main&style=flat-square&logo=githubactions&label=dependency%20security)](https://github.com/FSD-CLI/cli/actions/workflows/dependency-security.yml)
[![Release workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/github-release.yml?style=flat-square&logo=githubactions&label=release%20workflow)](https://github.com/FSD-CLI/cli/actions/workflows/github-release.yml)

- Documentation: https://fsdcli.me
- GitHub: https://github.com/FSD-CLI/cli

## Validation scope

Generated projects are starting points. Passing CLI or template checks does not
certify application-specific security, authentication, runtime behavior, or
production deployment. Consult the [current release status](docs/RELEASE-STATUS.md)
for evidence and untested combinations.

## Repository documentation

Angular's standalone starter has an inspectable configuration contract in CLI
source (`check`, `doctor`, `config`). Angular project creation, slice generation
and managed upgrades are unavailable; the five stable templates below are the
supported scaffolding frameworks.

- [Changelog](./docs/CHANGELOG.md)
- [Safe upgrade architecture](./docs/UPGRADE-ARCHITECTURE.md)
- [Public documentation outline](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [Security policy](./SECURITY.md)

## Quick start

```bash
npx create-fsd-architecture@latest my-app
```

Or install once and use the short `fsd` command (same CLI):

```bash
npm install -g create-fsd-architecture
fsd create my-app
fsd generate entity product   # or: fsd g entity product
fsd check
```

## 🤖 AI Agent Skill (Beta)

Teach Codex, Claude Code, Cursor, and other Agent Skills-compatible coding
agents how to translate natural-language scaffolding requests into verified FSD
CLI commands:

```bash
npx skills add FSD-CLI/create-fsd-architecture --skill fsd-cli
```

The skill is currently available as `v1.0.0-beta.1`. Its commands and
installation flow are verified, but agent behavior can vary across tools and
existing project structures. Review generated changes before committing them.

The skill inspects the project and uses the CLI for supported structural work
instead of manually recreating equivalent folders. For example:

- “Create a cart feature.”
- “Add a product entity.”
- “Create a checkout page.”
- “Create a new Next.js project with Feature-Sliced Design.”

The skill is deliberately execution-focused. Use the official
[Feature-Sliced Design documentation](https://feature-sliced.design/) for the
methodology; use the separate
[`create-fsd-architecture` Agent Skill repository](https://github.com/FSD-CLI/create-fsd-architecture)
for this tool's real commands, framework behavior, safety rules, and known
limitations.

The interactive flow selects the framework, API client, server state, client
state, forms stack, package manager, dependency installation, and optional dev
server startup.

For CI, demos, and repeatable local automation:

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## Commands

```bash
# Show all options
npx create-fsd-architecture@latest --help

# Show the installed CLI version
npx create-fsd-architecture@latest --version

# Discover stable and planned templates
npx create-fsd-architecture@latest --list-templates

# Generate inside an existing project
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# Ready-made layout widgets and shared primitives (2.7.0)
npx create-fsd-architecture@latest -g widget navbar sidebar footer bottom-bar
npx create-fsd-architecture@latest -g shared ui button input label card
npx create-fsd-architecture@latest -g shared api
npx create-fsd-architecture@latest -g page home about consult

# Preview creation or generation without writing files
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# Inspect an existing FSD project
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# Safely inspect or migrate CLI-owned tooling in an existing project
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

Create options:

| Option | Purpose |
| --- | --- |
| `-f, --framework <id>` | Skip the framework prompt |
| `--target <target>` | Select the project target: `web` (the only target available today; `multi-web`, `mobile` and `universal` are rejected until their support lands) |
| `--monorepo` | Shortcut for `--target multi-web` (not yet available) |
| `--mobile` | Shortcut for `--target mobile` (not yet available) |
| `-y, --yes` | Accept framework defaults without prompts; requires a project name and `--framework` |
| `--package-manager <id>` | Select npm, pnpm, Yarn, or Bun non-interactively |
| `--package-name <name>` | Set the npm package name independently of the folder name; the name must be publishable on npm |
| `--api-client <id>` | Select Axios or native Fetch |
| `--server-state <id>` | Override the framework server-state choice |
| `--client-state <id>` | Override the framework client-state choice |
| `--forms <id>` | Override the framework forms choice |
| `--no-install` | Do not install dependencies |
| `--no-start` | Do not start the development server |
| `--dry-run` | Print the complete plan without changing files |
| `--force` | Replace an existing target; restore it if cloning, setup, or installation fails |

## Safe upgrades

`upgrade` evolves only tooling that the CLI can prove it owns. It never
re-scaffolds a project and never rewrites feature, entity, widget, page,
component, style, route implementation, environment file, secret, custom script,
or unrelated dependency.

```bash
# Inspect the complete plan. This is always read-only.
npx create-fsd-architecture@latest upgrade --dry-run

# CI status check. It is always non-interactive and read-only.
npx create-fsd-architecture@latest upgrade --check

# Apply only a conflict-free plan without prompting.
npx create-fsd-architecture@latest upgrade --yes

# Apply source/configuration changes without dependency installation.
npx create-fsd-architecture@latest upgrade --yes --no-install

# Apply after explicitly accepting the risk of a dirty Git worktree.
npx create-fsd-architecture@latest upgrade --allow-dirty
```

The command locates the nearest reliable project root from nested directories,
then prints the selected root, migration path, every create/update/preserve/
conflict/manual action, and validations. `--dry-run` and `--check` do not create
backups, manifests, logs, lockfiles, or temporary project files.

New projects contain `.fsd/manifest.json`, an atomically written ownership
manifest. It records SHA-256 hashes only for CLI-owned files, marker regions, and
specific managed dependency entries. It contains no environment values, secrets,
or `node_modules` data. A changed tracked file or marker is a conflict, not an
overwrite permission. There is intentionally no `--force` or blind `--adopt`
mode for upgrades.

Projects created before the manifest use conservative legacy mode. The CLI adopts
only exact released signatures for generated artifacts, managed dependencies, and
Nuxt marker regions. Missing, custom, or ambiguous managed paths are reported as
`CONFLICT` or `MANUAL`; resolve them before retrying. Application code outside
CLI-owned surfaces remains untouched byte-for-byte.

By default an apply is refused in a dirty Git worktree. `--dry-run` and `--check`
remain available. `--allow-dirty` prints a warning and uses the internal
affected-path backup; the command never resets, stashes, commits, switches
branches, or otherwise changes Git state. Projects without Git are supported.

Before writes, upgrade snapshots every affected regular file under
`.fsd/backups/`. Writes use sibling temporary files and atomic rename, preserve
hook permissions, reject traversal and symlinked managed paths, and roll back in
reverse order on an error. The backup is retained after a failed upgrade and its
location is printed. If dependency installation failed, source/configuration,
manifest, and lockfile paths are restored; run the selected package manager's
`install` command to restore `node_modules`.

`upgrade --check` exit codes are stable for CI:

| Code | Meaning |
| --- | --- |
| `0` | Project is current |
| `2` | A conflict-free upgrade is available |
| `3` | Conflicts or manual work block an upgrade |
| `4` | Project state or configuration is unsupported or invalid |

The first managed-state release supports clean signature-matching projects from
the tested React + Vite, Next.js, Vue + Vite, Nuxt, and SvelteKit stacks using
npm, pnpm, Yarn, or Bun. It installs the ownership manifest, hardens verified
legacy Husky hooks, and adds the CLI-owned pnpm build policy only when the path
does not already exist. No dependency version migration is currently declared;
the installer runs only when a future migration changes managed dependencies.
See [the upgrade architecture](./docs/UPGRADE-ARCHITECTURE.md) for the exact
compatibility table, recovery guidance, and extension rules.

For pnpm, use **10.26 or newer** (pnpm 11 also requires Node 22+).
New pnpm projects receive a framework-specific `allowBuilds` list in
`pnpm-workspace.yaml`. Only the listed build dependencies may execute scripts;
unreviewed scripts fail installation instead of being silently trusted.
An existing template-owned workspace policy is preserved. Review additional
dependencies with `pnpm approve-builds`; no global approval settings are changed.
See the [pnpm build settings](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds).

If installation fails, the CLI exits nonzero and rolls back the target. To review
package-manager policy before installing, create with `--no-install`, then run
the selected manager manually inside the generated project.

Generator types:

- `feature`
- `entity`
- `widget`
- `page`

Existing slices are protected. Use `--force` only when you intentionally want
to replace a slice. Page generators also register framework-native routes:
React Router for React + Vite, Vue Router for Vue + Vite, and App Router route
files for Next.js. Nuxt and SvelteKit pages get thin file-based route wrappers
without turning FSD page slices into route directories.

## Templates

| Template ID | Framework | Status |
| --- | --- | --- |
| `react-vite` | React + Vite | Stable |
| `nextjs` | Next.js App Router | Stable |
| `vue-vite` | Vue + Vite | Stable |
| `nuxt` | Nuxt 4 | Stable |
| `sveltekit` | SvelteKit | Stable |

Vue and Nuxt projects use Pinia, TanStack Vue Query, VeeValidate, and Zod
through framework-native modules, providers, and generators. Nuxt defaults to
its native `$fetch` client and includes SSR hydration for Vue Query.

SvelteKit projects use Svelte 5 runes, TanStack Svelte Query, Svelte stores,
SvelteKit Superforms, and Zod 4. They default to native Fetch and use
`PUBLIC_API_BASE` for public runtime API configuration.

## Generated architecture

```text
src/
├── app/          # App-level setup, providers, routing, and styles
├── pages/        # Route-level compositions
├── widgets/      # Large reusable UI blocks
├── features/     # User interactions and business actions
├── entities/     # Business entities and their representations
└── shared/       # API, assets, config, utilities, types, and UI
```

Nuxt uses the same complete layers under its official `app/` source directory.
Its file-based route wrappers live in `app/app/routes`, separate from the FSD
`app/pages` layer.

SvelteKit keeps the layers under `src/` and reserves `src/routes` for thin
file-based route wrappers. Because SvelteKit owns the `$app` alias, generated
projects use `$fsd-app` for the FSD app layer and layer-specific aliases such as
`$pages` and `$shared` everywhere else.

Every layer and its core segments exist from day one. Documentation placeholders
keep empty architectural folders present across Git clones.

## Project configuration

The selected stack is saved once in `fsd.config.json`. Generators read this file
automatically and do not ask the developer to choose the stack again.

```json
{
  "$schema": "https://raw.githubusercontent.com/FSD-CLI/cli/main/schema/fsd.config.schema.json",
  "schemaVersion": 1,
  "packageManager": "npm",
  "apiClient": "axios",
  "serverState": "react-query",
  "clientState": "zustand",
  "forms": "react-hook-form-zod",
  "ui": "shared-ui",
  "framework": "react-vite"
}
```

Generating `feature auth` creates login, registration, forgot-password,
reset-password, and verification-code flows together. With the default stack it
also generates typed React Hook Form components, Zod schemas, React Query
mutations, and the selected client-state integration.

### Opt-in Supabase Auth adapter (candidate)

`-g feature auth --auth-provider supabase` generates an official browser SDK
adapter with session normalization, confirmation-required signup and recovery OTP
handling. It is candidate work and is not available in published npm 2.6.1.
Install the SDK and configure a browser client with public keys; SSR authorization
and RLS need separate application integration and backend acceptance.
See [the complete contract](docs/AUTH-SUPABASE-CONTRACT.md).

## Core architecture in 2.2

The CLI runtime is split into stable boundaries:

```text
bin/
├── cli/                  # Argument parsing and terminal output
├── commands/             # User-facing workflows
├── core/
│   ├── frameworks/       # Runtime-specific adapters
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # Reusable generator building blocks
```

- The Template Registry is the single source of truth for template identity,
  repository, and release status.
- The Capability Matrix prevents invalid cross-framework stack combinations.
- Framework Adapters own environment variables and client-component behavior.
- Project Lifecycle owns cloning, configuration, Git, Husky, Commitlint, and
  installation behavior.
- The CLI entrypoint only parses and routes commands.

This separation allows React, Next.js, Vue, Nuxt, and SvelteKit to share one CLI
lifecycle while keeping framework-native providers and generated components.

## Requirements

- Node.js 22.12.0 or later for the CLI
- Node.js 22.22.2 or later for generated Nuxt and SvelteKit projects

The CLI runtime floor, the per-template floors, and the supported package
manager versions are verified in
[docs/RUNTIME-REQUIREMENTS.md](./docs/RUNTIME-REQUIREMENTS.md). The `doctor`
command enforces them and reports the exact required version when the local
runtime does not match.

## Development

```bash
npm install
npm test
npm run check
```

## Releases

npm publishing is a manual maintainer-only step. Pushing a version tag runs the
release checks and creates a GitHub Release, but it never publishes to npm.

## License

MIT

## Support FSD CLI

If this project helps you, you can optionally support its development:

- [GitHub Sponsors](https://github.com/sponsors/ashrafmo-1?frequency=one-time&sponsor=ashrafmo-1)
- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay (Egypt):** `ashrafmo-1`

For InstaPay, use the username exactly as shown and verify the recipient details
in the app before confirming a transfer. Donations are optional.

## Existing projects and proposals

Existing applications can use the official [audit and guided-migration workflow](docs/EXISTING-PROJECT-SUPPORT.md).
CLI generators require a verified compatible project; managed upgrade remains
limited to CLI-owned files. See the [proposal decisions](docs/PROPOSALS.md) for
the unscheduled add/plugin proposals and migration research.

## Reproducible template sources

Each supported template is bound to a full commit in the CLI registry. Creation
fetches that exact object, verifies its SHA, and records repository/requested
ref/resolved commit in `.fsd/template.json`. Dry-runs show the pinned source.
No fallback to a moving branch is allowed. Updating a template requires a
reviewed registry change and a new CLI artifact; dependency version ranges still
need their own lockfile/runtime verification. Old generated projects and
ownership manifests remain valid without this optional provenance file.

### Template source verification

From the CLI repository, `npm run smoke:templates` downloads each registered immutable commit twice,
checks the recorded provenance and compares the complete source byte tree.
Before releasing a CLI update, merge its companion template PRs and verify the
pinned commits remain available; rebind pins after squash/rebase merges.
Security/build checks are separate from source identity verification.

## Git workflow policy

Git and Conventional Commits remain part of setup. Pre-commit checks staged and
working-tree whitespace; full builds run in CI. Set `FSD_PRE_COMMIT_LINT=1` to
run lint on commit or `FSD_PRE_PUSH_CHECKS=1` to run lint/build on push.
For an intentional emergency bypass, Husky supports `HUSKY=0 git commit ...`;
CI remains the required quality gate and failures must still be resolved.

Auto-PR and PR labeling are optional. The React template keeps reviewed examples
in `.github/optional-workflows/`; copy a chosen file into `.github/workflows/`
to enable it. Auto-PR is manual (`workflow_dispatch`) and needs repository
permission to create PRs. Labeler needs `.github/labeler.yml`, the labels
`documentation`, `source`, `ci`, and Actions permission to apply labels.
Do not enable automation before configuring its permissions and labels.

## Candidate generator improvements

Not in npm 2.6.1: native batch slices, preserving structure-only segments with
custom roots, and project-local `check --architecture` via Steiger.
See [generator workflows](docs/GENERATOR-WORKFLOWS.md) for exact syntax, rollback
and boundaries. `--root` requires `--segments`; it does not rewrite framework
route/alias configuration.
