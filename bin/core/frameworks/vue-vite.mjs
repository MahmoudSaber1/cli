/** @type {import("./adapter-contract.mjs").FrameworkAdapter} */
export const vueViteAdapter = Object.freeze({
  id: "vue-vite",
  family: "vue",
  sourceDirectory: "src",
  clientDirective: "",
  publicApiBaseUrlExpression: 'import.meta.env.VITE_API_URL ?? "/api"',
  baseDependencies: ["vue-router"],
  dependencies: {
    apiClient: { axios: ["axios"], fetch: [] },
    serverState: { "vue-query": ["@tanstack/vue-query"], none: [] },
    clientState: { pinia: ["pinia"], none: [] },
    forms: {
      "vee-validate-zod": ["vee-validate", "@vee-validate/zod", "zod"],
      none: [],
    },
  },
  dependencyVersions: {
    "@tanstack/vue-query": "^5.102.8",
    "@vee-validate/zod": "^4.15.1",
    axios: "^1.20.0",
    pinia: "^4.0.3",
    "vee-validate": "^4.15.1",
    "vue-router": "^5.3.1",
    zod: "^3.25.76",
  },
});
