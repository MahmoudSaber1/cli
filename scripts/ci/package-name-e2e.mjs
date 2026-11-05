// Package name E2E: create a project from every stable template and prove
// that the project carries its own identity instead of the template's.
//
//   package.json name/private/version -> the project's own name
//   lockfile name fields               -> the project's own name
//   README and document titles         -> the project's own name
//   no template identity               -> the template's own strings are gone
//
// The template identity is read from the pinned template commit, so the check
// does not depend on a hardcoded list of template names.
// Usage: node scripts/ci/package-name-e2e.mjs [framework...]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getTemplate } from "../../bin/core/template-registry.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(repoRoot, "bin", "index.mjs");
const PROJECT_NAME = "package-name-app";

// The SvelteKit document title lives in the root layout, not in an
// index.html, so it needs its own slot in every identity check below.
const SVELTEKIT_LAYOUT_PATH = "src/routes/+layout.svelte";

const IDENTITY_FILES = [
  "package.json",
  "package-lock.json",
  "README.md",
  "index.html",
  "src/app/layout.route.tsx",
  "src/app/layout.tsx",
  "app/layout.route.tsx",
  "app/layout.tsx",
  "angular.json",
  SVELTEKIT_LAYOUT_PATH,
];

function readIdentityString(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Collects the strings that identify a template: its package name and the
 * titles it ships with.
 */
export function collectTemplateIdentity(files) {
  const identity = [];

  const packageJson = files.get("package.json");
  if (packageJson) {
    const name = readIdentityString(packageJson, /"name"\s*:\s*"([^"]*)"/);
    if (name) identity.push(name);
  }

  const readme = files.get("README.md");
  if (readme) {
    const title = readIdentityString(readme, /^#\s+(.+)$/m);
    if (title) identity.push(title);
  }

  const html = files.get("index.html");
  if (html) {
    const title = readIdentityString(html, /<title>([\s\S]*?)<\/title>/);
    if (title) identity.push(title);
  }

  const svelteLayout = files.get(SVELTEKIT_LAYOUT_PATH);
  if (svelteLayout) {
    const title = readIdentityString(
      svelteLayout,
      /<title>([\s\S]*?)<\/title>/
    );
    if (title) identity.push(title);
  }

  return [...new Set(identity.filter(Boolean))];
}

/**
 * Asserts that a created project carries its own identity and none of the
 * template's.
 *
 * @param {string} projectDir the created project
 * @param {{projectName: string, templateIdentity: string[]}} expectations
 * @returns {string[]} the checks that passed
 */
export function assertProjectIdentity(projectDir, expectations) {
  const checks = [];
  const fail = (message) => {
    throw new Error(message);
  };

  const packageJsonPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    fail("the project has no package.json");
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  if (packageJson.name !== expectations.projectName) {
    fail(
      `package.json name is "${packageJson.name}", expected "${expectations.projectName}"`
    );
  }
  checks.push("package.json name");

  if (packageJson.private !== true) {
    fail("package.json is not private");
  }
  checks.push("package.json private");

  if ("version" in packageJson) {
    fail(`package.json still carries the template version "${packageJson.version}"`);
  }
  checks.push("package.json version removed");

  const lockPath = path.join(projectDir, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (lock.name !== expectations.projectName) {
      fail(
        `package-lock.json name is "${lock.name}", expected "${expectations.projectName}"`
      );
    }
    if (lock.packages?.[""] && lock.packages[""].name !== expectations.projectName) {
      fail(
        `package-lock.json root name is "${lock.packages[""].name}", expected "${expectations.projectName}"`
      );
    }
    if ("version" in lock || "version" in (lock.packages?.[""] ?? {})) {
      fail("package-lock.json still carries the template version");
    }
    checks.push("package-lock.json name");
  }

  const readmePath = path.join(projectDir, "README.md");
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, "utf8");
    const title = readIdentityString(readme, /^#\s+(.+)$/m);
    if (title !== expectations.projectName) {
      fail(`README title is "${title}", expected "${expectations.projectName}"`);
    }
    checks.push("README title");
  }

  const htmlPath = path.join(projectDir, "index.html");
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const title = readIdentityString(html, /<title>([\s\S]*?)<\/title>/);
    if (title !== expectations.projectName) {
      fail(`document title is "${title}", expected "${expectations.projectName}"`);
    }
    checks.push("document title");
  }

  const svelteLayoutPath = path.join(projectDir, SVELTEKIT_LAYOUT_PATH);
  if (fs.existsSync(svelteLayoutPath)) {
    const layout = fs.readFileSync(svelteLayoutPath, "utf8");
    const title = readIdentityString(layout, /<title>([\s\S]*?)<\/title>/);
    if (title !== expectations.projectName) {
      fail(
        `SvelteKit document title is "${title}", expected "${expectations.projectName}"`
      );
    }
    checks.push("SvelteKit document title");
  }

  for (const layoutPath of [
    "src/app/layout.route.tsx",
    "src/app/layout.tsx",
    "app/layout.route.tsx",
    "app/layout.tsx",
  ]) {
    const layoutFile = path.join(projectDir, layoutPath);
    if (!fs.existsSync(layoutFile)) continue;
    const layout = fs.readFileSync(layoutFile, "utf8");
    const metadataIndex = layout.indexOf("export const metadata");
    if (metadataIndex === -1) continue;
    const title = readIdentityString(
      layout.slice(metadataIndex),
      /title\s*:\s*"([^"]*)"/
    );
    if (title !== expectations.projectName) {
      fail(`metadata title is "${title}", expected "${expectations.projectName}"`);
    }
    checks.push(`${layoutPath} title`);
  }

  for (const relativePath of IDENTITY_FILES) {
    const filePath = path.join(projectDir, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const leftover of expectations.templateIdentity) {
      if (content.includes(leftover)) {
        fail(`"${leftover}" is still present in ${relativePath}`);
      }
    }
  }
  checks.push("no template identity left");

  return checks;
}

