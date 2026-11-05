import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { ensureHuskyHooks } from "../bin/core/project-lifecycle.mjs";
import { createDefaultProjectConfig, getProjectQuestions } from "../bin/commands/create-project.mjs";
import { viewContent } from "../bin/generators/shared.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));
const loaderPath = fileURLToPath(new URL("./fixtures/local-template-loader.mjs", import.meta.url));
const loaderUrl = pathToFileURL(loaderPath).href;
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-qa-regression-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
function executable(file, posixSource, windowsSource) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/bin/sh\n${posixSource}\n`, { mode: 0o755 });
  // Windows cmd.exe resolves package-manager shims via PATHEXT (.cmd/.bat),
  // so a POSIX-only shim would be ignored and the real installer would run.
  // Always write a .cmd companion that reaches the same controlled outcome.
  const batch = windowsSource ?? "@echo off\r\nexit /b 0";
  fs.writeFileSync(`${file}.cmd`, `${batch}\r\n`);
}

test("--yes without a framework fails before prompting or replacing a directory", t => {
  const cwd = fixture(t);
  fs.mkdirSync(path.join(cwd, "app"));
  fs.writeFileSync(path.join(cwd, "app", "sentinel"), "original");
  const result = spawnSync(process.execPath, [cli, "app", "--yes", "--force"], {
    cwd, encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--framework is required/);
  assert.doesNotMatch(result.stdout, /Select framework/);
  assert.equal(fs.readFileSync(path.join(cwd, "app", "sentinel"), "utf8"), "original");
});

for (const framework of ["react-vite", "nextjs", "vue-vite", "nuxt", "sveltekit"]) {
  test(`${framework} interactive preselection matches unattended defaults`, () => {
    const defaults = createDefaultProjectConfig(framework);
    for (const question of getProjectQuestions(framework)) {
      assert.equal(question.choices[question.initial]?.value, defaults[question.name]);
    }
  });
  test(`${framework} numeric slice names are rejected before any write, including force`, t => {
    const cwd = fixture(t);
    const config = JSON.stringify(createDefaultProjectConfig(framework));
    fs.writeFileSync(path.join(cwd, "fsd.config.json"), config);
    for (const type of ["feature", "entity", "widget", "page"]) {
      for (const flag of ["--force", "--dry-run"]) {
        const result = spawnSync(process.execPath, [cli, "-g", type, "123start", flag], {
          cwd, encoding: "utf8", timeout: 5000,
        });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /must start with a letter/);
        assert.deepEqual(fs.readdirSync(cwd), ["fsd.config.json"]);
        assert.equal(fs.readFileSync(path.join(cwd, "fsd.config.json"), "utf8"), config);
      }
    }
  });
}

test("generic view signatures respect the template formatter line width", () => {
  assert.match(viewContent("CheckoutView", "Checkout feature"), /CheckoutView\(\{\n  title = "Checkout feature",\n\}: CheckoutViewProps\)/);
  assert.match(viewContent("CartSummary", "Cart Summary widget"), /CartSummary\(\{\n/);
  assert.match(viewContent("X", "X"), /function X\(\{ title = "X" \}: XProps\)/);
});

for (const force of [false, true]) {
  test(`failed installation exits nonzero and rolls back (force=${force})`, t => {
    const cwd = fixture(t);
    const target = path.join(cwd, "app");
    if (force) {
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "original.txt"), "original bytes\n");
    }
    executable(
      path.join(cwd, "tools", "npm"),
      'echo "QA install failure: approval required" >&2\nexit 42',
      '@echo off\necho QA install failure: approval required 1>&2\nexit /b 42'
    );
    const result = spawnSync(process.execPath, [
      "--experimental-loader", loaderUrl, cli, "app", "--framework", "react-vite",
      "--yes", "--no-start", ...(force ? ["--force"] : []),
    ], { cwd, encoding: "utf8", timeout: 15000, env: {
      ...process.env, PATH: `${path.join(cwd, "tools")}${path.delimiter}${process.env.PATH}`,
    } });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /QA install failure: approval required/);
    assert.match(result.stderr, /rolled back/);
    assert.doesNotMatch(result.stdout, /Project created successfully/);
    if (force) {
      assert.deepEqual(fs.readdirSync(target), ["original.txt"]);
      assert.equal(fs.readFileSync(path.join(target, "original.txt"), "utf8"), "original bytes\n");
    } else assert.equal(fs.existsSync(target), false);
    assert.equal(fs.readdirSync(cwd).some(n => n.includes("fsd-cli-backup")), false);
  });
}

test("intentional no-install remains successful and does not execute installer", t => {
  const cwd = fixture(t);
  executable(
    path.join(cwd, "tools", "npm"),
    "touch installer-was-called\nexit 42",
    "@echo off\necho called > installer-was-called\nexit /b 42"
  );
  const result = spawnSync(process.execPath, ["--experimental-loader", loaderUrl, cli,
    "app", "--framework", "react-vite", "--yes", "--no-install", "--no-start"], {
    cwd, encoding: "utf8", timeout: 15000,
    env: { ...process.env, PATH: `${path.join(cwd, "tools")}${path.delimiter}${process.env.PATH}` },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Project created successfully/);
  assert.ok(fs.existsSync(path.join(cwd, "app", "fsd.config.json")));
  assert.equal(fs.existsSync(path.join(cwd, "app", "installer-was-called")), false);
});

for (const pm of ["npm", "pnpm", "yarn", "bun"]) {
  test(`${pm} hooks block opted-in lint/build and whitespace failures while defaults stay light`, t => {
    const cwd = fixture(t);
    const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" });
    git("init");
    git("config", "user.name", "FSD Test");
    git("config", "user.email", "fsd-test@example.invalid");
    git("config", "commit.gpgsign", "false");
    git("config", "core.hooksPath", ".husky");
    ensureHuskyHooks(cwd, pm);
    const tools = path.join(cwd, "tools");
    const trace = path.join(cwd, "trace");
    executable(
      path.join(tools, pm),
      `echo "$*" >> "$QA_TRACE"
