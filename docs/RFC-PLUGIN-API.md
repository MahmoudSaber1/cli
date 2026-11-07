# RFC: A public plugin API for community adapters

**Status:** Draft — for maintainer review
**Scope:** Adapter registration only (not a general plugin system)
**Related:** `docs/PROPOSALS.md` (plugin system, Parking Lot), `docs/ADAPTER-CONTRACT.md`

## Summary

Today a framework can only reach the CLI through a core pull request: the
adapter list in `bin/core/frameworks/index.mjs`, the template list in
`bin/core/template-registry.mjs` and the family generators in
`bin/generators/family-generators.mjs` are all hard-coded, so every new
framework waits on maintainer review and a CLI release.

Adapter contract v2 and the family generator interface changed what an
adapter *is*: a validated data object (the contract), a template pointer
with immutable provenance, and — only for a new family — one
`createFilePlan` function. This RFC proposes a public plugin API that lets
a third-party npm package register those three pieces at runtime, without
a core PR, under an explicit trust and versioning model.

This document is the re-entry proposal for the parked plugin system in
`docs/PROPOSALS.md`. That decision parked the idea until it had "an
approved use case, trust/versioning model, API boundaries and maintenance
owner"; this RFC supplies the last three and asks the maintainers to
approve the use case below. **Nothing here is implemented.** Until the RFC
is accepted, the core-PR path remains the only way to add an adapter.

**What merging this document means:** merging records the proposal in the
repository so it can be referenced and revised. It is *not* approval of
the plugin API. Approval is a separate maintainer decision, recorded by
moving the plugin-system row in `docs/PROPOSALS.md` out of the Parking
Lot; until that decision is made, this RFC remains a draft.

## Use case

- **Community frameworks.** Framework support requests already arrive as
  roadmap work (Ember, TanStack Start). Their maintainers could ship and
  iterate on an adapter themselves instead of queueing behind core
  releases and core review capacity.
- **Private adapters.** An organisation with an internal framework or an
  internal template fork cannot upstream it. Today its only options are
  forking the whole CLI or going without; a plugin keeps it on the
  supported CLI.
- **Faster iteration.** Adapter authors can fix their own templates and
  dependency versions on their own release cadence, within the contract.

## Non-goals

- A general plugin system: no custom commands, prompt steps, or upgrade
  rules. Adapters (plus, when needed, one family generator) only.
- A marketplace, registry, or ranking of plugins.
- Sandboxing. Plugins are code; see the trust model.
- Auto-discovery in v1 (see the trust model).
- Changing how core adapters are registered or validated.

## Why this is feasible now

The API boundary already exists; it is simply not public yet:

| Piece a plugin must provide | Existing boundary |
| --- | --- |
| The adapter itself | `FrameworkAdapter` contract v2 (`bin/core/frameworks/adapter-contract.mjs`), enforced at registration with `assertAdapterContract(adapter, { requireV2: true })` |
| The template pointer | `bin/core/template-registry.mjs`: a stable template needs a title, a GitHub `owner/repo`, and a full 40-character commit ref |
| Generation for a new family | The family generator interface (`bin/generators/family-generators.mjs`): a frozen `{ family, createFilePlan }` object |
| Generation for an existing family | Nothing — the core family generator serves every adapter in its family |

Because an adapter is data, a large class of plugins needs **no executable
logic at all**: a new framework in an existing family is an adapter object
plus a template pointer.

## Proposal

### 1. Two tiers of plugin

- **Tier 1 — data-only adapters.** The plugin exports an adapter object
  and a template pointer for a framework whose family already has a core
  generator (`react`, `vue`, `svelte`). No functions cross the boundary.
- **Tier 2 — family plugins.** The plugin additionally exports a family
  generator for a new family, implementing the shared interface. This is
  the only tier that runs plugin code inside the generate flow.

### 2. Plugin package shape

A plugin is an npm package whose default export is a frozen descriptor:

```js
export default {
  apiVersion: 1,
  adapter: {
    id: "tanstack-start",
    family: "react",
    targets: ["web"],
    sourceDirectory: "src",
    capabilities: { /* per adapter contract v2 */ },
    generators: ["feature", "entity", "widget", "page", "shared"],
    dependencies: { /* per adapter contract v2 */ },
    dependencyVersions: { /* per adapter contract v2 */ },
  },
  template: {
    title: "TanStack Start",
    description: "TanStack Start with a complete FSD architecture",
    repo: "some-owner/fsd-tanstack-start",
    ref: "0123456789abcdef0123456789abcdef01234567", // full commit
    status: "stable",
  },
  // Tier 2 only:
  familyGenerator: { family: "ember", createFilePlan: (type, name, config) => [] },
};
```

`template` may be omitted for an inspection-only plugin adapter
(`inspectionOnly: true`, no generators), mirroring how the core Angular
adapter exists without a template today.

### 3. Enabling a plugin (explicit, never discovered)

A plugin takes effect only when the user names it, in one of two ways:

- `fsd create my-app --plugin tanstack-start-adapter` (package name), or
- a `plugins` array of package names in the user-level CLI config.

The CLI resolves the package from the user's own npm context (a global
install alongside the CLI, or the current directory's `node_modules`) and
prints every plugin it loaded. There is no scanning of arbitrary
`node_modules` trees and no loading from a scaffolded project's files: at
`create` time the target project does not exist yet, so anything else
would be both unreliable and a trust hole.

### 4. Registration flow

On load, for each plugin, in order:

1. **API version check.** `apiVersion` must be one the CLI supports;
   otherwise the run stops, naming the plugin, its `apiVersion`, and the
   supported set.
