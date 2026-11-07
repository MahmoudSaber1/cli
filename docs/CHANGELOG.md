# Changelog

All notable changes to `create-fsd-architecture` are documented here.

## Unreleased

### Added

- Create flags for the project target: `--target <web|multi-web|mobile|universal>`
  plus the `--monorepo` (multi-web) and `--mobile` shorthands. Invalid
  values and conflicting spellings fail with a usage error, an agreed
  shorthand resolves into the same `target` option the prompt step uses,
  and the flags are listed in `--help`. Targets that are not implemented
  yet (multi-web, mobile, universal) are rejected with a clear message
  until their support lands, `--help` and the README mark them as not
  yet available, and the README flag table lists all three flags.
- The framework step of the create flow is now filtered by the chosen
  project target: `listTemplatesForTarget` in the template registry keeps
  only templates whose adapter serves the target, an explicit framework
  that does not serve it is refused, and a target no adapter serves yet
  (Mobile) stops with a clear message instead of an empty prompt.
- The create flow now asks for a **project target** (Web, Multi-web,
  Mobile, Universal) between the project name and the framework. The
  selection is flow state in the new `bin/core/project-target.mjs` — it
  maps to adapter targets for the steps that follow and is shown in the
  dry-run plan — and non-interactive runs keep behaving exactly as
  before: `--yes` never asks and defaults to Web. Only Web is implemented
  today: the other targets appear in the prompt as disabled "Coming
  Soon" choices, and selecting one programmatically is rejected with a
  clear message instead of silently creating a web project.
- RFC: `docs/RFC-PLUGIN-API.md` proposes a public plugin API that lets a
  third-party package register an adapter (and, for a new family, a family
  generator) without a core PR — two tiers (data-only adapters, family
  plugins), explicit opt-in loading, a five-step registration flow built
  on the contract validator, and a trust/versioning model. It is the
  re-entry proposal for the parked plugin system in `docs/PROPOSALS.md`.
  Draft only; nothing is implemented.
- Generators now sit behind one shared family interface:
  `bin/generators/family-generators.mjs` registers a frozen
  `{ family, createFilePlan }` generator per family, and the generate flow
  resolves the adapter's family through it instead of branching. The React
  planner moved out of `bin/generator.mjs` into `bin/generators/react.mjs`,
  alongside the existing Vue and Svelte planners. Behaviour is unchanged.
- Adapters declare the project targets they can create — every current
  adapter declares `targets: ["web"]` — and the registry can list adapters
  per target (`listFrameworkAdaptersByTarget`). Registration now enforces
  adapter contract v2 in full, so a registered adapter missing any v2
  field fails at startup with every violation listed.
- The capability matrix is now derived from the framework adapters:
  `bin/core/capability-matrix.mjs` builds every row from the adapter's own
  `capabilities` and `generators`, so the data lives in exactly one place.
  The derived matrix is value-identical to the hand-written matrix it
  replaces. Behaviour is unchanged.
- Every framework adapter now declares its own `capabilities` and
  `generators`, moved verbatim from the capability matrix (Angular declares
  an empty generator list, as an inspection-only adapter). Behaviour is
  unchanged.
- Adapter contract v2: `bin/core/frameworks/adapter-contract.mjs` defines the
  `FrameworkAdapter` JSDoc types covering `id`, `family`, `targets`,
  `sourceDirectory`, `capabilities`, `generators`, `dependencies` and
  `dependencyVersions`, exports the allowed vocabularies (`PROJECT_TARGETS`,
  `CAPABILITY_IDS`, `GENERATOR_TYPES`) and a validator
  (`validateAdapter` / `assertAdapterContract`) that the test suite runs over
  every registered adapter. The prose contract is documented in
  `docs/ADAPTER-CONTRACT.md`. Behaviour is unchanged: the v2 fields are
  populated by the follow-up adapter migration.
- `bin/core/package-name.mjs`: `toPackageName()` converts a project name, a
  project path or a scoped package name into a publishable npm package name
  (lowercase, last path segment, spaces to dashes, no leading `.` or `_`, no
  Node.js core module name, scoped names stay scoped). It reports whether the
  input was already valid and why it changed. The rules are documented in
  `docs/PACKAGE-NAMING.md`.

