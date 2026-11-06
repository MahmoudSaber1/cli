import assert from "node:assert/strict";
import test from "node:test";
import {
  getFamilyGenerator,
  hasFamilyGenerator,
  listFamilyGenerators,
} from "../bin/generators/family-generators.mjs";
import { createReactFilePlan } from "../bin/generators/react.mjs";
import { createSvelteFilePlan } from "../bin/generators/svelte.mjs";
import { createVueFilePlan } from "../bin/generators/vue.mjs";
import { listFrameworkAdapters } from "../bin/core/frameworks/index.mjs";
import { normalizeProjectConfig } from "../bin/project-config.mjs";

test("every generator family implements the shared interface", () => {
  assert.deepEqual(
    listFamilyGenerators().map((generator) => generator.family),
    ["react", "vue", "svelte"]
  );
  for (const generator of listFamilyGenerators()) {
    assert.equal(typeof generator.createFilePlan, "function", `family "${generator.family}"`);
    assert.equal(getFamilyGenerator(generator.family), generator);
    assert.equal(hasFamilyGenerator(generator.family), true);
  }
});

test("registry delegates to the family implementations", () => {
  assert.equal(getFamilyGenerator("react").createFilePlan, createReactFilePlan);
  assert.equal(getFamilyGenerator("vue").createFilePlan, createVueFilePlan);
  assert.equal(getFamilyGenerator("svelte").createFilePlan, createSvelteFilePlan);
});

test("families without an implementation are rejected clearly", () => {
  assert.equal(hasFamilyGenerator("angular"), false);
  assert.throws(
    () => getFamilyGenerator("angular"),
    /Framework family "angular" does not have a generator implementation yet/
  );
});

test("every adapter family with generators resolves through the registry", () => {
  for (const adapter of listFrameworkAdapters()) {
    if (adapter.generators.length > 0) {
      assert.equal(hasFamilyGenerator(adapter.family), true, `adapter "${adapter.id}"`);
    }
  }
});

test("each family builds a file plan through the shared interface", () => {
  const cases = [
    ["react", "react-vite"],
    ["vue", "vue-vite"],
    ["svelte", "sveltekit"],
  ];
  for (const [family, framework] of cases) {
    const config = normalizeProjectConfig(framework);
    const plan = getFamilyGenerator(family).createFilePlan("entity", "product", config);
    assert.ok(Array.isArray(plan) && plan.length > 0, `family "${family}"`);
    for (const entry of plan) {
      assert.equal(typeof entry.path, "string");
      assert.equal(typeof entry.content, "string");
    }
  }
});

test("the React family keeps its auth and generic feature plans", () => {
  const config = normalizeProjectConfig("react-vite");
  const generic = createReactFilePlan("feature", "billing", config);
  assert.ok(generic.some((entry) => entry.path.includes("billing")));
  const auth = createReactFilePlan("feature", "auth", config);
  assert.ok(auth.some((entry) => entry.path.startsWith("ui/login-form")));
});
