import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CliUsageError, parseCliArgs } from "../bin/cli/args.mjs";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
).version;

test("CLI parser keeps legacy creation and generation syntax", () => {
  assert.deepEqual(parseCliArgs(["shop"]), {
    command: "create",
    projectName: "shop",
    framework: undefined,
    target: undefined,
    monorepo: false,
    mobile: false,
    packageManager: undefined,
    packageName: undefined,
    apiClient: undefined,
    serverState: undefined,
    clientState: undefined,
    forms: undefined,
    yes: false,
    noInstall: false,
    noStart: false,
    dryRun: false,
    force: false,
  });
  assert.deepEqual(parseCliArgs(["-g", "feature", "auth", "--force"]), {
    command: "generate",
    type: "feature",
    name: "auth",
    force: true,
    dryRun: false,
  });
});

test("CLI parser supports automation-friendly create flags", () => {
  assert.deepEqual(
    parseCliArgs([
      "shop",
      "--framework=nextjs",
      "--yes",
      "--no-install",
      "--no-start",
    ]),
    {
      command: "create",
      projectName: "shop",
      framework: "nextjs",
      target: undefined,
      monorepo: false,
      mobile: false,
      packageManager: undefined,
      packageName: undefined,
      apiClient: undefined,
      serverState: undefined,
      clientState: undefined,
      forms: undefined,
      yes: true,
      noInstall: true,
      noStart: true,
      dryRun: false,
      force: false,
    }
  );
  assert.throws(() => parseCliArgs(["--yes"]), CliUsageError);
  assert.throws(() => parseCliArgs(["shop", "--unknown"]), /Unknown option/);
  assert.deepEqual(
    parseCliArgs(["--generate", "entity", "product", "customer"]).names,
    ["product", "customer"]
  );
});

test("CLI parser resolves the project target flags", () => {
  assert.equal(parseCliArgs(["shop", "--target", "web"]).target, "web");
  assert.equal(parseCliArgs(["shop", "--target=web"]).target, "web");
  assert.equal(parseCliArgs(["shop"]).target, undefined);
});

test("CLI parser rejects targets that are not available yet", () => {
  // Multi-web, mobile and universal are valid selections whose support
  // has not landed: every spelling of them fails fast, with the reason,
  // instead of creating a web project under a different name.
  assert.throws(
    () => parseCliArgs(["shop", "--monorepo"]),
    /The Multi-web project target is not available yet/
  );
  assert.throws(
    () => parseCliArgs(["shop", "--mobile"]),
    /The Mobile project target is not available yet/
  );
  assert.throws(
    () => parseCliArgs(["shop", "--target", "universal"]),
    /The Universal project target is not available yet/
  );
  assert.throws(() => parseCliArgs(["shop", "--target", "mobile", "--mobile"]), CliUsageError);
  assert.throws(
    () => parseCliArgs(["shop", "--target", "multi-web", "--monorepo"]),
    CliUsageError
  );
});

test("CLI parser rejects invalid or conflicting target flags", () => {
  assert.throws(() => parseCliArgs(["shop", "--target", "desktop"]), CliUsageError);
  assert.throws(
    () => parseCliArgs(["shop", "--target", "desktop"]),
    /--target supports only web, multi-web, mobile, universal \(received "desktop"\)\./
  );
  assert.throws(() => parseCliArgs(["shop", "--target"]), /--target requires a value\./);
  assert.throws(
    () => parseCliArgs(["shop", "--monorepo", "--mobile"]),
    /--monorepo and --mobile cannot be combined\./
  );
  assert.throws(
    () => parseCliArgs(["shop", "--target", "web", "--mobile"]),
    /--target web conflicts with --mobile \(which selects mobile\)\./
  );
  assert.throws(
    () => parseCliArgs(["shop", "--target", "mobile", "--monorepo"]),
    CliUsageError
  );
});

