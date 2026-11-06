import { nextjsAdapter } from "./nextjs.mjs";
import { angularAdapter } from "./angular.mjs";
import { nuxtAdapter } from "./nuxt.mjs";
import { reactViteAdapter } from "./react-vite.mjs";
import { sveltekitAdapter } from "./sveltekit.mjs";
import { vueViteAdapter } from "./vue-vite.mjs";
import { PROJECT_TARGETS, assertAdapterContract } from "./adapter-contract.mjs";

// Registration enforces adapter contract v2 in full: an adapter that does
// not declare every v2 field (targets, capabilities, generators, ...) fails
// here, at startup, with every violation listed.
const adapters = new Map(
  [
    reactViteAdapter,
    nextjsAdapter,
    vueViteAdapter,
    nuxtAdapter,
    sveltekitAdapter,
    angularAdapter,
  ].map((adapter) => [adapter.id, assertAdapterContract(adapter, { requireV2: true })])
);

/**
 * @param {string} framework - Framework id from the template registry.
 * @returns {import("./adapter-contract.mjs").FrameworkAdapter} The adapter.
 */
export function getFrameworkAdapter(framework) {
  const adapter = adapters.get(framework);
  if (!adapter) {
    throw new Error(
      `Framework "${framework}" is registered but does not have an implementation adapter yet.`
    );
  }
  return adapter;
}

/**
 * @param {string} framework - Framework id from the template registry.
 * @returns {boolean} Whether an implementation adapter is registered.
 */
export function hasFrameworkAdapter(framework) {
  return adapters.has(framework);
}

/**
 * @returns {import("./adapter-contract.mjs").FrameworkAdapter[]} Every registered adapter.
 */
export function listFrameworkAdapters() {
  return [...adapters.values()];
}

/**
 * Lists the adapters that can create projects for a target, in registry
 * order. The Project Target init flow uses this to offer only the
 * frameworks that support the chosen target.
 *
 * @param {import("./adapter-contract.mjs").ProjectTarget} target - The project target.
 * @returns {import("./adapter-contract.mjs").FrameworkAdapter[]} Adapters supporting the target.
 */
export function listFrameworkAdaptersByTarget(target) {
  if (!PROJECT_TARGETS.includes(target)) {
    throw new Error(
      `Unknown project target "${target}". Supported targets: ${PROJECT_TARGETS.join(", ")}.`
    );
  }
  return listFrameworkAdapters().filter((adapter) => adapter.targets.includes(target));
}

/**
 * @returns {string[]} Every npm package the registered adapters manage.
 */
export function listManagedDependencies() {
  return [
    ...new Set(
      listFrameworkAdapters().filter((adapter) => !adapter.inspectionOnly).flatMap((adapter) =>
        [
          ...(adapter.baseDependencies ?? []),
          ...Object.values(adapter.dependencies).flatMap((options) =>
            Object.values(options).flat()
          ),
        ]
      )
    ),
  ];
}
