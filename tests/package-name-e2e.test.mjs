import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertProjectIdentity,
  collectTemplateIdentity,
} from "../scripts/ci/package-name-e2e.mjs";

function createProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-e2e-checks-"));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(root, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return root;
}

function templateFiles(packageName, readmeTitle, htmlTitle) {
  const files = new Map();
  files.set("package.json", JSON.stringify({ name: packageName, version: "0.0.0" }));
  files.set("README.md", `# ${readmeTitle}\n`);
  if (htmlTitle) files.set("index.html", `<title>${htmlTitle}</title>\n`);
  return files;
}

test("the template identity is read from the template files", () => {
  const identity = collectTemplateIdentity(
    templateFiles("fsd-architecture-starter", "FSD Architecture Starter", "FSD Architecture Starter")
  );
  assert.deepEqual(identity, [
    "fsd-architecture-starter",
    "FSD Architecture Starter",
  ]);
});

test("the template identity includes the SvelteKit layout title", () => {
  const files = templateFiles(
    "fsd-sveltekit-starter",
    "FSD SvelteKit Starter",
    null
  );
  files.set(
    "src/routes/+layout.svelte",
    `<svelte:head>\n  <title>FSD CLI · SvelteKit</title>\n</svelte:head>\n`
  );
  const identity = collectTemplateIdentity(files);
  assert.ok(identity.includes("FSD CLI · SvelteKit"));
});

test("a project with the right identity passes every check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "package-name-app", private: true })}\n`,
    "package-lock.json": `${JSON.stringify({
      name: "package-name-app",
      lockfileVersion: 3,
      packages: { "": { name: "package-name-app" } },
    })}\n`,
    "README.md": "# package-name-app\n",
    "index.html": "<title>package-name-app</title>\n",
  });

  try {
    const checks = assertProjectIdentity(root, {
      projectName: "package-name-app",
      templateIdentity: ["fsd-architecture-starter", "FSD Architecture Starter"],
    });
    assert.ok(checks.includes("package.json name"));
    assert.ok(checks.includes("no template identity left"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a project that keeps the template name fails the identity check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "fsd-architecture-starter" })}\n`,
    "README.md": "# FSD Architecture Starter\n",
  });

  try {
    assert.throws(
      () =>
        assertProjectIdentity(root, {
          projectName: "package-name-app",
          templateIdentity: ["fsd-architecture-starter"],
        }),
      /package\.json name is "fsd-architecture-starter"/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a project that keeps the template title fails the identity check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "package-name-app", private: true })}\n`,
    "README.md": "# FSD Architecture Starter\n",
  });

  try {
    assert.throws(
      () =>
        assertProjectIdentity(root, {
          projectName: "package-name-app",
          templateIdentity: ["FSD Architecture Starter"],
        }),
      /README title is "FSD Architecture Starter"/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a template title left in a file fails the check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "package-name-app", private: true })}\n`,
    "README.md": "# package-name-app\n",
    "index.html": "<title>package-name-app</title>\n",
    "src/app/layout.route.tsx":
      'export const metadata: Metadata = { title: "FSD Next.js Starter" };\n',
  });

  try {
    assert.throws(
      () =>
        assertProjectIdentity(root, {
          projectName: "package-name-app",
          templateIdentity: ["FSD Next.js Starter"],
        }),
      /metadata title is "FSD Next\.js Starter"/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a template name left outside a title slot fails the leftover check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "package-name-app", private: true })}\n`,
    "README.md": "# package-name-app\n\nBuilt from fsd-architecture-starter.\n",
  });

  try {
    assert.throws(
      () =>
        assertProjectIdentity(root, {
          projectName: "package-name-app",
          templateIdentity: ["fsd-architecture-starter"],
        }),
      /"fsd-architecture-starter" is still present in README\.md/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a SvelteKit project with its own title passes the identity check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "package-name-app", private: true })}\n`,
    "README.md": "# package-name-app\n",
    "src/routes/+layout.svelte":
      `<svelte:head>\n  <title>package-name-app</title>\n</svelte:head>\n`,
  });

  try {
    const checks = assertProjectIdentity(root, {
      projectName: "package-name-app",
      templateIdentity: ["FSD CLI · SvelteKit"],
    });
    assert.ok(checks.includes("SvelteKit document title"));
    assert.ok(checks.includes("no template identity left"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a SvelteKit project that keeps the template title fails the check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "package-name-app", private: true })}\n`,
    "README.md": "# package-name-app\n",
    "src/routes/+layout.svelte":
      `<svelte:head>\n  <title>FSD CLI · SvelteKit</title>\n</svelte:head>\n`,
  });

  try {
    assert.throws(
      () =>
        assertProjectIdentity(root, {
          projectName: "package-name-app",
          templateIdentity: ["FSD CLI · SvelteKit"],
        }),
      /SvelteKit document title is "FSD CLI · SvelteKit"/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a project that keeps the template version fails the version check", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({
      name: "package-name-app",
      private: true,
      version: "0.0.0",
    })}\n`,
    "README.md": "# package-name-app\n",
  });

  try {
    assert.throws(
      () =>
        assertProjectIdentity(root, {
          projectName: "package-name-app",
          templateIdentity: [],
        }),
      /still carries the template version/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