test("CLI parser exposes dry-run, safe replacement, and inspection commands", () => {
  assert.deepEqual(
    parseCliArgs(["shop", "--framework", "vue-vite", "--yes", "--dry-run", "--force"]),
    {
      command: "create",
      projectName: "shop",
      framework: "vue-vite",
      target: undefined,
      monorepo: false,
      mobile: false,
      packageManager: undefined,
      packageName: undefined,
      apiClient: undefined,
      serverState: undefined,
      clientState: undefined,
      forms: undefined,
      yes: true,
      noInstall: false,
      noStart: false,
      dryRun: true,
      force: true,
    }
  );
  assert.deepEqual(parseCliArgs(["-g", "page", "settings", "--dry-run"]), {
    command: "generate",
    type: "page",
    name: "settings",
    force: false,
    dryRun: true,
  });
  assert.deepEqual(parseCliArgs(["doctor"]), { command: "doctor" });
  assert.throws(() => parseCliArgs(["doctor", "extra"]), /Unexpected argument/);
});

test("CLI parser accepts explicit stack choices for repeatable E2E creation", () => {
  const command = parseCliArgs([
    "shop",
    "--framework",
    "react-vite",
    "--package-manager",
    "pnpm",
    "--api-client",
    "fetch",
    "--server-state",
    "none",
    "--client-state",
    "redux",
    "--forms",
    "none",
    "--yes",
  ]);
  assert.equal(command.packageManager, "pnpm");
  assert.equal(command.apiClient, "fetch");
  assert.equal(command.serverState, "none");
  assert.equal(command.clientState, "redux");
  assert.equal(command.forms, "none");
});

test("--yes resolves defaults from the selected framework", () => {
  const react = createDefaultProjectConfig("react-vite");
  const vue = createDefaultProjectConfig("vue-vite");
  const nuxt = createDefaultProjectConfig("nuxt");
  const sveltekit = createDefaultProjectConfig("sveltekit");
  assert.equal(react.serverState, "react-query");
  assert.equal(react.clientState, "zustand");
  assert.equal(vue.serverState, "vue-query");
  assert.equal(vue.clientState, "pinia");
  assert.equal(vue.forms, "vee-validate-zod");
  assert.equal(nuxt.apiClient, "fetch");
  assert.equal(nuxt.serverState, "vue-query");
  assert.equal(sveltekit.apiClient, "fetch");
  assert.equal(sveltekit.serverState, "svelte-query");
  assert.equal(sveltekit.clientState, "svelte-store");
  assert.equal(sveltekit.forms, "sveltekit-superforms-zod");
});

test("CLI exposes version, help, and template discovery without prompts", () => {
  const run = (...args) =>
    execFileSync(process.execPath, ["bin/index.mjs", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

  assert.equal(run("--version").trim(), packageVersion);
  const help = run("--help");
  assert.match(help, /--list-templates/);
  const donationLines = help
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Buy Me a Coffee:"));
  assert.equal(donationLines.length, 1);
  assert.equal(
    donationLines[0],
    "Buy Me a Coffee: https://buymeacoffee.com/ashrafqopiah"
  );
  assert.ok(help.includes("InstaPay (Egypt): ashrafmo-1"));
  const templates = run("--list-templates");
  assert.match(templates, /react-vite\s+stable/);
  assert.match(templates, /vue-vite\s+stable/);
  assert.match(templates, /nuxt\s+stable/);
  assert.match(templates, /sveltekit\s+stable/);
});

test("CLI fails before cloning an unknown framework", () => {
  const result = spawnSync(
    process.execPath,
    ["bin/index.mjs", "shop", "--framework", "unknown", "--yes", "--no-install"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown framework/);
});

test("project dry-run prints the plan without cloning a template", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-create-plan-"));
  try {
    const output = execFileSync(
      process.execPath,
      [
        path.join(repoRoot, "bin/index.mjs"),
        "preview-app",
        "--framework",
        "vue-vite",
        "--yes",
        "--dry-run",
      ],
      { cwd, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } }
    );
    assert.match(output, /Project plan \(dry run\)/);
    assert.match(output, /Vue \+ Vite/);
    assert.equal(fs.existsSync(path.join(cwd, "preview-app")), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
