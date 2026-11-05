import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolvePackageName } from "../bin/commands/create-project.mjs";
import { applyPackageIdentity } from "../bin/core/package-identity.mjs";
import { describePackageNameSuggestion } from "../bin/core/package-name.mjs";

function fakeAsk(answer) {
  const calls = [];
  const ask = async (question) => {
    calls.push(question);
    return answer;
  };
  ask.calls = calls;
  return ask;
}

test("a valid package name is used without asking", async () => {
  const ask = fakeAsk({});
  const { packageName, warning } = await resolvePackageName("my-app", {}, ask);
  assert.equal(packageName, "my-app");
  assert.equal(warning, null);
  assert.equal(ask.calls.length, 0);
});

test("a name that is not a valid package name asks for a confirmation", async () => {
  const ask = fakeAsk({ useSuggestedPackageName: true });
  const { packageName, warning } = await resolvePackageName("MyApp", {}, ask);

  assert.equal(packageName, "myapp");
  assert.equal(warning, null);
  assert.equal(ask.calls.length, 1);
  assert.equal(ask.calls[0].type, "confirm");
  assert.equal(ask.calls[0].initial, true);
  assert.match(ask.calls[0].message, /"MyApp" is not a valid npm package name/);
  assert.match(ask.calls[0].message, /"myapp" as the package name\?/);
});

test("the confirmation explains why the name changed", async () => {
  const ask = fakeAsk({ useSuggestedPackageName: true });
  await resolvePackageName("MyApp", {}, ask);
  assert.match(ask.calls[0].message, /lowercased/);

  const coreModuleAsk = fakeAsk({ useSuggestedPackageName: true });
  const { packageName } = await resolvePackageName("http", {}, coreModuleAsk);
  assert.equal(packageName, "http-app");
  assert.match(coreModuleAsk.calls[0].message, /core module name/);
});

test("declining the suggestion keeps the name the user typed", async () => {
  const ask = fakeAsk({ useSuggestedPackageName: false });
  const { packageName } = await resolvePackageName("MyApp", {}, ask);
  assert.equal(packageName, "MyApp");
});

test("a nested project name suggests the last path segment", async () => {
  const ask = fakeAsk({ useSuggestedPackageName: true });
  const { packageName } = await resolvePackageName("apps/MyApp", {}, ask);
  assert.equal(packageName, "myapp");
  assert.match(ask.calls[0].message, /"myapp" as the package name\?/);
});

test("--yes never asks and never fails on a fixable name", async () => {
  const ask = fakeAsk({});
  const { packageName, warning } = await resolvePackageName(
    "MyApp",
    { yes: true },
    ask
  );
  assert.equal(packageName, "myapp");
  assert.equal(ask.calls.length, 0);
  assert.match(warning, /"MyApp" is not a valid npm package name/);
  assert.match(warning, /Using "myapp" instead/);
});

test("--yes reports the normalized name of every fixable name", async () => {
  const cases = [
    ["MyApp", "myapp"],
    ["http", "http-app"],
  ];

  for (const [projectName, expected] of cases) {
    const { packageName, warning } = await resolvePackageName(
      projectName,
      { yes: true },
      fakeAsk({})
    );
    assert.equal(packageName, expected);
    assert.match(warning, new RegExp(`Using "${expected}" instead`));
  }
});

test("--yes stays quiet when the name is already valid", async () => {
  const { packageName, warning } = await resolvePackageName(
    "my-app",
    { yes: true },
    fakeAsk({})
  );
  assert.equal(packageName, "my-app");
  assert.equal(warning, null);
});

test("the suggestion is described once and stays consistent", () => {
  const suggestion = describePackageNameSuggestion("MyApp");
  assert.equal(suggestion.valid, false);
  assert.equal(suggestion.name, "myapp");
  assert.equal(suggestion.raw, "MyApp");
  assert.match(suggestion.message, /not a valid npm package name/);

  const valid = describePackageNameSuggestion("my-app");
  assert.equal(valid.valid, true);
  assert.equal(valid.message, null);
});

test("the confirmed name is the one written into the project", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-name-confirm-"));
  try {
    fs.writeFileSync(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "fsd-architecture-starter", version: "0.0.0" })}\n`
    );

    const { packageName } = await resolvePackageName(
      "MyApp",
      {},
      fakeAsk({ useSuggestedPackageName: true })
    );
    applyPackageIdentity(root, packageName);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    assert.equal(packageJson.name, "myapp");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
