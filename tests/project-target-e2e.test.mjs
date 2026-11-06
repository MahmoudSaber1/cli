import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Regression net for the project-target work: commands that automated the
// CLI before targets existed must behave exactly as before, with the
// project target resolved to Web under --yes and never prompted for.

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = path.join(root, "bin/index.mjs");

function runCli(t, args) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fsd-target-e2e-")));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: "utf8" });
  return { ...result, output: `${result.stdout}\n${result.stderr}`, cwd };
}

test("the legacy --yes --framework command plans a Web project, unchanged", (t) => {
  const result = runCli(t, ["app", "--framework", "react-vite", "--yes", "--dry-run"]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Template: React \+ Vite/);
  assert.match(result.output, /Project target: Web \(web\)/);
  assert.match(result.output, /No files were changed for app\./);
  assert.equal(fs.existsSync(path.join(result.cwd, "app")), false);
});

test("--monorepo resolves the target in non-interactive runs too", (t) => {
  const result = runCli(t, [
    "app",
    "--framework",
    "react-vite",
    "--yes",
    "--monorepo",
    "--dry-run",
  ]);

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Project target: Multi-web \(multi-web\)/);
});

test("--yes never overrides an explicit target it cannot serve", (t) => {
  const result = runCli(t, [
    "app",
    "--framework",
    "react-vite",
    "--yes",
    "--target",
    "mobile",
    "--dry-run",
  ]);

  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /React \+ Vite does not support the Mobile target\./);
  assert.equal(fs.existsSync(path.join(result.cwd, "app")), false);
});
