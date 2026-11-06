/**
 * Adapter contract v2.
 *
 * A framework adapter is the single object that teaches the CLI everything
 * framework-specific: where the FSD source tree lives, which capability
 * options the framework offers, which generators it supports, which npm
 * packages a chosen stack needs and the exact versions to install.
 *
 * This module is the contract's machine-readable home: the JSDoc types are
 * the definition, the exported vocabularies are the allowed values, and
 * `validateAdapter` / `assertAdapterContract` check a candidate adapter
 * against them. The prose contract lives in `docs/ADAPTER-CONTRACT.md`.
 *
 * Contract v2 adds three fields that v1 adapters did not declare:
 * `targets`, `capabilities` and `generators`. All three are now populated
 * on every registered adapter — capabilities and generators moved in from
 * the capability matrix (which is derived from the adapters), and each
 * adapter declares its targets — and the registry enforces the full v2
 * shape at registration time via `assertAdapterContract` with
 * `{ requireV2: true }`. The lenient default mode remains for checking
 * candidate adapters that are not registered yet.
 */

/** The current adapter contract version. */
export const ADAPTER_CONTRACT_VERSION = 2;

/**
 * A kind of project the CLI can create. Adapters declare the targets they
 * support; the init flow asks for a target before it offers frameworks.
 *
 * @typedef {"web" | "mobile"} ProjectTarget
 */

/** @type {readonly ProjectTarget[]} */
export const PROJECT_TARGETS = Object.freeze(["web", "mobile"]);

/**
 * The framework family an adapter belongs to. Generators are implemented
 * per family, so several adapters can share one family ("react-vite" and
 * "nextjs" are both family "react"). Community adapters may introduce new
 * families; the value is a free-form non-empty string.
 *
 * @typedef {string} AdapterFamily
 */

/**
 * A stack decision the user makes when creating a project. Every adapter
 * offers its own options per capability (see {@link AdapterCapabilities})
 * and maps each option to npm packages (see {@link AdapterDependencies}).
 * `packageManager` is deliberately not a capability: the supported package
 * managers are global, not per adapter.
 *
 * @typedef {"apiClient" | "serverState" | "clientState" | "forms"} CapabilityId
 */

/** @type {readonly CapabilityId[]} */
export const CAPABILITY_IDS = Object.freeze([
  "apiClient",
  "serverState",
  "clientState",
  "forms",
]);

/**
 * The capability options one adapter offers, with the default option for
 * each capability. Every default must be one of the declared options for
 * that capability. `bin/core/capability-matrix.mjs` derives its rows from
 * these declarations, so the adapter is the single source of truth.
 *
 * @typedef {object} AdapterCapabilities
 * @property {Record<CapabilityId, string>} defaults - Default option per capability.
 * @property {string[]} apiClient - Offered API client options.
 * @property {string[]} serverState - Offered server-state options.
 * @property {string[]} clientState - Offered client-state options.
 * @property {string[]} forms - Offered forms options.
 */

/**
 * A structure generator the CLI can run for a project (`fsd generate`).
 * The core generator types are shared across families; an adapter lists
 * the ones it supports (an inspection-only adapter supports none).
 *
 * @typedef {"feature" | "entity" | "widget" | "page" | "shared"} GeneratorType
 */

/** @type {readonly GeneratorType[]} */
export const GENERATOR_TYPES = Object.freeze([
  "feature",
  "entity",
  "widget",
  "page",
  "shared",
]);

/**
 * The npm packages each capability option needs, per capability. An empty
 * array means the option needs no packages (for example the native `fetch`
 * API client, or the `none` option every capability offers).
 *
 * @typedef {Partial<Record<CapabilityId, Record<string, string[]>>>} AdapterDependencies
 */

