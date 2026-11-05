import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyTemplateIdentity } from "../bin/core/template-identity.mjs";

function createProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-template-identity-"));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(root, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return root;
}

test("the README title no longer carries the template name", () => {
  const root = createProject({
    "README.md": `# FSD Architecture Starter\n\nAn opinionated React starter.\n\n## Support FSD CLI\n`,
  });

  try {
    const result = applyTemplateIdentity(root, "my-app");
    assert.deepEqual(result.changed, ["README.md"]);
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /^# my-app$/m);
    assert.doesNotMatch(readme, /FSD Architecture Starter/);
    // Only the title is rewritten.
    assert.match(readme, /## Support FSD CLI/);
    assert.match(readme, /An opinionated React starter\./);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the document title no longer carries the template name", () => {
  const root = createProject({
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>FSD Architecture Starter</title>
  </head>
  <body></body>
</html>
`,
  });

  try {
    const result = applyTemplateIdentity(root, "my-app");
    assert.deepEqual(result.changed, ["index.html"]);
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    assert.match(html, /<title>my-app<\/title>/);
    assert.doesNotMatch(html, /FSD Architecture Starter/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the Vue document title is replaced even when it names the product", () => {
  const root = createProject({
    "index.html": `<title>FSD CLI — Vue + Vite</title>\n`,
  });

  try {
    applyTemplateIdentity(root, "my-app");
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    assert.equal(html.trim(), "<title>my-app</title>");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the Angular project name no longer carries the template name", () => {
  const root = createProject({
    "angular.json": `${JSON.stringify(
      {
        version: 1,
        projects: {
          "fsd-angular-starter": {
            projectType: "application",
            root: "",
            sourceRoot: "src",
            projectName: "fsd-angular-starter",
          },
        },
      },
      null,
      2
    )}\n`,
  });

  try {
    const result = applyTemplateIdentity(root, "my-app");
    assert.deepEqual(result.changed, ["angular.json"]);
    const angularJson = JSON.parse(
      fs.readFileSync(path.join(root, "angular.json"), "utf8")
    );
    assert.equal(
      angularJson.projects["fsd-angular-starter"].projectName,
      "my-app"
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the Next.js metadata title no longer carries the template name", () => {
  const root = createProject({
    "src/app/layout.route.tsx": `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FSD Next.js Starter",
  description: "A complete Feature-Sliced Design starter for Next.js",
};

export default function RootLayout() {
  return null;
}
`,
  });

  try {
    const result = applyTemplateIdentity(root, "my-app");
    assert.deepEqual(result.changed, ["src/app/layout.route.tsx"]);
    const layout = fs.readFileSync(
      path.join(root, "src/app/layout.route.tsx"),
      "utf8"
    );
    assert.match(layout, /title: "my-app"/);
    assert.doesNotMatch(layout, /FSD Next\.js Starter/);
    assert.match(layout, /description: "A complete Feature-Sliced Design starter for Next\.js"/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the SvelteKit document title no longer carries the template name", () => {
  const root = createProject({
    "src/routes/+layout.svelte": `<script lang="ts">
  import "../app.css";
</script>

<svelte:head>
  <title>FSD CLI · SvelteKit</title>
</svelte:head>

<slot />
`,
  });

  try {
    const result = applyTemplateIdentity(root, "my-app");
    assert.deepEqual(result.changed, ["src/routes/+layout.svelte"]);
    const layout = fs.readFileSync(
      path.join(root, "src/routes/+layout.svelte"),
      "utf8"
    );
    assert.match(layout, /<title>my-app<\/title>/);
    assert.doesNotMatch(layout, /FSD CLI · SvelteKit/);
    // Only the title is rewritten.
    assert.match(layout, /<slot \/>/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a nested project name uses its last path segment as the title", () => {
  const root = createProject({
    "README.md": `# FSD Nuxt Starter\n`,
  });

  try {
    const result = applyTemplateIdentity(root, "apps/web");
    assert.equal(result.title, "web");
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.equal(readme.trim(), "# web");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a project without the template files is left alone", () => {
  const root = createProject({
    "package.json": `${JSON.stringify({ name: "my-app" })}\n`,
  });

  try {
    const result = applyTemplateIdentity(root, "my-app");
    assert.deepEqual(result.changed, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
