// Inspection only: Angular generation and managed upgrades are separate work.
/** @type {import("./adapter-contract.mjs").FrameworkAdapter} */
export const angularAdapter = Object.freeze({
  id: "angular",
  family: "angular",
  runtime: "angular",
  sourceDirectory: "src",
  inspectionOnly: true,
  baseDependencies: [],
  capabilities: {
    defaults: {
      apiClient: "angular-http",
      serverState: "angular-query",
      clientState: "ngrx-signals",
      forms: "angular-forms-zod",
    },
    apiClient: ["angular-http"],
    serverState: ["angular-query"],
    clientState: ["ngrx-signals"],
    forms: ["angular-forms-zod"],
  },
  generators: [],
  dependencies: {},
});