case " $* " in
  *" lint "*) exit "${'$'}{QA_LINT_EXIT:-0}" ;;
  *" build "*) exit "${'$'}{QA_BUILD_EXIT:-0}" ;;
esac
exit 0`,
      `@echo off
echo %*>>"%QA_TRACE%"
echo  %*  | findstr /C:" lint " >nul
if %errorlevel%==0 (
  if "%QA_LINT_EXIT%"=="" exit /b 0
  exit /b %QA_LINT_EXIT%
)
echo  %*  | findstr /C:" build " >nul
if %errorlevel%==0 (
  if "%QA_BUILD_EXIT%"=="" exit /b 0
  exit /b %QA_BUILD_EXIT%
)
exit /b 0`
    );
    executable(path.join(tools, "bunx"), "exit 0", "@echo off\nexit /b 0");
    executable(path.join(cwd, "node_modules", ".bin", "commitlint"), "exit 0", "@echo off\nexit /b 0");
    fs.writeFileSync(path.join(cwd, "sample.txt"), "clean\n");
    git("add", "sample.txt");
    const commit = extra => spawnSync("git", ["commit", "-m", "test: validate hook"], {
      cwd, encoding: "utf8", timeout: 10000,
      env: { ...process.env, HUSKY: "1", PATH: `${tools}${path.delimiter}${process.env.PATH}`, QA_TRACE: trace, ...extra },
    });
    let result = commit({ QA_LINT_EXIT: "23", FSD_PRE_COMMIT_LINT: "1" });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(fs.readFileSync(trace, "utf8"), /build/);
    fs.writeFileSync(path.join(cwd, "sample.txt"), "trailing space \n");
    git("add", "sample.txt");
    result = commit({});
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /trailing whitespace/);
    fs.writeFileSync(path.join(cwd, "sample.txt"), "clean\n");
    git("add", "sample.txt");
    result = commit({});
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(git("log", "-1", "--format=%s"), /test: validate hook/);
    const remote = path.join(cwd, "remote.git");
    git("init", "--bare", remote);
    git("remote", "add", "origin", remote);
    const push = extra => spawnSync("git", ["push", "origin", "HEAD:refs/heads/test"], {
      cwd, encoding: "utf8", timeout: 10000,
      env: { ...process.env, HUSKY: "1", PATH: `${tools}${path.delimiter}${process.env.PATH}`, QA_TRACE: trace, ...extra },
    });
    assert.notEqual(push({ QA_BUILD_EXIT: "24", FSD_PRE_PUSH_CHECKS: "1" }).status, 0);
    result = push({ QA_BUILD_EXIT: "24", FSD_PRE_PUSH_CHECKS: "0" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