function gitTemplateFiles(template) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-template-identity-"));
  const files = new Map();
  try {
    const run = (args) =>
      spawnSync("git", args, { cwd: workspace, encoding: "utf8" });
    run(["init", "--quiet"]);
    const fetched = run([
      "-c",
      "maintenance.auto=false",
      "-c",
      "gc.auto=0",
      "fetch",
      "--depth=1",
      "--no-tags",
      `https://github.com/${template.repo}.git`,
      template.ref,
    ]);
    if (fetched.status !== 0) {
      throw new Error(
        `Cannot read template ${template.repo} at ${template.ref}: ${fetched.stderr}`
      );
    }

    for (const filePath of [
      "package.json",
      "README.md",
      "index.html",
      SVELTEKIT_LAYOUT_PATH,
    ]) {
      const shown = run(["show", `FETCH_HEAD:${filePath}`]);
      if (shown.status === 0) files.set(filePath, shown.stdout);
    }
    return files;
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, HUSKY: "0", CI: "true" },
  });
  if (result.status !== 0) {
    throw new Error(
      `create failed: ${result.stderr || result.stdout || `exit ${result.status}`}`
    );
  }
  return result;
}

export function runPackageNameE2E(frameworks) {
  const reports = [];

  for (const framework of frameworks) {
    const template = getTemplate(framework);
    const report = { framework, steps: [] };

    try {
      const templateIdentity = collectTemplateIdentity(gitTemplateFiles(template));
      report.templateIdentity = templateIdentity;
      report.steps.push({ name: "template identity", detail: templateIdentity.join(", ") });

      const workspace = fs.mkdtempSync(path.join(os.tmpdir(), `fsd-package-name-${framework}-`));
      try {
        runCli(
          [
            PROJECT_NAME,
            "--framework",
            framework,
            "--package-manager",
            "npm",
            "--yes",
            "--no-install",
            "--no-start",
          ],
          workspace
        );

        const projectDir = path.join(workspace, PROJECT_NAME);
        const checks = assertProjectIdentity(projectDir, {
          projectName: PROJECT_NAME,
          templateIdentity,
        });
        report.checks = checks;
        report.steps.push({ name: "project identity", detail: checks.join(", ") });
        report.result = "pass";
        console.log(`\n✔ ${framework}: ${checks.join(", ")}`);
      } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
      }
    } catch (error) {
      report.result = "fail";
      report.error = error.message;
      console.error(`\n✖ ${framework}: ${error.message}`);
    }

    reports.push(report);
  }

  return reports;
}

async function main() {
  const requested = process.argv.slice(2);
  const frameworks =
    requested.length > 0
      ? requested
      : ["react-vite", "nextjs", "vue-vite", "nuxt", "sveltekit"];

  const reports = runPackageNameE2E(frameworks);
  const failed = reports.filter((report) => report.result !== "pass");

  const outDir = process.env.CI_ARTIFACTS_DIR ?? path.join(repoRoot, "ci-artifacts");
  fs.mkdirSync(path.join(outDir, "package-name-e2e"), { recursive: true });
  for (const report of reports) {
    const reportPath = path.join(outDir, "package-name-e2e", `${report.framework}.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report: ${reportPath}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  await main();
}
