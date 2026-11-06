/** @type {import("./adapter-contract.mjs").FrameworkAdapter} */
export const reactViteAdapter = Object.freeze({
  id: "react-vite",
  family: "react",
  sourceDirectory: "src",
  clientDirective: "",
  publicApiBaseUrlExpression: 'import.meta.env.VITE_API_URL ?? "/api"',
  baseDependencies: ["react-router-dom"],
  dependencies: {
    apiClient: { axios: ["axios"], fetch: [] },
    serverState: { "react-query": ["@tanstack/react-query"], none: [] },
    clientState: {
      zustand: ["zustand"],
      redux: ["@reduxjs/toolkit", "react-redux"],
      none: [],
    },
    forms: {
      "react-hook-form-zod": ["react-hook-form", "zod", "@hookform/resolvers"],
      none: [],
    },
  },
  dependencyVersions: {
    "@hookform/resolvers": "^5.9.1",
    "@reduxjs/toolkit": "^2.12.0",
    "@tanstack/react-query": "^5.102.8",
    axios: "^1.20.0",
    "react-hook-form": "^7.88.0",
    "react-redux": "^9.3.0",
    "react-router-dom": "^7.18.4",
    zod: "^4.6.5",
    zustand: "^5.0.15",
  },
});
