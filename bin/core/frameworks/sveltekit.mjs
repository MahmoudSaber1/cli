/** @type {import("./adapter-contract.mjs").FrameworkAdapter} */
export const sveltekitAdapter = Object.freeze({
  id: "sveltekit",
  family: "svelte",
  runtime: "sveltekit",
  sourceDirectory: "src",
  clientDirective: "",
  publicApiBaseUrlExpression: 'env.PUBLIC_API_BASE || "/api"',
  capabilities: {
    defaults: {
      apiClient: "fetch",
      serverState: "svelte-query",
      clientState: "svelte-store",
      forms: "sveltekit-superforms-zod",
    },
    apiClient: ["axios", "fetch"],
    serverState: ["svelte-query", "none"],
    clientState: ["svelte-store", "none"],
    forms: ["sveltekit-superforms-zod", "none"],
  },
  generators: ["feature", "entity", "widget", "page", "shared"],
  dependencies: {
    apiClient: { axios: ["axios"], fetch: [] },
    serverState: { "svelte-query": ["@tanstack/svelte-query"], none: [] },
    clientState: { "svelte-store": [], none: [] },
    forms: {
      "sveltekit-superforms-zod": ["sveltekit-superforms", "zod"],
      none: [],
    },
  },
  dependencyVersions: {
    "@tanstack/svelte-query": "^6.2.1",
    axios: "^1.20.0",
    "sveltekit-superforms": "^2.30.2",
    zod: "^4.6.5",
  },
});