### Fixed

- A created project no longer inherits the template's package identity. The
  generated `package.json` carries the project's own name and is private and
  versionless, and the npm and bun lockfile name fields follow it. The
  templates leaked `fsd-architecture-starter`, `fsd-nextjs`, `fsd-vue-starter`,
  `fsd-nuxt-starter`, `fsd-sveltekit` and the stale `mudular-structure-v2`
  bun lockfile name.
- The template's own name no longer survives in the README title, the document
  title (`index.html` and the Next.js metadata export) or the Angular project
  name. The slots are rewritten structurally, so the result does not depend on
  what the template calls itself.
- A project name that is a valid folder name but not a valid npm package name
  is now caught before the project is created: the prompt suggests the
  normalized name, explains why it changed and asks the user to confirm it.
- `--yes` never fails on a name that can be fixed: it uses the normalized
  package name and prints which name it used.
- `--package-name <name>` sets the npm package name independently of the folder
  name. The name must be publishable on npm; an invalid one is refused with the
  valid form suggested.
- A `package-name-e2e` CI job creates a project from every stable template and
  asserts that the project carries its own package name, its own titles and no
  template identity. The template identity is read from the pinned template
  commit, so the check does not depend on a hardcoded list of template names.

## 2.7.1 - 2026-10-29

Published npm gitHead: `287b61fc742d49e37b9c41f7c759aa1486b275d2`,
integrity `sha512-FNrVVa+ZrPKRSoeknRAXWh410/9GF8smyAj+LuM8c9F+x4EU8QY4/7WdLAOGHWDQ3B8Ries1IaQYrN4Rr6djWw==`.

A small update on 2.7: the `fsd` command, page presets, fixes for upgrading
projects created before 2.6.1, and templates pinned to their security-fixed
`main` commits. No runtime or dependency changes for the CLI itself.

### Added

- `scripts/staging/supabase-auth-e2e.mjs` and a 2026-10-29 staging report: the
  generated Supabase adapter passes 15/15 live checks (sessions, refresh, logout
  revocation, RLS, recovery, code reuse and expiry) on an isolated project.
- A global `fsd` binary next to `create-fsd-architecture`. `fsd create` scaffolds
  a project and `fsd generate` (alias `fsd g`) generates slices; the flag forms
  keep working. CI installs the packed tarball globally on Linux, macOS and
  Windows and runs both binaries.
- `-g page home|about|consult` generates page presets (hero, about, and a
  consultation form with an `onSubmit` callback) on React, Next.js, Vue, Nuxt
  and SvelteKit. Other page names keep the placeholder; all pages are routed.
- `upgrade-e2e` CI job: historical project -> check -> dry-run -> conflict
  refusal -> rollback -> upgrade -> install -> build for every declared
  signature, with a JSON report of dependency changes.

### Changed

- Pin all five templates to their `main` commits after the 2026-10-29 security
  merges: React `55530ec`, Next.js `b360aef`, Vue `82a1227`, Nuxt `533c5f9`,
  SvelteKit `9ff28cf`. New Nuxt projects no longer carry critical production
  advisories; templates ship CodeQL/Dependabot/dependency-security workflows.
- A first argument of `create`, `generate` or `g` is now a subcommand. To name a
  project `create`, use `fsd create create`.

### Fixed

- Projects created before 2.6.1 (legacy 2.3.2/2.4.0/2.5.0 signatures and 2.6.0
  manifests) no longer conflict on `fsd-stack.ts`: the old documentation domain
  rendering is recognized and updated.
- A managed dependency range raised above the CLI's value, for example by
  Dependabot, no longer blocks `upgrade`; it is kept and recorded.
- Generated-file updates on a current-state manifest now record their new
  hashes instead of failing post-upgrade validation.

## 2.7.0 - 2026-10-29

Published npm gitHead: `561d7d94b5a20179e2246d216d4fc80e9236d4ae`,
integrity `sha512-F9ka7Ov2ImLFie8ZaBFyZbB5erByOiTf5pnwwHN396Q/spT3UfL/DHOiSPYmipKn287Me012by364XlAuS49hg==`.

