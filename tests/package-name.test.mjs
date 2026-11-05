import assert from "node:assert/strict";
import test from "node:test";
import { inspectPackageName, toPackageName } from "../bin/core/package-name.mjs";

test("toPackageName converts the documented project names into valid npm names", () => {
  assert.equal(toPackageName("MyApp").name, "myapp");
  assert.equal(toPackageName("my app").name, "my-app");
  assert.equal(toPackageName("_x").name, "x");
  assert.equal(toPackageName("apps/web").name, "web");
  assert.equal(toPackageName("@scope/x").name, "@scope/x");
  assert.equal(toPackageName("http").name, "http-app");
});

test("toPackageName reports whether the given name was already valid", () => {
  assert.equal(toPackageName("my-app").valid, true);
  assert.equal(toPackageName("my-app").changed, false);
  assert.deepEqual(toPackageName("my-app").issues, []);

  assert.equal(toPackageName("MyApp").valid, false);
  assert.equal(toPackageName("MyApp").changed, true);
  assert.equal(toPackageName("@scope/x").valid, true);
  assert.equal(toPackageName("@scope/x").changed, false);
});

test("toPackageName returns an already valid name exactly as typed", () => {
  for (const name of ["my--app", "my..app", "app-"]) {
    const result = toPackageName(name);
    assert.equal(result.name, name);
    assert.equal(result.valid, true);
    assert.equal(result.changed, false);
    assert.deepEqual(result.issues, []);
  }
});

test("toPackageName explains every change it applies", () => {
  assert.deepEqual(toPackageName("MyApp").issues, ["the name is lowercased"]);
  assert.deepEqual(toPackageName("my app").issues, [
    "unsupported characters become dashes",
  ]);
  assert.deepEqual(toPackageName("_x").issues, [
    "a leading dot, dash or underscore is not allowed",
  ]);
  assert.deepEqual(toPackageName("apps/web").issues, [
    "only the last path segment is used as the package name",
  ]);
  assert.match(toPackageName("http").issues[0], /core module name/);
});

test("toPackageName keeps scoped names scoped", () => {
  assert.equal(toPackageName("@scope/x").name, "@scope/x");
  assert.equal(toPackageName("@my scope/x").name, "@my-scope/x");
  assert.equal(toPackageName("apps/@scope/x").name, "x");
});

test("toPackageName avoids Node.js core module names", () => {
  assert.equal(toPackageName("http").name, "http-app");
  assert.equal(toPackageName("fs").name, "fs-app");
  assert.equal(toPackageName("path").name, "path-app");
});

test("toPackageName falls back when no usable characters remain", () => {
  assert.equal(toPackageName("_").name, "app");
  assert.match(toPackageName("_").issues[0], /no usable characters/);
});

test("toPackageName shortens names longer than the npm limit", () => {
  const name = toPackageName("a".repeat(300)).name;
  assert.equal(name.length, 214);
  assert.match(toPackageName("a".repeat(300)).issues[0], /shortened/);
});

test("toPackageName rejects input without a usable name", () => {
  assert.throws(() => toPackageName(""), /project name is required/i);
  assert.throws(() => toPackageName("   "), /project name is required/i);
  assert.throws(() => toPackageName("@scope"), /not a scoped package name/);
});

test("inspectPackageName reports npm validity without changing anything", () => {
  assert.equal(inspectPackageName("my-app").valid, true);
  assert.equal(inspectPackageName("MyApp").valid, false);
  assert.match(inspectPackageName("MyApp").warnings.join(" "), /capital letters/);
  assert.equal(inspectPackageName("").valid, false);
});
