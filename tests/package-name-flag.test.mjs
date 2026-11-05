import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { resolvePackageName } from "../bin/commands/create-project.mjs";
import { applyPackageIdentity } from "../bin/core/package-identity.mjs";
import { resolveExplicitPackageName } from "../bin/core/package-name.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fakeAsk(answer) {
  const calls = [];
  const ask = async (question) => {
    calls.push(question);
    return answer;
  };
  ask.calls = calls;
  return ask;
}

test("the parser reads the package name from the flag", () => {
  assert.equal(
    parseCliArgs(["shop", "--package-name", "@acme/shop"]).packageName,
    "@acme/shop"
  );
  assert.equal(
    parseCliArgs(["shop", "--package-name=@acme/shop"]).packageName,
    "@acme/shop"
  );
  assert.equal(parseCliArgs(["shop"]).packageName, undefined);
  assert.throws(
    () => parseCliArgs(["shop", "--package-name"]),
    CliUsageError
  );
});

test("an explicit package name is validated and never rewritten", () => {
  assert.equal(resolveExplicitPackageName("my-app"), "my-app");
  assert.equal(resolveExplicitPackageName("@scope/x"), "@scope/x");
  assert.equal(resolveExplicitPackageName("  my-app  "), "my-app");
});

test("an invalid explicit package name is refused with a suggestion", () => {
  assert.throws(
    () => resolveExplicitPackageName("MyApp"),
    /"--package-name MyApp" is not a valid npm package name.*Use "myapp" instead/s
  );
  assert.throws(
    () => resolveExplicitPackageName("http"),
    /Use "http-app" instead/
  );
  assert.throws(() => resolveExplicitPackageName(""), /requires a package name/);
});

test("the explicit package name wins over the project name", async () => {
  const ask = fakeAsk({});
  const { packageName, warning } = await resolvePackageName(
    "MyApp",
    { packageName: "shop-core" },
    ask
  );
  assert.equal(packageName, "shop-core");
  assert.equal(warning, null);
  assert.equal(ask.calls.length, 0);
});

test("the explicit package name is independent of the folder name", async () => {
  const ask = fakeAsk({});
  const { packageName } = await resolvePackageName(
    "apps/MyApp",
    { packageName: "@acme/shop" },
    ask
  );
  assert.equal(packageName, "@acme/shop");
});

test("the CLI refuses an invalid explicit package name", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "bin", "index.mjs"),
      "shop",
      "--framework",
      "react-vite",
      "--package-name",
      "MyApp",
      "--yes",
      "--no-install",
      "--no-start",
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /"--package-name MyApp" is not a valid npm package name/
  );
  assert.match(result.stderr, /Use "myapp" instead/);
});

test("the explicit package name reaches the generated package.json", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-package-name-flag-"));
  try {
    fs.writeFileSync(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "fsd-architecture-starter", version: "0.0.0" })}\n`
    );

    const { packageName } = await resolvePackageName(
      "MyApp",
      { packageName: "@acme/shop" },
      fakeAsk({})
    );
    applyPackageIdentity(root, packageName);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    assert.equal(packageJson.name, "@acme/shop");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