Breaking: the CLI now requires Node.js `>=22.12.0` (was `>=20`). See
`docs/RUNTIME-REQUIREMENTS.md`.

### Added

- `-g feature auth --auth-provider supabase` generates an opt-in Supabase
  browser auth adapter with session, error and recovery handling. The default
  auth contract is unchanged. See `docs/AUTH-SUPABASE-CONTRACT.md`.
- Batch generation (`-g entity product customer`) with preflight and rollback
  of the whole batch.
- Structure-only generation with `--segments` and `--root` that creates
  missing directories and public APIs without overwriting existing files.
- `check --architecture` and `doctor --architecture` run the project's
  installed Steiger against its framework source root.
- `upgrade` adds a light Git hooks migration (`light-hooks-v1`) that keeps
  customized hooks as conflicts.
- `-g widget navbar|sidebar|footer|bottom-bar` generates accessible layout
  widget presets on React, Next.js, Vue, Nuxt and SvelteKit.
- `-g shared ui [button input label card]` and `-g shared api` generate shared
  ui primitives and an `apiClient` for the configured client, preserving
  existing files and merging segment `index.ts` exports.

### Changed

- Settle the supported runtime and publish it as a verified contract. The CLI
  requires Node.js `>=22.12.0`, which is the lowest Node that runs the CLI and
  every shipped Vite based template: `chalk@6.0.1` requires `>=22`, and
  `vite@8.3.0` and `@sveltejs/vite-plugin-svelte@6.2.1` require `>=22.12.0`.
- Declare the generated project runtimes per template and enforce them. Nuxt
  requires `^22.22.2 || ^24.11.0 || >=26.0.0` and SvelteKit requires
  `^22.22.2 || >=24.0.0`, because `nuxt@4.5.2` rejects Node 23 and the
  24.0.0 - 24.10.0 band. React, Vue and Next.js follow the CLI floor.
- Declare the supported package manager versions: npm `>=10.9.0`,
  pnpm `>=10.26.0`, yarn `>=4.18.0`, and bun `>=1.2.0`.
- Record the verified requirements in `docs/RUNTIME-REQUIREMENTS.md`.

### Fixed

- `.fsd/manifest.json` wraps `appliedMigrations` once the line passes 80
  columns, so Biome accepts the manifest in generated Next.js projects.
- `package.json` declared `engines.node: ">=20"` while the lockfile resolved
  `chalk@6.0.1`, which requires Node `>=22`. The published engines field now
  matches the resolved dependency tree.
- The `doctor` command only compared the Node major version against `20`. It
  now evaluates the same ranges npm publishes and names the exact required
  version on failure.
- The `doctor` package manager check only verified that the binary existed. It
  now compares the installed version against the supported minimum.
- Project creation now refuses an unsupported runtime before downloading or
  writing anything, instead of producing a project that cannot be built.

## 2.6.3 - 2026-10-11

Published npm gitHead: `9d37a154fd9476ff416941463c6f60c77bab55de`.

### Changed

- Refresh template pins to verified commits on each template's main branch.
- Accept Angular's native configuration for read-only inspection; reject
  Angular generation, reconfiguration and managed upgrades before any writes.
- Keep Chalk on the Node-20-compatible 5.x series to honor the CLI runtime contract.

## 2.6.2 - 2026-10-11

Published npm gitHead: `5f5654cf040a1fa0e6731e594f1b9701da0d18be`.
The Angular inspection contract, refreshed main pins and Chalk 5 change above
were merged after this published artifact and are prepared for 2.6.3.

### Changed

- Expand the README badge panel with live npm version/downloads, Node support,
  GitHub contributors/forks/stars/issues, license and workflow status.
- Include the Windows toolchain, path and rollback fixes merged after 2.6.1.

- Bind all five template sources to full immutable Git commits, verify downloaded
  identities and retain provenance in `.fsd/template.json`.
