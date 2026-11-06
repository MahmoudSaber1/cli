/** @type {import("./adapter-contract.mjs").FrameworkAdapter} */
export const nuxtAdapter = Object.freeze({
  id: "nuxt",
  family: "vue",
  runtime: "nuxt",
  sourceDirectory: "app",
  clientDirective: "",
  baseDependencies: ["vue-router"],
  dependencies: {
    apiClient: { axios: ["axios"], fetch: [] },
    serverState: { "vue-query": ["@tanstack/vue-query"], none: [] },
    clientState: { pinia: ["pinia", "@pinia/nuxt"], none: [] },
    forms: {
      "vee-validate-zod": [
        "vee-validate",
        "@vee-validate/nuxt",
        "@vee-validate/zod",
        "zod",
      ],
      none: [],
    },
  },
  dependencyVersions: {
    "@pinia/nuxt": "^1.0.2",
    "@tanstack/vue-query": "^5.103.1",
    "@vee-validate/nuxt": "^4.15.1",
    "@vee-validate/zod": "^4.15.1",
    axios: "^1.20.0",
    pinia: "^4.0.3",
    "vee-validate": "^4.15.1",
    "vue-router": "^5.3.1",
    zod: "^3.25.76",
  },
});
