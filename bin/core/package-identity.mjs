import fs from "fs";
import path from "path";

// bun.lock is a JSONC file: it allows trailing commas, so it cannot be parsed
// with JSON.parse and it must not be rewritten with JSON.stringify. The root
// workspace name is therefore replaced in place.
function findRootWorkspaceRange(source) {
  const workspacesIndex = source.indexOf('"workspaces"');
  if (workspacesIndex === -1) return null;

  const rootKeyIndex = source.indexOf('""', workspacesIndex);
  if (rootKeyIndex === -1) return null;

  const openBrace = source.indexOf("{", rootKeyIndex);
  if (openBrace === -1) return null;

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      // Skip string literals so that a brace inside a value cannot end the
      // workspace entry early.
      index += 1;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === "\\") index += 1;
        index += 1;
      }
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return { start: openBrace, end: index };
    }
  }

  return null;
}

function replaceRootWorkspaceName(source, packageName) {
  const range = findRootWorkspaceRange(source);
  if (!range) return null;

  const entry = source.slice(range.start, range.end);
  const nameIndex = entry.indexOf('"name"');
  if (nameIndex === -1) return null;

  const colonIndex = entry.indexOf(":", nameIndex);
  if (colonIndex === -1) return null;

  const valueStart = entry.indexOf('"', colonIndex);
  if (valueStart === -1) return null;

  let valueEnd = valueStart + 1;
  while (valueEnd < entry.length && entry[valueEnd] !== '"') {
    if (entry[valueEnd] === "\\") valueEnd += 1;
    valueEnd += 1;
  }
  if (valueEnd >= entry.length) return null;

  const updatedEntry =
    entry.slice(0, valueStart) + JSON.stringify(packageName) + entry.slice(valueEnd + 1);
  return source.slice(0, range.start) + updatedEntry + source.slice(range.end);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function applyPackageJson(targetDir, packageName) {
  const packageJsonPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("The template does not contain a package.json.");
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const {
    name: _name,
    private: _private,
    version: _version,
    ...rest
  } = packageJson;

  // The generated project is private and carries no version: the template
  // version belongs to the template, not to the generated application.
  writeJson(packageJsonPath, { name: packageName, private: true, ...rest });
  return packageJson.name ?? null;
}

function applyPackageLock(targetDir, packageName) {
  const lockPath = path.join(targetDir, "package-lock.json");
  if (!fs.existsSync(lockPath)) return;

  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.name = packageName;
  delete lock.version;

  const root = lock.packages?.[""];
  if (root) {
    root.name = packageName;
    delete root.version;
  }

  writeJson(lockPath, lock);
}

function applyBunLock(targetDir, packageName) {
  const lockPath = path.join(targetDir, "bun.lock");
  if (!fs.existsSync(lockPath)) return;

  const source = fs.readFileSync(lockPath, "utf8");
  const updated = replaceRootWorkspaceName(source, packageName);
  if (updated === null) return;
  fs.writeFileSync(lockPath, updated);
}

/**
 * Writes the generated project's own identity into the files the template
 * ships: `package.json`, the npm lockfile and the bun lockfile.
 *
 * @param {string} targetDir the generated project directory
 * @param {string} packageName the normalized npm package name
 * @returns {{templateName: string|null, packageName: string}}
 */
export function applyPackageIdentity(targetDir, packageName) {
  if (!packageName) {
    throw new Error("A package name is required to identify the project.");
  }

  const templateName = applyPackageJson(targetDir, packageName);
  applyPackageLock(targetDir, packageName);
  applyBunLock(targetDir, packageName);

  return { templateName, packageName };
}