- Add published-package and repeated-template-source smoke scripts/workflows.
- Record dated QA/security evidence, starter validation limits, the official
  guided existing-project support policy and proposal classifications.
- Add dependency audit/maintenance coverage; unresolved upstream findings remain
  explicit and are not waived.

## 2.6.1 - 2026-09-27

### Changed

- Use https://fsdcli.me as the official package homepage and documentation URL
  in the README and newly configured projects.
- Published npm gitHead: `4c83d0a75ec20117edc8880aba065bdb21edfa6d`.
  Windows fixes from PR #4 merged after this release and await a newer artifact.

## 2.6.0 - 2026-09-26

### Added

- Safe `upgrade` command with read-only planning, ownership manifests, conflict
  detection, transactional rollback, and CI-friendly status codes.
- Upgrade documentation, compatibility guidance, and a responsible disclosure
  policy.

### Fixed

- Revalidate every planned write immediately before applying it, preventing a
  stale interactive plan from overwriting files changed after review.
- Serialize ownership manifests in a format accepted by the Next.js template's
  Biome configuration.
- Refresh Redux store ownership after CLI-generated reducer registration.
- Allow an FSD project to live below a package-only workspace root while still
  rejecting conflicting nested FSD roots.
- Report missing required FSD layers as invalid during `upgrade --check`.
- Preserve dependency versions that the ownership manifest deliberately leaves
  unmanaged, including newer template-provided Commitlint releases.

## 2.5.1 - 2026-09-23

### Fixed

- Failed dependency installation now exits nonzero, preserves its diagnostic,
  and rolls back new or forced project creation.
- Generated Git hooks stop on lint, staged/unstaged whitespace, or build errors.
- Numeric-leading slice names are rejected before files are written.
- Generic React-family view formatting now matches the Next.js template's
  formatter for the audited feature and widget output.
- Interactive defaults match each framework's unattended defaults.
- `--yes` requires an explicit project name and framework rather than prompting
  or silently exiting without creating a project.
- New pnpm projects have framework-scoped build-script approvals for pnpm
  10.26+ and 11; existing workspace policies remain untouched.

### Tests

- Added rollback and behavioral Git-hook regression tests, numeric-name checks
  across all frameworks, and interactive-default parity checks.
- CI framework smoke tests now generate every slice type plus auth; added
  React/Nuxt build-policy coverage on pnpm 10.26 and 11.

## 2.5.0 - 2026-09-19

### Added

- Stable Svelte 5 and SvelteKit 2 template support through
  `--framework sveltekit`.
- SvelteKit framework adapter with Fetch and Axios clients backed by
  `PUBLIC_API_BASE`.
- Request-scoped TanStack Svelte Query v6 provider generation.
- Svelte store, SvelteKit Superforms, and Zod 4 capability contracts.
- Svelte-native feature, entity, widget, page, and complete auth generators.
- SvelteKit file-based page route wrappers in `src/routes`.
- SvelteKit coverage in the configuration schema, smart stack matrix, project
  inspection, and framework build CI.

### Changed

- SvelteKit is promoted from planned to stable in the Template Registry.
- The default SvelteKit API client is native Fetch while Axios remains optional.
- Framework build CI now validates all five stable templates.

### Compatibility

- React + Vite, Next.js, Vue + Vite, and Nuxt behavior remains unchanged.
- Configuration schema version remains `1`; SvelteKit support is additive.
- Generated SvelteKit projects require Node.js 22.22.2 or later.

## 2.4.0 - 2026-09-19

### Added

- Stable Nuxt 4 template support through `--framework nuxt`.
- Nuxt framework adapter with an `app/`-rooted Feature-Sliced Design structure.
- Nuxt-native `$fetch` and Axios API clients backed by public runtime config.
- Pinia and VeeValidate module configuration with deterministic marker updates.
- TanStack Vue Query SSR hydration through a generated Nuxt plugin.
- Nuxt-native page generation through file-based route wrappers in
  `app/app/routes`.
- Nuxt coverage in the capability matrix, configuration schema, smart stack
  matrix, project inspection, and framework build CI.

### Changed

- Framework-owned source directories now control generated shared config and API
  paths instead of assuming every framework uses `src/`.
