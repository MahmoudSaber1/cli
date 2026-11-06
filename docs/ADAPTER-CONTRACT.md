# Adapter Contract

**Version 2** · Machine-readable definition: `bin/core/frameworks/adapter-contract.mjs`
(the JSDoc types are the definition; this document is the prose that goes with them)

A framework adapter is the single object that teaches the CLI everything
framework-specific. The registry (`bin/core/frameworks/index.mjs`) holds one
adapter per framework, and every framework-specific decision — where the FSD
source tree lives, which stack options exist, which generators can run, which
npm packages get installed and at which versions — is read from the adapter.
Nothing else in the CLI hard-codes framework knowledge.

## The contract

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | always | Stable framework id (`react-vite`, `nextjs`, `vue-vite`, `nuxt`, `sveltekit`, `angular`). Matches the template registry value and the capability matrix key. Never rename an id; it is stored in generated projects' `project-config`. |
| `family` | `string` | always | Framework family (`react`, `vue`, `svelte`, `angular`). Generators are implemented per family, so adapters in one family share generator code: `react-vite` and `nextjs` are both family `react`. |
| `targets` | `("web" \| "mobile")[]` | v2 | Project targets the adapter can create. No duplicates. The init flow asks for a target first, then offers only adapters that support it. |
| `sourceDirectory` | `string` | always | Directory holding the FSD source tree in a generated project: `src` for most frameworks, `app` for Nuxt. |
| `capabilities` | `AdapterCapabilities` | v2 | The capability options this adapter offers, plus a default per capability. See below. |
| `generators` | `GeneratorType[]` | v2 | Generator types the adapter supports: `feature`, `entity`, `widget`, `page`, `shared`. An inspection-only adapter supports none (`[]`). |
| `dependencies` | `AdapterDependencies` | always | npm packages per capability option. May be empty only for inspection-only adapters. |
| `dependencyVersions` | `Record<string, string>` | unless inspection-only | Exact version range for **every** package named by `baseDependencies` and `dependencies`. |
| `baseDependencies` | `string[]` | optional | Packages every generated project needs regardless of the chosen stack (for example the router). |
| `runtime` | `string` | optional | Runtime flavour when it differs from the family default (`nuxt`, `sveltekit`, `angular`). |
| `clientDirective` | `string` | optional | Directive prepended to generated client modules (Next.js `"use client"`); `""` when the framework has none. |
| `publicApiBaseUrlExpression` | `string` | optional | Expression generated code uses to read the public API base URL. |
| `inspectionOnly` | `boolean` | optional | The adapter exists so existing projects can be inspected, but the CLI cannot generate or upgrade projects for it yet (Angular today). Relaxes the `dependencies` / `dependencyVersions` requirements. |

Adapters are frozen objects (`Object.freeze`): the registry hands the same
instance to every caller, so an adapter must never be mutated at runtime.

## Capabilities

A capability is a stack decision the user makes at create time. The core
capabilities are `apiClient`, `serverState`, `clientState` and `forms`.
`packageManager` is deliberately **not** a capability: the supported package
managers are global, not per adapter.

The adapter's two capability fields must agree with each other:

- `capabilities` declares, per capability, the list of offered options and a
  `defaults` entry naming the pre-selected option. Every default must be one
  of the declared options.
- `dependencies` maps each option to the npm packages it needs. An empty
  array means the option needs no packages — the native `fetch` API client,
  or the `none` option every capability offers.

Example (abridged from the React + Vite adapter):

```js
capabilities: {
  defaults: { apiClient: "axios", serverState: "react-query", clientState: "zustand", forms: "react-hook-form-zod" },
  apiClient: ["axios", "fetch"],
  serverState: ["react-query", "none"],
  clientState: ["zustand", "redux", "none"],
  forms: ["react-hook-form-zod", "none"],
},
dependencies: {
  apiClient: { axios: ["axios"], fetch: [] },
  serverState: { "react-query": ["@tanstack/react-query"], none: [] },
  // ...
},
dependencyVersions: { axios: "^1.20.0", "@tanstack/react-query": "^5.102.8" /* ... */ },
```

## Generators

`generators` lists the `fsd generate` structure types the adapter supports.
The implementations live per family under `bin/generators/`; the adapter
only declares support. Asking an adapter for an unsupported generator is an
error, and an inspection-only adapter declares `generators: []`.

## Dependency versions

Versions are pinned per adapter, in `dependencyVersions`, not in the
generated templates. Every package named anywhere in `baseDependencies` or
`dependencies` — including packages pulled in by only one option — must have
an entry, so the CLI can never install a package whose version it does not
control. Entries for packages no option uses are tolerated but pointless;
keep the map exact.

## Validation

`bin/core/frameworks/adapter-contract.mjs` exports:

- `validateAdapter(adapter, { requireV2 })` — returns the list of contract
  violations (empty when the adapter conforms). With `requireV2: false`
  (the default) the v2 fields are checked when present but not required;
  with `requireV2: true` they are mandatory.
- `assertAdapterContract(adapter, options)` — the throwing form; returns
  the adapter when it conforms.
- `ADAPTER_CONTRACT_VERSION`, `PROJECT_TARGETS`, `CAPABILITY_IDS` and
  `GENERATOR_TYPES` — the version and the allowed vocabularies.

`tests/adapter-contract.test.mjs` runs the validator over every registered
adapter, so a contract violation fails CI like any other regression.

## From v1 to v2

Contract v1 adapters declared everything except `targets`, `capabilities`
and `generators`: capabilities and generators lived in the central
`bin/core/capability-matrix.mjs`, and no adapter declared targets. The
migration lands in steps, each keeping behaviour unchanged:

1. This contract (v2 definition, validator, docs).
2. `capabilities` and `generators` move from the capability matrix into
   each adapter, verbatim.
3. The capability matrix is derived from the adapters
   (`buildCapabilityRow` in `bin/core/capability-matrix.mjs`), ending the
   duplication: the adapter declarations are the single source of truth,
   and the package-manager lists stay global — shared by every adapter
   except inspection-only ones, which carry only the default.
4. Each adapter declares `targets`, and the registry learns to list
   adapters per target — which is what the Project Target init flow
   (target prompt, framework filtering, `--target` flag) builds on.

Once step 4 lands, the registry switches to `requireV2: true` and the v1
shape stops being accepted.

## Adding an adapter

1. Create `bin/core/frameworks/<id>.mjs` exporting a frozen adapter object
   annotated `@type {import("./adapter-contract.mjs").FrameworkAdapter}`.
2. Register it in `bin/core/frameworks/index.mjs` and add the framework to
   the template registry (`bin/core/template-registry.mjs`).
3. Declare the full v2 shape, including `targets`, `capabilities` and
   `generators`; `tests/adapter-contract.test.mjs` will validate it in
   strict mode once the registry enforces v2.
4. Implement the family's generators under `bin/generators/`, or reuse the
   family implementation when the new adapter joins an existing family.
