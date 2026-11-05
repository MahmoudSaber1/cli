# Package naming contract

The generated project must carry the user's name, not the template's. Today a
project created from a template keeps the template's own package name
(`fsd-architecture-starter`, `fsd-nextjs`, `fsd-vue-starter`,
`fsd-nuxt-starter`, `fsd-sveltekit`), so the identity of the template leaks
into every project that uses it.

This document is the contract for the naming rules. The rules live in
`bin/core/package-name.mjs` and are enforced with
[`validate-npm-package-name`](https://www.npmjs.com/package/validate-npm-package-name),
which is the same validator npm itself uses.

## Normalization rules

`toPackageName(input)` converts a project name, a project path or a scoped
package name into a name that can be published to npm.

| Rule | Example | Result |
| --- | --- | --- |
| The name is lowercased | `MyApp` | `myapp` |
| Only the last path segment is used | `apps/web` | `web` |
| Spaces and unsupported characters become dashes | `my app` | `my-app` |
| A leading `.`, `_` or `-` is removed | `_x` | `x` |
| A Node.js core module name is suffixed | `http` | `http-app` |
| Scoped names stay scoped | `@scope/x` | `@scope/x` |
| Names longer than 214 characters are shortened | 300 `a` | 214 `a` |

A name that has no usable characters at all falls back to `app`.

### Why the core module rule exists

npm refuses to publish a new package whose name is a Node.js core module, so
`http`, `fs` and `path` cannot be used as package names. The suffix `-app`
keeps the original intent readable while producing a name that npm accepts.
The rule applies to unscoped names only, because npm accepts a core module
name inside a scope.

## Where the name is written

`applyPackageIdentity(targetDir, packageName)` in
`bin/core/package-identity.mjs` writes the name into the files the template
ships, right after the template is copied:

| File | Change |
| --- | --- |
| `package.json` | `name` is the project name, `private` is `true`, the template `version` is removed |
| `package-lock.json` | `name` and `packages[""].name` follow the project name, the template `version` is removed |
| `bun.lock` | the root workspace `name` follows the project name |

The generated project is private and versionless: the template version belongs
to the template, not to the application that was generated from it. npm accepts
a `package.json` without a `version`, and the lockfile stays consistent with
it.

The `bun.lock` file is JSONC — it allows trailing commas — so it cannot be
parsed with `JSON.parse` or rewritten with `JSON.stringify`. Its root
workspace name is replaced in place instead.

## Where the template leftovers are removed

`applyTemplateIdentity(targetDir, projectName)` in
`bin/core/template-identity.mjs` rewrites the slots that carry the template's
own identity, right after the template is copied:

| Slot | File | Example template value |
| --- | --- | --- |
| README title | `README.md` | `# FSD Architecture Starter` |
| Document title | `index.html` | `<title>FSD Architecture Starter</title>` |
| Document title | `src/app/layout.route.tsx` | `title: "FSD Next.js Starter"` |
| Angular project name | `angular.json` | `projects.<id>.projectName` |

The slots are rewritten structurally rather than by matching the template's
wording, so the replacement does not depend on what the template happens to
call itself: the React title is `FSD Architecture Starter` and the Vue one is
`FSD CLI — Vue + Vite`, and both are replaced the same way.

The title is the last path segment of the project name, so a project created
as `apps/web` is titled `web`.

The templates' own demo content — the hero widget, `templateInfo` and the
starter pages — is left as it is. That content is the starting point the
generated application replaces, not project metadata.

## The CLI behavior

The folder name and the package name are independent. The folder keeps the
name the user typed; the package name is the npm-safe version of it.

A project name can be a valid folder name and still not be a valid npm package
name — `MyApp` is a fine folder but not a publishable package. When the CLI
finds such a name, it suggests the normalized one and asks the user to
confirm it:

```
"MyApp" is not a valid npm package name (the name is lowercased). Use "myapp" as the package name?
```

Confirming uses the suggested name. Declining keeps the name the user typed.
A name that is already valid is never questioned.

`--yes` never asks and never fails on a name that can be fixed: it uses the
normalized name and says so.

```
"MyApp" is not a valid npm package name (the name is lowercased). Using "myapp" instead.
```

## API

```js
import { inspectPackageName, toPackageName } from "./bin/core/package-name.mjs";

toPackageName("MyApp");
// { name: "myapp", valid: false, changed: true, issues: ["the name is lowercased"] }

inspectPackageName("MyApp");
// { valid: false, errors: [], warnings: ["name can no longer contain capital letters"] }
```

- `name` — the normalized package name.
- `valid` — whether the input was already a publishable npm name.
- `changed` — whether the normalization altered the input.
- `issues` — the human-readable reasons for every change, empty when the input
  was already valid.

`toPackageName` throws when the input cannot be converted into a valid name at
all, for example an empty string or a scope without a name.

## Scope

This document covers the naming rules only. Writing the name into the generated
project, removing the template leftovers and the CLI flags are tracked as
separate tasks and documented here as they land.
