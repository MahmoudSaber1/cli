import { builtinModules } from "module";
import validateNpmPackageName from "validate-npm-package-name";

const MAX_PACKAGE_NAME_LENGTH = 214;
const FALLBACK_PACKAGE_NAME = "app";
// npm keeps publishing "http" for core module names, so a generated project
// needs a suffix that cannot collide with a Node.js core module.
const CORE_MODULE_SUFFIX = "-app";

// `module.builtinModules` is the authoritative Node.js list. The "node:"
// prefixed duplicates and the private "_" internals are dropped: neither can
// be published on npm, and both are already rejected by the npm name rules.
const CORE_MODULE_NAMES = new Set(
  builtinModules
    .filter((name) => !name.startsWith("node:"))
    .filter((name) => !name.startsWith("_"))
);

function isCoreModuleName(name) {
  return CORE_MODULE_NAMES.has(name);
}

/**
 * Normalizes one path segment into an npm-safe name and reports why it
 * changed, so the CLI can explain the fix to the user.
 */
function sanitizeLeaf(segment) {
  const issues = [];
  let value = segment;

  const lowered = value.toLowerCase();
  if (lowered !== value) {
    issues.push("the name is lowercased");
    value = lowered;
  }

  const replaced = value.replace(/[^a-z0-9._-]+/g, "-");
  if (replaced !== value) {
    issues.push("unsupported characters become dashes");
    value = replaced;
  }

  const collapsed = value.replace(/-{2,}/g, "-");
  value = collapsed;

  const stripped = value.replace(/^[._-]+/, "");
  if (stripped !== value) {
    issues.push("a leading dot, dash or underscore is not allowed");
    value = stripped;
  }

  value = value.replace(/-+$/, "");
  value = value.replace(/\.{2,}/g, ".");

  return { value, issues };
}

function sanitizeScope(scope) {
  const cleaned = scope
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/-+$/, "");
  return cleaned ? `@${cleaned}` : "";
}

/**
 * Converts a project name or project path into a valid npm package name.
 *
 * The rules are the published npm naming rules, enforced with
 * `validate-npm-package-name`:
 *   - the name is lowercase and uses the last path segment;
 *   - spaces and unsupported characters become dashes;
 *   - a leading "." or "_" is removed;
 *   - a name that collides with a Node.js core module is suffixed;
 *   - scoped names ("@scope/name") stay scoped.
 *
 * @param {string} input project name, folder path or scoped package name
 * @returns {{name: string, valid: boolean, changed: boolean, issues: string[]}}
 */
export function toPackageName(input) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    throw new Error("A project name is required to derive a package name.");
  }

  const issues = [];
  let scope = null;
  let body = raw;

  if (raw.startsWith("@")) {
    const separator = raw.indexOf("/");
    if (separator === -1) {
      throw new Error(`"${raw}" is not a scoped package name. Use "@scope/name".`);
    }
    scope = raw.slice(0, separator);
    body = raw.slice(separator + 1);
  }

  const segments = body.split("/").filter((segment) => segment.trim() !== "");
  if (segments.length === 0) {
    throw new Error(
      `"${raw}" does not contain a name to derive a package name from.`
    );
  }
  const segment = segments[segments.length - 1];

  // A name that npm already accepts is returned exactly as typed. The
  // sanitizer below would otherwise rewrite some valid names (collapsing
  // "my--app" to "my-app", "my..app" to "my.app", stripping the trailing
  // dash of "app-") and, because the input counts as valid, the change
  // would be reported nowhere. The result keeps the same shape as the
  // sanitized path below, including the typed last segment as `raw`.
  if (validateNpmPackageName(raw).validForNewPackages) {
    return { name: raw, valid: true, changed: false, raw: segment, issues: [] };
  }

  if (segments.length > 1) {
    issues.push("only the last path segment is used as the package name");
  }

  const sanitized = sanitizeLeaf(segment);
  let leaf = sanitized.value;
  if (leaf) {
    issues.push(...sanitized.issues);
  } else {
    leaf = FALLBACK_PACKAGE_NAME;
    issues.push(
      `the name had no usable characters, so "${FALLBACK_PACKAGE_NAME}" is used`
    );
  }

  // npm only rejects an unscoped name that collides with a Node.js core
  // module, so the suffix is applied to unscoped names only.
  if (scope === null && isCoreModuleName(leaf)) {
    leaf = `${leaf}${CORE_MODULE_SUFFIX}`;
    issues.push(`"${segment}" is a Node.js core module name, so "${leaf}" is used`);
  }

  let scopedScope = "";
  if (scope !== null) {
    scopedScope = sanitizeScope(scope);
    if (!scopedScope) {
      throw new Error(
        `"${raw}" does not contain a usable scope. Use "@scope/name".`
      );
    }
  }

  let name = scopedScope ? `${scopedScope}/${leaf}` : leaf;
  if (name.length > MAX_PACKAGE_NAME_LENGTH) {
    name = name.slice(0, MAX_PACKAGE_NAME_LENGTH);
    issues.push(`the name was shortened to ${MAX_PACKAGE_NAME_LENGTH} characters`);
  }

  const validation = validateNpmPackageName(name);
  if (!validation.validForNewPackages) {
    const reason = [...(validation.errors ?? []), ...(validation.warnings ?? [])].join(
      "; "
    );
    throw new Error(
      `"${raw}" cannot be converted into a valid npm package name${
        reason ? `: ${reason}` : "."
      }`
    );
  }

  const valid = validateNpmPackageName(raw).validForNewPackages;
  if (valid) issues.length = 0;

  return {
    name,
    valid,
    changed: name !== raw,
    raw: segment,
    issues,
  };
}

/**
 * Describes what the CLI has to tell the user about a project name that is a
 * valid folder name but not a valid npm package name.
 *
 * @param {string} input
 * @returns {{valid: boolean, name: string, raw: string, message: string|null}}
 */
export function describePackageNameSuggestion(input) {
  const suggestion = toPackageName(input);
  return {
    valid: suggestion.valid,
    name: suggestion.name,
    raw: suggestion.raw,
    message: suggestion.valid
      ? null
      : `"${input}" is not a valid npm package name (${suggestion.issues.join(
          ", "
        )}). Use "${suggestion.name}" as the package name?`,
  };
}

/**
 * Reports whether a value can be published to npm as it is.
 *
 * @param {string} input
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function inspectPackageName(input) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    return { valid: false, errors: ["the name is empty"], warnings: [] };
  }
  const validation = validateNpmPackageName(raw);
  return {
    valid: validation.validForNewPackages,
    errors: validation.errors ?? [],
    warnings: validation.warnings ?? [],
  };
}
