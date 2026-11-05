import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyPackageIdentity } from "../bin/core/package-identity.mjs";

function createProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-package-identity-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

test("the generated package.json carries the project name and no template version", () => {
  const root = createProject({
    "package.json": `${JSON.stringify(
      {
        name: "fsd-architecture-starter",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite" },
        dependencies: { react: "^19.2.0" },
      },
      null,
      2
    )}\n`,
  });

  try {
    const result = applyPackageIdentity(root, "my-app");
    assert.equal(result.templateName, "fsd-architecture-starter");
    assert.equal(result.packageName, "my-app");

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    assert.equal(packageJson.name, "my-app");
    assert.equal(packageJson.private, true);
    assert.equal("version" in packageJson, false);
    assert.equal(packageJson.type, "module");
    assert.deepEqual(packageJson.scripts, { dev: "vite" });
    assert.deepEqual(packageJson.dependencies, { react: "^19.2.0" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the npm lockfile name fields follow the project name", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "fsd-nextjs", version: "0.1.0" })}\n`,
    "package-lock.json": `${JSON.stringify(
      {
        name: "fsd-nextjs",
        version: "0.1.0",
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": { name: "fsd-nextjs", version: "0.1.0", dependencies: { next: "16.4.3" } },
          "node_modules/next": { version: "16.4.3" },
        },
      },
      null,
      2
    )}\n`,
  });

  try {
    applyPackageIdentity(root, "my-app");
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf8")
    );
    assert.equal(lock.name, "my-app");
    assert.equal("version" in lock, false);
    assert.equal(lock.packages[""].name, "my-app");
    assert.equal("version" in lock.packages[""], false);
    assert.deepEqual(lock.packages[""].dependencies, { next: "16.4.3" });
    assert.equal(lock.packages["node_modules/next"].version, "16.4.3");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the bun lockfile root workspace name follows the project name", () => {
  const bunLock = `{
  "lockfileVersion": 1,
  "configVersion": 0,
  "workspaces": {
    "": {
      "name": "mudular-structure-v2",
      "dependencies": {
        "react": "^19.2.0",
      },
    },
  },
  "packages": {
    "react": ["react@19.2.0", "", {}, "sha512-abc"],
  },
}
`;
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "fsd-architecture-starter" })}\n`,
    "bun.lock": bunLock,
  });

  try {
    applyPackageIdentity(root, "my-app");
    const updated = fs.readFileSync(path.join(root, "bun.lock"), "utf8");
    assert.match(updated, /"name": "my-app"/);
    assert.doesNotMatch(updated, /mudular-structure-v2/);
    // The bun lockfile is JSONC, so the trailing commas must survive.
    assert.match(updated, /"react": "\^19\.2\.0",\n/);
    assert.match(updated, /"packages": \{/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a project without lockfiles is identified without them", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "fsd-vue-starter", version: "0.0.0" })}\n`,
  });

  try {
    applyPackageIdentity(root, "my-app");
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    assert.equal(packageJson.name, "my-app");
    assert.equal("version" in packageJson, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a project without a package.json is refused", () => {
  const root = createProject({});
  try {
    assert.throws(() => applyPackageIdentity(root, "my-app"), /package\.json/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