/**
 * A framework adapter, contract v2.
 *
 * @typedef {object} FrameworkAdapter
 * @property {string} id - Stable framework id ("react-vite", "nextjs", ...).
 *   Matches the template registry value and the capability matrix key.
 * @property {AdapterFamily} family - Framework family ("react", "vue",
 *   "svelte", "angular", ...). Generators are selected per family.
 * @property {ProjectTarget[]} targets - Project targets the adapter can
 *   create. The registry can list adapters per target; the init flow asks
 *   for a target before it offers frameworks.
 * @property {string} sourceDirectory - Directory that holds the FSD source
 *   tree inside a generated project ("src" for most frameworks, "app" for
 *   Nuxt).
 * @property {AdapterCapabilities} capabilities - Capability options and
 *   defaults offered by this adapter; the capability matrix is derived
 *   from these declarations.
 * @property {GeneratorType[]} generators - Generator types this adapter
 *   supports; empty for inspection-only adapters.
 * @property {AdapterDependencies} dependencies - npm packages per
 *   capability option. May be empty only for inspection-only adapters.
 * @property {Record<string, string>} [dependencyVersions] - Exact version
 *   range for every package named by `baseDependencies` and
 *   `dependencies`. Required unless the adapter is inspection-only.
 * @property {string[]} [baseDependencies] - npm packages every generated
 *   project needs regardless of the chosen stack (for example the router).
 * @property {string} [runtime] - Runtime flavour when it differs from the
 *   family default ("nuxt", "sveltekit", "angular").
 * @property {string} [clientDirective] - Directive prepended to generated
 *   client modules (for example Next.js "use client"); "" when the
 *   framework has none.
 * @property {string} [publicApiBaseUrlExpression] - Expression generated
 *   code uses to read the public API base URL in this framework.
 * @property {boolean} [inspectionOnly] - True when the adapter exists so
 *   existing projects can be inspected, but the CLI cannot generate or
 *   upgrade projects for it yet (Angular today).
 */

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function checkStringList(problems, adapterId, field, values, allowed, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (values.length === 0 && !allowEmpty)) {
    problems.push(`adapter "${adapterId}": "${field}" must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const value of values) {
    if (!isNonEmptyString(value)) {
      problems.push(`adapter "${adapterId}": "${field}" entries must be non-empty strings`);
      continue;
    }
    if (allowed && !allowed.includes(value)) {
      problems.push(`adapter "${adapterId}": "${field}" contains unknown value "${value}"`);
    }
    if (seen.has(value)) {
      problems.push(`adapter "${adapterId}": "${field}" contains duplicate value "${value}"`);
    }
    seen.add(value);
  }
}

function checkCapabilities(problems, adapterId, capabilities) {
  if (!isPlainObject(capabilities)) {
    problems.push(`adapter "${adapterId}": "capabilities" must be an object`);
    return;
  }
  for (const capabilityId of CAPABILITY_IDS) {
    const options = capabilities[capabilityId];
    if (!Array.isArray(options) || options.length === 0) {
      problems.push(
        `adapter "${adapterId}": "capabilities.${capabilityId}" must be a non-empty array of option names`
      );
      continue;
    }
    const fallback = capabilities.defaults?.[capabilityId];
    if (!isNonEmptyString(fallback)) {
      problems.push(
        `adapter "${adapterId}": "capabilities.defaults.${capabilityId}" must name a default option`
      );
    } else if (!options.includes(fallback)) {
      problems.push(
        `adapter "${adapterId}": "capabilities.defaults.${capabilityId}" is "${fallback}", which is not one of the declared options`
      );
    }
  }
}

function collectDependencyPackages(adapter) {
  const packages = new Set(adapter.baseDependencies ?? []);
  for (const options of Object.values(adapter.dependencies ?? {})) {
    for (const names of Object.values(options ?? {})) {
      for (const name of names ?? []) {
        packages.add(name);
      }
    }
  }
  return packages;
}

/**
 * Checks an adapter against contract v2 and returns the list of problems
 * found (an empty array means the adapter conforms). By default the v2
 * fields (`targets`, `capabilities`, `generators`) are checked when
 * present but not required; pass `{ requireV2: true }` to require them.
 *
 * @param {FrameworkAdapter} adapter - The adapter to check.
 * @param {{ requireV2?: boolean }} [options] - Validation options.
 * @returns {string[]} Human-readable contract violations.
 */
export function validateAdapter(adapter, { requireV2 = false } = {}) {
  if (!isPlainObject(adapter)) {
    return ["adapter must be an object"];
  }
  const problems = [];
  const adapterId = isNonEmptyString(adapter.id) ? adapter.id : "<unknown>";

  if (!isNonEmptyString(adapter.id)) {
    problems.push(`adapter "${adapterId}": "id" must be a non-empty string`);
  }
  if (!isNonEmptyString(adapter.family)) {
    problems.push(`adapter "${adapterId}": "family" must be a non-empty string`);
  }
  if (!isNonEmptyString(adapter.sourceDirectory)) {
    problems.push(`adapter "${adapterId}": "sourceDirectory" must be a non-empty string`);
  }

  if (adapter.targets === undefined) {
    if (requireV2) {
      problems.push(`adapter "${adapterId}": "targets" is required by adapter contract v2`);
    }
  } else {
    checkStringList(problems, adapterId, "targets", adapter.targets, PROJECT_TARGETS);
  }

  if (adapter.capabilities === undefined) {
    if (requireV2) {
      problems.push(`adapter "${adapterId}": "capabilities" is required by adapter contract v2`);
    }
  } else {
    checkCapabilities(problems, adapterId, adapter.capabilities);
  }

  if (adapter.generators === undefined) {
    if (requireV2) {
      problems.push(`adapter "${adapterId}": "generators" is required by adapter contract v2`);
    }
  } else {
    // An empty generator list is valid: it is how an inspection-only
    // adapter declares that it supports no generators.
    checkStringList(problems, adapterId, "generators", adapter.generators, GENERATOR_TYPES, {
      allowEmpty: true,
    });
  }

  if (adapter.baseDependencies !== undefined) {
    if (
      !Array.isArray(adapter.baseDependencies) ||
      adapter.baseDependencies.some((name) => !isNonEmptyString(name))
    ) {
      problems.push(`adapter "${adapterId}": "baseDependencies" must be an array of package names`);
    }
  }

  if (!isPlainObject(adapter.dependencies)) {
    problems.push(`adapter "${adapterId}": "dependencies" must be an object`);
  } else {
    for (const [capabilityId, options] of Object.entries(adapter.dependencies)) {
      if (!CAPABILITY_IDS.includes(capabilityId)) {
        problems.push(
          `adapter "${adapterId}": "dependencies" declares unknown capability "${capabilityId}"`
        );
        continue;
      }
      if (!isPlainObject(options)) {
        problems.push(
          `adapter "${adapterId}": "dependencies.${capabilityId}" must map options to package lists`
        );
        continue;
      }
      for (const [option, names] of Object.entries(options)) {
        if (!Array.isArray(names) || names.some((name) => !isNonEmptyString(name))) {
          problems.push(
            `adapter "${adapterId}": "dependencies.${capabilityId}.${option}" must be an array of package names`
          );
        }
      }
    }
    if (!adapter.inspectionOnly && Object.keys(adapter.dependencies).length === 0) {
      problems.push(
        `adapter "${adapterId}": "dependencies" may be empty only for inspection-only adapters`
      );
    }
  }

  if (adapter.dependencyVersions === undefined) {
    if (!adapter.inspectionOnly) {
      problems.push(
        `adapter "${adapterId}": "dependencyVersions" is required unless the adapter is inspection-only`
      );
    }
  } else {
    if (!isPlainObject(adapter.dependencyVersions)) {
      problems.push(`adapter "${adapterId}": "dependencyVersions" must be an object`);
    } else {
      for (const [name, range] of Object.entries(adapter.dependencyVersions)) {
        if (!isNonEmptyString(range)) {
          problems.push(
            `adapter "${adapterId}": "dependencyVersions.${name}" must be a non-empty version range`
          );
        }
      }
      for (const name of collectDependencyPackages(adapter)) {
        if (!(name in adapter.dependencyVersions)) {
          problems.push(
            `adapter "${adapterId}": package "${name}" is used by "dependencies" but has no entry in "dependencyVersions"`
          );
        }
      }
    }
  }

  return problems;
}

/**
 * Asserts that an adapter conforms to contract v2, throwing with every
 * problem found. Returns the adapter unchanged when it conforms.
 *
 * @param {FrameworkAdapter} adapter - The adapter to check.
 * @param {{ requireV2?: boolean }} [options] - Validation options.
 * @returns {FrameworkAdapter} The same adapter.
 */
export function assertAdapterContract(adapter, options) {
  const problems = validateAdapter(adapter, options);
  if (problems.length > 0) {
    throw new Error(`Adapter contract v${ADAPTER_CONTRACT_VERSION} violations:\n- ${problems.join("\n- ")}`);
  }
  return adapter;
}