- Nuxt defaults to native Fetch while retaining Axios as an opt-in choice.

### Compatibility

- React + Vite, Next.js, and Vue + Vite behavior remains unchanged.
- Configuration schema version remains `1`; Nuxt support is additive.
- Generated Nuxt projects require Node.js 22.22.2 or later.

## 2.3.2 - 2026-09-17

### Fixed

- Generated `fsd-stack.ts` files now match Biome formatting, so freshly created
  Next.js projects pass their complete `npm run ci` pipeline.
- Yarn 4 projects now establish their own lockfile boundary and use the
  `node-modules` linker instead of Plug'n'Play, keeping nested project creation,
  Vite, and the generated developer tooling compatible in CI.
- The initial Yarn install can populate a new lockfile even when the CLI itself
  runs inside an immutable CI environment.

### Changed

- npm publishing is maintainer-only and manual. GitHub tags validate the release
  and create the GitHub Release without publishing to npm.
- CI pins Yarn 4 instead of installing the legacy Yarn Classic package.

## 2.3.1 - 2026-09-16

### Added

- `--dry-run` file and project plans that make no filesystem changes.
- Transactional `--force` replacement with rollback for projects and generated slices.
- `check`, `doctor`, and `config` project-inspection commands.
- Framework-native page route registration for React Router, Vue Router, and Next.js.
- Package-manager contract tests for npm, pnpm, Yarn, and Bun.
- Route generation, conflict protection, rollback, and structure validation tests.
- Tag-gated Trusted Publishing and automatic GitHub Release creation.

### Changed

- React + Vite projects now include React Router.
- Vue + Vite projects now include Vue Router.
- Project setup rolls back incomplete downloads, configuration, and Commitlint failures.

### Compatibility

- Node.js 20 remains the minimum supported runtime.
- Existing creation and generation syntax remains supported.
- Configuration schema version remains `1`.

## 2.3.0 - 2026-09-16

### Added

- Stable Vue 3 + Vite template support through `--framework vue-vite`.
- Vue framework adapter with Vite environment handling and dependency contracts.
- Pinia and TanStack Vue Query project configuration.
- VeeValidate 4 and Zod 3 form configuration.
- Vue-native feature, entity, widget, and page generators.
- Complete generated Vue authentication flow with five forms, API functions,
  Vue Query mutations, Zod schemas, and a Pinia auth store.
- Vue configuration and generator regression tests.

### Changed

- Framework adapters now own dependency selection and versions.
- Managed dependencies are removed and reinstalled per framework without leaking
  React packages into Vue projects.
- The project provider generator now emits Vue application plugins for Vue
  projects and React provider components for React projects.
- `fsd.config.json` schema now accepts the Vue stack values.

### Compatibility

- React + Vite and Next.js behavior remains unchanged.
- Configuration schema version remains `1`; Vue support is additive.

## 2.2.0 - 2026-09-15

### Added

- Central Template Registry for stable and planned framework templates.
- Framework Capability Matrix for API, server state, client state, forms,
  package manager, framework-owned defaults, and generator compatibility.
- React + Vite and Next.js framework adapters.
- Dedicated project lifecycle for cloning, configuration, Git, Husky,
  Commitlint, and dependency installation.
- `--help`, `--version`, and `--list-templates` commands.
- `--framework`, `--yes`, `--no-install`, and `--no-start` creation options.
- Planned registry entries for Vue + Vite, Nuxt, and SvelteKit.
- CLI, registry, capability, adapter, path-safety, and lifecycle tests.

### Changed

- Reduced the CLI entrypoint to command parsing and routing.
- Moved reusable generator primitives and basic slice generators into dedicated
  modules.
- Made generated API clients and client directives adapter-driven.
- Made the generator validate framework capabilities before writing files.
- Added path containment checks for generated project directories.
- Added cleanup for incomplete template clones.

### Compatibility

- Existing interactive project creation remains supported.
- Existing `--generate` and `-g` syntax remains supported.
- `fsd.config.json` stays on schema version 1.
- React + Vite and Next.js template repository contracts remain unchanged.
