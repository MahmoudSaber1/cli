import assert from "node:assert/strict";
import test from "node:test";
import { PROJECT_TARGETS } from "../bin/core/frameworks/adapter-contract.mjs";
import {
  DEFAULT_PROJECT_TARGET,
  PROJECT_TARGET_OPTIONS,
  adapterTargetsForSelection,
  assertProjectTargetAvailable,
  getProjectTargetOption,
  isProjectTargetAvailable,
  isProjectTargetSelection,
  projectTargetUnavailableMessage,
} from "../bin/core/project-target.mjs";
import { resolveProjectTarget } from "../bin/commands/create-project.mjs";

function fakeAsk(answer) {
  const calls = [];
  const ask = async (question) => {
    calls.push(question);
    return answer;
  };
  ask.calls = calls;
  return ask;
}

test("the project target choices are the four roadmap targets, web first", () => {
  assert.deepEqual(
    PROJECT_TARGET_OPTIONS.map((option) => option.value),
    ["web", "multi-web", "mobile", "universal"]
  );
  assert.deepEqual(
    PROJECT_TARGET_OPTIONS.map((option) => option.title),
    ["Web", "Multi-web", "Mobile", "Universal"]
  );
  assert.equal(DEFAULT_PROJECT_TARGET, "web");
  assert.ok(Object.isFrozen(PROJECT_TARGET_OPTIONS));
});

test("selection validation accepts the four targets and rejects anything else", () => {
  for (const option of PROJECT_TARGET_OPTIONS) {
    assert.equal(isProjectTargetSelection(option.value), true);
    assert.equal(getProjectTargetOption(option.value), option);
  }
  assert.equal(isProjectTargetSelection("desktop"), false);
  assert.throws(
    () => getProjectTargetOption("desktop"),
    /Unknown project target "desktop"\. Supported targets: web, multi-web, mobile, universal\./
  );
});

test("selections map to adapter targets inside the contract vocabulary", () => {
  assert.deepEqual(adapterTargetsForSelection("web"), ["web"]);
  assert.deepEqual(adapterTargetsForSelection("multi-web"), ["web"]);
  assert.deepEqual(adapterTargetsForSelection("mobile"), ["mobile"]);
  assert.deepEqual(adapterTargetsForSelection("universal"), ["web", "mobile"]);

  for (const option of PROJECT_TARGET_OPTIONS) {
    for (const target of adapterTargetsForSelection(option.value)) {
      assert.ok(PROJECT_TARGETS.includes(target), `${option.value} maps outside the vocabulary`);
    }
  }

  // The mapping is a copy: mutating it cannot corrupt the frozen options.
  adapterTargetsForSelection("universal").push("desktop");
  assert.deepEqual(adapterTargetsForSelection("universal"), ["web", "mobile"]);
});

test("an explicit target wins and is validated without asking", async () => {
  const ask = fakeAsk({});
  assert.equal(await resolveProjectTarget({ target: "web" }, ask), "web");
  assert.equal(ask.calls.length, 0);

  await assert.rejects(
    () => resolveProjectTarget({ target: "desktop" }, ask),
    /Unknown project target "desktop"/
  );
  assert.equal(ask.calls.length, 0);
});

test("a target that is not implemented yet is rejected, never silently downgraded", async () => {
  const ask = fakeAsk({});
  for (const target of ["multi-web", "mobile", "universal"]) {
    await assert.rejects(
      () => resolveProjectTarget({ target }, ask),
      /project target is not available yet/
    );
  }
  // The guard applies under --yes too: an explicit target beats the
  // default, so a gated one fails instead of falling back to web.
  await assert.rejects(
    () => resolveProjectTarget({ yes: true, target: "mobile" }, ask),
    /The Mobile project target is not available yet: no framework supports mobile yet\./
  );
  assert.equal(ask.calls.length, 0);
});

test("only the web target is available today", () => {
  assert.equal(isProjectTargetAvailable("web"), true);
  for (const target of ["multi-web", "mobile", "universal"]) {
    assert.equal(isProjectTargetAvailable(target), false);
    assert.match(
      projectTargetUnavailableMessage(target),
      /is not available yet: .+\. Only Web projects can be created today\./
    );
    assert.throws(() => assertProjectTargetAvailable(target), /not available yet/);
  }
  assert.doesNotThrow(() => assertProjectTargetAvailable("web"));
});

test("--yes defaults to web without asking", async () => {
  const ask = fakeAsk({});
  assert.equal(await resolveProjectTarget({ yes: true }, ask), "web");
  assert.equal(ask.calls.length, 0);
});

test("the prompt offers the four targets with web preselected and the rest disabled", async () => {
  const ask = fakeAsk({ target: "web" });
  assert.equal(await resolveProjectTarget({}, ask), "web");

  assert.equal(ask.calls.length, 1);
  const [question] = ask.calls;
  assert.equal(question.type, "select");
  assert.equal(question.name, "target");
  assert.deepEqual(
    question.choices.map((choice) => choice.value),
    ["web", "multi-web", "mobile", "universal"]
  );
  assert.equal(question.choices[question.initial].value, "web");
  // Unimplemented targets are visible but cannot be picked, mirroring how
  // the framework prompt treats planned templates.
  assert.deepEqual(
    question.choices.map((choice) => choice.disabled),
    [false, true, true, true]
  );
  assert.deepEqual(
    question.choices.map((choice) => choice.title),
    ["Web", "Multi-web (Coming Soon)", "Mobile (Coming Soon)", "Universal (Coming Soon)"]
  );
});
