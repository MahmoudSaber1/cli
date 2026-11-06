import { nextjsAdapter } from "./nextjs.mjs";
import { angularAdapter } from "./angular.mjs";
import { nuxtAdapter } from "./nuxt.mjs";
import { reactViteAdapter } from "./react-vite.mjs";
import { sveltekitAdapter } from "./sveltekit.mjs";
import { vueViteAdapter } from "./vue-vite.mjs";

const adapters = new Map(
  [
    reactViteAdapter,
    nextjsAdapter,
    vueViteAdapter,
    nuxtAdapter,
    sveltekitAdapter,
    angularAdapter,
  ].map((adapter) => [adapter.id, adapter])
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
