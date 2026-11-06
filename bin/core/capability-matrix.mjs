import { listFrameworkAdapters } from "./frameworks/index.mjs";

const COMMON_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];
const DEFAULT_PACKAGE_MANAGER = "npm";


export const CAPABILITY_LABELS = Object.freeze({
  apiClient: Object.freeze({
    axios: "Axios",
    fetch: "Native Fetch",
  }),
  serverState: Object.freeze({
    "react-query": "TanStack React Query",
    "vue-query": "TanStack Vue Query",
    "svelte-query": "TanStack Svelte Query",
    none: "None",
  }),
  clientState: Object.freeze({
    zustand: "Zustand",
    redux: "Redux Toolkit",
    pinia: "Pinia",
    "svelte-store": "Svelte stores",
    none: "None",
  }),
  forms: Object.freeze({
    "react-hook-form-zod": "React Hook Form + Zod",
    "vee-validate-zod": "VeeValidate + Zod",
    "sveltekit-superforms-zod": "SvelteKit Superforms + Zod",
    none: "None",
  }),
  packageManager: Object.freeze({
    npm: "npm",
    pnpm: "pnpm",
    yarn: "Yarn",
    bun: "Bun",
  }),
});

/**
 * Builds one capability matrix row from an adapter. The matrix is derived,
 * never written by hand: an adapter's declared `capabilities` and
 * `generators` are the single source of truth. Package managers are global
 * (see docs/ADAPTER-CONTRACT.md), so every adapter shares the common list
 * and the common default — except inspection-only adapters, which are
 * never used to create or install a project and therefore only carry the
 * default package manager.
 */
function buildCapabilityRow(adapter) {
  const { capabilities, generators } = adapter;
  const packageManagers = adapter.inspectionOnly
    ? [DEFAULT_PACKAGE_MANAGER]
    : COMMON_PACKAGE_MANAGERS;
  return Object.freeze({
    defaults: Object.freeze({
      ...capabilities.defaults,
      packageManager: DEFAULT_PACKAGE_MANAGER,
    }),
    apiClient: Object.freeze([...capabilities.apiClient]),
    serverState: Object.freeze([...capabilities.serverState]),
    clientState: Object.freeze([...capabilities.clientState]),
    forms: Object.freeze([...capabilities.forms]),
    packageManager: Object.freeze([...packageManagers]),
    generators: Object.freeze([...generators]),
  });
}

export const CAPABILITY_MATRIX = Object.freeze(
  Object.fromEntries(
    listFrameworkAdapters().map((adapter) => [adapter.id, buildCapabilityRow(adapter)])
  )
);

export function getCapabilities(framework) {
  const capabilities = CAPABILITY_MATRIX[framework];
  if (!capabilities) {
    throw new Error(`Unknown framework "${framework}".`);
  }
  return capabilities;
}

export function getCapabilityChoices(framework, capability) {
  const values = getCapabilities(framework)[capability];
  if (!values) {
    throw new Error(`Unknown capability "${capability}".`);
  }

  return values.map((value) => ({
    title: CAPABILITY_LABELS[capability]?.[value] ?? value,
    value,
  }));
}

export function getDefaultStack(framework) {
  return { ...getCapabilities(framework).defaults };
}

export function assertSupportedProjectConfig(config) {
  const capabilities = getCapabilities(config.framework);
  for (const key of [
    "apiClient",
    "serverState",
    "clientState",
    "forms",
    "packageManager",
  ]) {
    if (!capabilities[key].includes(config[key])) {
      throw new Error(
        `Unsupported ${key} "${config[key]}" for framework "${config.framework}".`
      );
    }
  }
  return config;
}

export function assertGeneratorSupported(framework, generatorType) {
  const capabilities = getCapabilities(framework);
  if (!capabilities.generators.includes(generatorType)) {
    throw new Error(
      `Generator "${generatorType}" is not supported by framework "${framework}".`
    );
  }
  return generatorType;
}
