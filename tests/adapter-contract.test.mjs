import assert from "node:assert/strict";
import test from "node:test";
import {
  ADAPTER_CONTRACT_VERSION,
  assertAdapterContract,
  validateAdapter,
} from "../bin/core/frameworks/adapter-contract.mjs";
import { CAPABILITY_MATRIX } from "../bin/core/capability-matrix.mjs";
import { listFrameworkAdapters } from "../bin/core/frameworks/index.mjs";

const completeV2Adapter = Object.freeze({
  id: "example",
  family: "react",
  targets: ["web"],
  sourceDirectory: "src",
  capabilities: {
    defaults: {
      apiClient: "fetch",
      serverState: "none",
      clientState: "none",
      forms: "none",
    },
    apiClient: ["axios", "fetch"],
    serverState: ["none"],
    clientState: ["none"],
    forms: ["none"],
  },
  generators: ["feature", "page"],
  baseDependencies: ["example-router"],
  dependencies: {
    apiClient: { axios: ["axios"], fetch: [] },
    serverState: { none: [] },
    clientState: { none: [] },
    forms: { none: [] },
  },
  dependencyVersions: {
    axios: "^1.20.0",
    "example-router": "^1.0.0",
  },
});

test("adapter contract is version 2", () => {
  assert.equal(ADAPTER_CONTRACT_VERSION, 2);
});

test("every registered adapter conforms to the contract today", () => {
  const adapters = listFrameworkAdapters();
  assert.ok(adapters.length > 0);
  for (const adapter of adapters) {
    assert.deepEqual(validateAdapter(adapter), [], `adapter "${adapter.id}"`);
    assert.equal(assertAdapterContract(adapter), adapter);
  }
});

test("registered adapters do not declare targets yet", () => {
  // Capabilities and generators moved into the adapters with contract v2;
  // targets are the one v2 field still missing, populated by the targets
  // migration. Strict validation must name exactly that gap.
  for (const adapter of listFrameworkAdapters()) {
    const problems = validateAdapter(adapter, { requireV2: true });
    assert.deepEqual(
      problems.map((problem) => problem.match(/"(\w+)" is required/)?.[1]),
      ["targets"],
      `adapter "${adapter.id}"`
    );
  }
});

test("capability matrix is derived from the adapters", () => {
  const adapters = listFrameworkAdapters();
  assert.deepEqual(
    Object.keys(CAPABILITY_MATRIX).sort(),
    adapters.map((adapter) => adapter.id).sort()
  );
  for (const adapter of adapters) {
    const row = CAPABILITY_MATRIX[adapter.id];
    for (const capabilityId of ["apiClient", "serverState", "clientState", "forms"]) {
      assert.deepEqual(row[capabilityId], adapter.capabilities[capabilityId], `adapter "${adapter.id}"`);
      assert.equal(row.defaults[capabilityId], adapter.capabilities.defaults[capabilityId]);
    }
    assert.deepEqual(row.generators, adapter.generators, `adapter "${adapter.id}" generators`);
    assert.equal(row.defaults.packageManager, "npm");
    assert.deepEqual(
      row.packageManager,
      adapter.inspectionOnly ? ["npm"] : ["npm", "pnpm", "yarn", "bun"],
      `adapter "${adapter.id}" package managers`
    );
  }
});

test("derived matrix rows keep their exact pre-derivation values", () => {
  assert.deepEqual(CAPABILITY_MATRIX["react-vite"], {
    defaults: {
      apiClient: "axios",
      serverState: "react-query",
      clientState: "zustand",
      forms: "react-hook-form-zod",
      packageManager: "npm",
    },
    apiClient: ["axios", "fetch"],
    serverState: ["react-query", "none"],
    clientState: ["zustand", "redux", "none"],
    forms: ["react-hook-form-zod", "none"],
    packageManager: ["npm", "pnpm", "yarn", "bun"],
    generators: ["feature", "entity", "widget", "page", "shared"],
  });
  assert.deepEqual(CAPABILITY_MATRIX.angular, {
    defaults: {
      apiClient: "angular-http",
      serverState: "angular-query",
      clientState: "ngrx-signals",
      forms: "angular-forms-zod",
      packageManager: "npm",
    },
    apiClient: ["angular-http"],
    serverState: ["angular-query"],
    clientState: ["ngrx-signals"],
    forms: ["angular-forms-zod"],
    packageManager: ["npm"],
    generators: [],
  });
});

test("a complete v2 adapter passes strict validation", () => {
  assert.deepEqual(validateAdapter(completeV2Adapter, { requireV2: true }), []);
});

test("validator requires the identity fields", () => {
  const problems = validateAdapter({ sourceDirectory: "src", dependencies: {} });
  assert.match(problems.join("\n"), /"id" must be a non-empty string/);
  assert.match(problems.join("\n"), /"family" must be a non-empty string/);
});

test("validator rejects unknown and duplicate targets", () => {
  const problems = validateAdapter({
    ...completeV2Adapter,
    targets: ["web", "web", "desktop"],
  });
  assert.match(problems.join("\n"), /unknown value "desktop"/);
  assert.match(problems.join("\n"), /duplicate value "web"/);
});

test("validator rejects a capability default outside the declared options", () => {
  const problems = validateAdapter({
    ...completeV2Adapter,
    capabilities: {
      ...completeV2Adapter.capabilities,
      defaults: { ...completeV2Adapter.capabilities.defaults, apiClient: "got" },
    },
  });
  assert.match(problems.join("\n"), /defaults\.apiClient" is "got", which is not one of the declared options/);
});

test("validator rejects unknown generator types", () => {
  const problems = validateAdapter({ ...completeV2Adapter, generators: ["feature", "slice"] });
  assert.match(problems.join("\n"), /"generators" contains unknown value "slice"/);
});

test("validator rejects unknown capability groups in dependencies", () => {
  const problems = validateAdapter({
    ...completeV2Adapter,
    dependencies: { ...completeV2Adapter.dependencies, styling: { tailwind: [] } },
  });
  assert.match(problems.join("\n"), /unknown capability "styling"/);
});

test("validator rejects dependency packages without a pinned version", () => {
  const problems = validateAdapter({
    ...completeV2Adapter,
    dependencies: {
      ...completeV2Adapter.dependencies,
      apiClient: { axios: ["axios", "ky"], fetch: [] },
    },
  });
  assert.match(problems.join("\n"), /package "ky" is used by "dependencies" but has no entry/);
});

test("validator allows inspection-only adapters without versions", () => {
  const problems = validateAdapter({
    id: "planned",
    family: "angular",
    sourceDirectory: "src",
    inspectionOnly: true,
    dependencies: {},
  });
  assert.deepEqual(problems, []);
});

test("assertAdapterContract throws every problem at once", () => {
  assert.throws(
    () => assertAdapterContract({}),
    /Adapter contract v2 violations:\n- adapter "<unknown>": "id" must be a non-empty string/
  );
});