2. **Contract validation.** The adapter is checked with
   `assertAdapterContract(adapter, { requireV2: true })`. Any violation
   stops the run with the full violation list; a plugin can never
   register a partial adapter.
3. **Id conflicts.** The adapter `id` must not collide with a core adapter
   or an earlier plugin. Plugins cannot shadow or replace core adapters.
4. **Template validation.** A provided template must satisfy the same
   provenance rules as core templates: GitHub `owner/repo` plus a full
   immutable commit ref. A plugin cannot point a template at a moving
   branch.
5. **Family check.** If the adapter's family has no generator (core or
   plugin), the plugin must provide `familyGenerator` for exactly that
   family, or register as inspection-only. A plugin cannot replace an
   existing family's generator.

Only after all five steps is the adapter visible to `create`, `generate`
and `inspect`, indistinguishable from a core adapter. Registration is
per-process and in-memory; nothing is written into the CLI installation.

### 5. Public API surface (the boundary)

Accepting this RFC makes the following **public and stable**, importable
through package subpaths (the package currently has no `exports` map, so
adding one is part of the work):

- `create-fsd-architecture/adapter-contract` — the `FrameworkAdapter`,
  `AdapterCapabilities` and `FamilyGenerator` types, the vocabularies
  (`PROJECT_TARGETS`, `CAPABILITY_IDS`, `GENERATOR_TYPES`) and
  `validateAdapter` / `assertAdapterContract`, so authors can self-check
  before publishing.
- The plugin descriptor shape above, and the file-entry shape a
  `createFilePlan` returns (`{ path, content, public }`, as produced by
  the `file()` helper in `bin/generators/shared.mjs`).

Everything else stays internal: the registries' storage, capability
matrix derivation, prompt flows, and upgrade machinery may change in any
release without notice.

### 6. Versioning model

- The descriptor carries an integer `apiVersion`, independent of the
  adapter contract version. The CLI ships a set of supported API
  versions; adding a supported version is a minor CLI release, removing
  one is a major.
- Adapter contract changes follow the contract's own versioning: a
  breaking change to `FrameworkAdapter` raises `apiVersion`, so old
  plugins fail step 1 with a clear message instead of failing obscurely.
- Plugins should also declare a `peerDependencies` range on
  `create-fsd-architecture`; the runtime `apiVersion` check remains the
  authoritative one, because a global CLI install has no installer to
  enforce peer ranges.

### 7. Trust model

- A plugin is arbitrary code run with the user's privileges — exactly
  like any npm dependency. The CLI does not sandbox it and does not
  pretend to. This is why loading is **explicit opt-in only** (section
  3): installing a package can never silently activate it.
- The CLI prints loaded plugins on every run that uses them, so plugin
  use is visible in logs and CI output.
- Template provenance still applies: a template is pinned to a full
  commit, so reviewing a plugin pins down exactly which template code
  will be copied — a plugin update cannot silently change the template
  under an existing user.
- Tier 1 (data-only) plugins run no code in the generate flow beyond
  module load, and are the recommended tier; documentation should steer
  authors there whenever their family already exists.

### 8. Maintenance owner

- **Mahmoud Saber** — author of the adapter contract and of this RFC —
  is the maintenance owner for the public API surface, the validator and
  the registration flow: the boundary, not the plugins. Changes to that
  boundary require the project owner's approval (Ashraf Mohamed).
- Plugin authors own their adapters, templates and generators, including
  keeping `dependencyVersions` current. A plugin that validates but
  generates a broken project is the author's bug, not a core bug.
- Core CI never tests third-party plugins. The contract test suite is
  the shared safety net: authors run the same `assertAdapterContract`
  the CLI runs at load.

## Alternatives considered

- **Status quo (core PRs only).** Rejected as the only path: it makes
  core review the bottleneck for every framework and makes private
  adapters impossible, though it remains the right path for frameworks
  the project wants to own.
- **Auto-discovery from `node_modules`.** Rejected for v1 on trust
  grounds (section 7): merely installing a dependency would execute it
  inside the CLI. Can be revisited once an allowlist mechanism exists.
- **Fork-the-CLI distribution.** Works today and needs no API, but every
  fork drifts from core fixes (package naming, runtime minimums, upgrade
  safety) — the plugin API exists precisely to avoid that trade.

## Rollout

1. **Phase 1:** Tier 1 only — descriptor loading, the five registration
   steps, the `adapter-contract` subpath export, an author guide.
2. **Phase 2:** Tier 2 family generators, plus the generator helper
   subpath if authors need more than the file-entry shape.
3. **Phase 3 (only with maintainer appetite):** a JSON-schema form of
   the adapter contract for data-only plugins that ship no JavaScript at
   all, and an official listing page for community adapters.

## Open questions for the maintainer

1. Adapter id namespacing: should community ids carry a prefix or scope
   (e.g. `community/<id>`) to prevent squatting on names core may want
   later, or is first-come with no-shadowing enough?
2. Must plugin templates live in public GitHub repositories, as core
   provenance requires today, or should private repositories work when
   the user's git credentials can read them?
3. Where does the user-level CLI config live, and does one exist by the
   time this lands (interaction with the Project Target work's stored
   config)?
4. Should `fsd` warn when plugins are active during non-interactive
   (`--yes`) runs, given CI is where silent plugin use would matter most?
5. Does accepting this RFC move the `docs/PROPOSALS.md` plugin-system row
   out of the Parking Lot, with this document as its approved story?

## What acceptance means

Accepting this RFC approves the API boundary, trust model and phasing
above — not an implementation. Implementation would be planned as
follow-up tasks against this document, starting with Phase 1.
