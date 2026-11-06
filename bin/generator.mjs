import fs from "fs";
import path from "path";
import chalk from "chalk";
import { assertGeneratorSupported } from "./core/capability-matrix.mjs";
import { getFrameworkAdapter } from "./core/frameworks/index.mjs";
import {
  exportLine,
  file,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from "./generators/shared.mjs";
import { getFamilyGenerator } from "./generators/family-generators.mjs";
import { normalizeProjectConfig } from "./project-config.mjs";
import { generateStructure, generateBatch } from "./generators/structure.mjs";
import {
  createSharedLayerPlan,
  generateSharedLayer,
  printSharedLayerPlan,
} from "./generators/shared-layer.mjs";
import {
  assertManagedFileUnchanged,
  recordManagedFileContent,
} from "./upgrade/manifest.mjs";

const ALLOWED_TYPES = ["feature", "entity", "widget", "page"];

const LAYER_DIRS = {
  feature: "features",
  entity: "entities",
  widget: "widgets",
  page: "pages",
};

export function parseGenerateArgs(args) {
  const generateIndex = args.findIndex((arg) => arg === "--generate" || arg === "-g");

  if (generateIndex === -1) {
    return { shouldGenerate: false };
  }

  const values = args
    .slice(generateIndex + 1)
    .filter((arg) => !arg.startsWith("-"));

  return {
    shouldGenerate: true,
    type: values[0],
    name: values[1],
    force: args.includes("--force"),
  };
}

export async function runGenerator(options) {
  if (options.segments) {
    const paths = generateStructure({ ...options, cwd: process.cwd() });
    console.log(paths.length ? paths.join("\n") : "Structure already exists; no changes.");
    return;
  }
  if (options.type === "shared") {
    return runSharedGenerator(options);
  }
  if (options.names) {
    return generateBatch(options, { loadProjectConfig, createGeneratorPlan, generateSlice, printFilePlan, printSuccess });
  }
  validateGenerateOptions(options);

  const normalizedName = toKebabCase(options.name);
  const config = loadProjectConfig(process.cwd());
  assertGeneratorSupported(config.framework, options.type);
  const generatorOptions = {
    cwd: process.cwd(),
    type: options.type,
    name: normalizedName,
    config,
    force: options.force,
    authProvider: options.authProvider,
  };

  if (options.dryRun) {
    printFilePlan(createGeneratorPlan(generatorOptions));
    return;
  }

  const createdFiles = generateSlice(generatorOptions);

  printSuccess(createdFiles);
}

function runSharedGenerator(options) {
  if (options.force || options.authProvider) {
    throw new Error(
      "Shared generation never overwrites files; --force and --auth-provider are not supported."
    );
  }
  if (!options.name) {
    throw new Error(
      "Usage: create-fsd-architecture --generate shared <ui|api> [component...] [--dry-run]"
    );
  }
  const cwd = process.cwd();
  const config = loadProjectConfig(cwd);
  assertGeneratorSupported(config.framework, "shared");
  const plan = createSharedLayerPlan({
    cwd,
    segment: options.name,
    items: (options.names ?? []).slice(1),
    config,
  });
  if (!options.dryRun) generateSharedLayer(plan);
  printSharedLayerPlan(plan, { dryRun: options.dryRun });
}

function validateGenerateOptions({ type, name }) {
  if (!type || !name) {
    throw new Error(
      "Usage: create-fsd-architecture --generate <type> <name> [--force]"
    );
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(
      `Invalid type "${type}". Allowed types: ${ALLOWED_TYPES.join(", ")}.`
    );
  }

  if (!toKebabCase(name)) {
    throw new Error("Slice name must contain at least one letter or number.");
  }
  if (!/^[a-z]/.test(toKebabCase(name))) {
    throw new Error("Slice name must start with a letter after normalization (for example, product-123).");
  }
}

export function loadProjectConfig(cwd) {
  const configPath = path.join(cwd, "fsd.config.json");

  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.schemaVersion !== 1) {
      throw new Error(`Unsupported fsd.config.json schemaVersion: ${config.schemaVersion}.`);
    }
    return normalizeProjectConfig(config.framework, config);
  }

  const packagePath = path.join(cwd, "package.json");
  const packageJson = fs.existsSync(packagePath)
    ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
    : {};
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const framework = dependencies["@sveltejs/kit"]
    ? "sveltekit"
    : dependencies.nuxt
    ? "nuxt"
    : dependencies.next
      ? "nextjs"
      : dependencies.vue
      ? "vue-vite"
      : "react-vite";
  return normalizeProjectConfig(framework, {
    apiClient: dependencies.axios ? "axios" : "fetch",
    serverState: dependencies["@tanstack/svelte-query"]
      ? "svelte-query"
      : dependencies["@tanstack/vue-query"]
      ? "vue-query"
      : dependencies["@tanstack/react-query"]
        ? "react-query"
        : "none",
    clientState: framework === "sveltekit"
      ? "svelte-store"
      : dependencies.pinia
      ? "pinia"
      : dependencies.zustand
        ? "zustand"
        : dependencies["@reduxjs/toolkit"]
          ? "redux"
          : "none",
    forms: dependencies["sveltekit-superforms"] && dependencies.zod
      ? "sveltekit-superforms-zod"
      : dependencies["vee-validate"] && dependencies.zod
      ? "vee-validate-zod"
      : dependencies["react-hook-form"] && dependencies.zod
        ? "react-hook-form-zod"
        : "none",
    ui: "shared-ui",
  });
}

export function createGeneratorPlan({ cwd, type, name, config, force = false, authProvider }) {
  validateGenerateOptions({ type, name });
  assertGeneratorSupported(config.framework, type);
  const adapter = getFrameworkAdapter(config.framework);
  const layerDir = LAYER_DIRS[type];
  const sourceRoot = path.join(cwd, adapter.sourceDirectory);
  const baseDir = fs.existsSync(sourceRoot)
    ? path.join(sourceRoot, layerDir)
    : path.join(cwd, layerDir);
  const sliceDir = path.join(baseDir, name);

  if (fs.existsSync(sliceDir) && !force) {
    throw new Error(
      `Slice "${path.relative(cwd, sliceDir)}" already exists. Re-run with --force to overwrite it.`
    );
  }

  if (authProvider && (authProvider !== "supabase" || type !== "feature" || name !== "auth")) {
    throw new Error("--auth-provider supabase is only valid for feature auth.");
  }
  const files = createFilePlan(type, name, { ...config, authProvider });
  if (authProvider === "supabase") addSupabaseAuthFiles(files);
  const publicExports = files
    .filter((file) => file.public)
    .map((file) => file.exportLine ?? exportLine(file.path))
    .sort();

  files.push({
    path: "index.ts",
    content: `${publicExports.join("\n")}\n`,
    public: false,
  });

  const generatedFiles = files.map((item) =>
    path.relative(cwd, path.join(sliceDir, item.path))
  );
  const changedFiles = [];

  if (type === "feature" && config.clientState === "redux") {
    const storePath = getReduxStorePath(cwd);
    if (storePath) changedFiles.push(path.relative(cwd, storePath));
  }

  if (type === "page") {
    changedFiles.push(...getPageRouteFiles(cwd, name, config, force));
  }

  return { cwd, type, name, config, force, sliceDir, files, generatedFiles, changedFiles };
}

export function generateSlice(options) {
  const plan = createGeneratorPlan(options);
  const { cwd, type, name, config, force, sliceDir, files } = plan;
  const backupDir = fs.existsSync(sliceDir)
    ? `${sliceDir}.fsd-cli-backup-${process.pid}-${Date.now()}`
    : null;
  const snapshots = snapshotFiles(
    plan.changedFiles.map((filePath) => path.join(cwd, filePath))
  );

  if (backupDir) fs.renameSync(sliceDir, backupDir);

  try {
    for (const item of files) {
      const filePath = path.join(sliceDir, item.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, item.content);
    }

    if (type === "feature" && config.clientState === "redux") {
      registerReduxReducer(cwd, name);
    }
    if (type === "page") registerPageRoute(cwd, name, config, force);

    if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true });
    return [...plan.generatedFiles, ...plan.changedFiles];
  } catch (error) {
    fs.rmSync(sliceDir, { recursive: true, force: true });
    if (backupDir && fs.existsSync(backupDir)) fs.renameSync(backupDir, sliceDir);
    restoreFiles(snapshots);
    throw error;
  }
}

function getReduxStorePath(cwd) {
  const providerStorePath = path.join(cwd, "src", "app", "providers", "store.ts");
  const legacyStorePath = path.join(cwd, "src", "app", "store.ts");
  return fs.existsSync(providerStorePath)
    ? providerStorePath
    : fs.existsSync(legacyStorePath)
      ? legacyStorePath
      : null;
}

function registerReduxReducer(cwd, name) {
  const storePath = getReduxStorePath(cwd);
  if (!storePath) return;

  const reducerName = name === "auth" ? "authReducer" : `${toCamelCase(name)}Reducer`;
  const importLine = `import { ${reducerName} } from "@/features/${name}";`;
  const reducerLine = `    ${toCamelCase(name)}: ${reducerName},`;
  let content = fs.readFileSync(storePath, "utf8");
  const relativeStorePath = path.relative(cwd, storePath);
  const isManaged = assertManagedFileUnchanged(cwd, relativeStorePath, content);

  content = updateMarkerBlock(
    content,
    "// fsd-cli:imports:start",
    "// fsd-cli:imports:end",
    importLine
  );
  content = updateMarkerBlock(
    content,
    "    // fsd-cli:reducers:start",
    "    // fsd-cli:reducers:end",
    reducerLine
  );
  fs.writeFileSync(storePath, content);
  if (isManaged) recordManagedFileContent(cwd, relativeStorePath, content);
}

function getPageRouteFiles(cwd, name, config, force) {
  if (config.framework === "nextjs") {
    const routeFile = path.join(cwd, "src", "app", name, "page.route.tsx");
    if (fs.existsSync(routeFile) && !force) {
      throw new Error(
        `Route "${path.relative(cwd, routeFile)}" already exists. Re-run with --force to overwrite it.`
      );
    }
    return [path.relative(cwd, routeFile)];
  }

  if (config.framework === "nuxt") {
    const routeFile = path.join(cwd, "app", "app", "routes", `${name}.vue`);
    if (fs.existsSync(routeFile) && !force) {
      throw new Error(
        `Route "${path.relative(cwd, routeFile)}" already exists. Re-run with --force to overwrite it.`
      );
    }
    return [path.relative(cwd, routeFile)];
  }

  if (config.framework === "sveltekit") {
    const routeFile = path.join(cwd, "src", "routes", name, "+page.svelte");
    if (fs.existsSync(routeFile) && !force) {
      throw new Error(
        `Route "${path.relative(cwd, routeFile)}" already exists. Re-run with --force to overwrite it.`
      );
    }
    return [path.relative(cwd, routeFile)];
  }

  const extension = config.framework === "vue-vite" ? "ts" : "tsx";
  const routeFile = path.join(cwd, "src", "app", "routing", `index.${extension}`);
  if (!fs.existsSync(routeFile)) {
    throw new Error(
      `Routing entry "${path.relative(cwd, routeFile)}" is missing. Update the project template before generating pages.`
    );
  }
  return [path.relative(cwd, routeFile)];
}

function registerPageRoute(cwd, name, config) {
  const componentName = `${toPascalCase(name)}Page`;
  if (config.framework === "nextjs") {
    const routeFile = path.join(cwd, "src", "app", name, "page.route.tsx");
    fs.mkdirSync(path.dirname(routeFile), { recursive: true });
    fs.writeFileSync(
      routeFile,
      `import { ${componentName} } from "@/pages/${name}";\n\nexport default function ${componentName}Route() {\n  return <${componentName} />;\n}\n`
    );
    return;
  }

  if (config.framework === "nuxt") {
    const routeFile = path.join(cwd, "app", "app", "routes", `${name}.vue`);
    fs.mkdirSync(path.dirname(routeFile), { recursive: true });
    fs.writeFileSync(
      routeFile,
      `<script setup lang="ts">\nimport { ${componentName} } from "@/pages/${name}";\n</script>\n\n<template>\n  <${componentName} />\n</template>\n`
    );
    return;
  }

  if (config.framework === "sveltekit") {
    const routeFile = path.join(cwd, "src", "routes", name, "+page.svelte");
    fs.mkdirSync(path.dirname(routeFile), { recursive: true });
    fs.writeFileSync(
      routeFile,
      `<script lang="ts">\n  import { ${componentName} } from "$pages/${name}";\n</script>\n\n<${componentName} />\n`
    );
    return;
  }

  const extension = config.framework === "vue-vite" ? "ts" : "tsx";
  const routeFile = path.join(cwd, "src", "app", "routing", `index.${extension}`);
  const importLine = `import { ${componentName} } from "@/pages/${name}";`;
  const routeLine =
    config.framework === "vue-vite"
      ? `  { path: "/${name}", name: "${name}", component: ${componentName} },`
      : `  { path: "/${name}", element: <${componentName} /> },`;
  let content = fs.readFileSync(routeFile, "utf8");
  for (const marker of [
    "// fsd-cli:route-imports:start",
    "// fsd-cli:route-imports:end",
    "// fsd-cli:routes:start",
    "// fsd-cli:routes:end",
  ]) {
    if (!content.includes(marker)) {
      throw new Error(`Routing entry "${path.relative(cwd, routeFile)}" is missing ${marker}.`);
    }
  }
  content = updateMarkerBlock(
    content,
    "// fsd-cli:route-imports:start",
    "// fsd-cli:route-imports:end",
    importLine
  );
  content = updateMarkerBlock(
    content,
    "  // fsd-cli:routes:start",
    "  // fsd-cli:routes:end",
    routeLine
  );
  fs.writeFileSync(routeFile, content);
}

function snapshotFiles(filePaths) {
  return filePaths.map((filePath) => ({
    filePath,
    exists: fs.existsSync(filePath),
    content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
  }));
}

function restoreFiles(snapshots) {
  for (const snapshot of snapshots) {
    if (snapshot.exists) {
      fs.mkdirSync(path.dirname(snapshot.filePath), { recursive: true });
      fs.writeFileSync(snapshot.filePath, snapshot.content);
    } else {
      fs.rmSync(snapshot.filePath, { force: true });
    }
  }
}

function updateMarkerBlock(content, start, end, newLine) {
  if (!content.includes(start) || !content.includes(end)) return content;

  const [before, remainder] = content.split(start);
  const [block, after] = remainder.split(end);
  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .concat(newLine);
  const uniqueLines = [...new Set(lines)].sort((a, b) => a.trim().localeCompare(b.trim()));

  return `${before}${start}\n${uniqueLines.join("\n")}\n${end}${after}`;
}

function printFilePlan(plan) {
  console.log(chalk.bold("\n  File plan (dry run)\n"));
  for (const filePath of plan.generatedFiles) console.log(`  CREATE  ${filePath}`);
  for (const filePath of plan.changedFiles) console.log(`  UPDATE  ${filePath}`);
  console.log(chalk.dim("\n  No files were changed.\n"));
}

function createFilePlan(type, name, config) {
  const family = getFrameworkAdapter(config.framework).family;
  return getFamilyGenerator(family).createFilePlan(type, name, config);
}

function printSuccess(files) {
  console.log();
  console.log(chalk.green.bold("  Slice generated successfully!"));
  console.log();
  console.log(chalk.bold.white("  Created files:"));

  for (const filePath of files) {
    console.log(`    ${chalk.cyan("-")} ${filePath}`);
  }

  console.log();
}

function addSupabaseAuthFiles(files) {
  const adapter = fs.readFileSync(new URL("./generators/supabase-auth-adapter.mjs", import.meta.url), "utf8");
  files.push(file("api/supabase.adapter.js", adapter, false));
  files.push(file("api/supabase.adapter.d.ts", supabaseDeclaration(), false));
  files.push({ path: "api/supabase.ts", content: 'export {\n  configureSupabaseAuth,\n  createSupabaseAuthAdapter,\n} from "./supabase.adapter.js";\n', public: true });
  for (const [name, method] of [["login", "login"], ["register", "register"], ["forgot-password", "forgotPassword"], ["reset-password", "resetPassword"], ["verify-code", "verifyCode"]]) {
    const pathname = `api/${name}.api.ts`;
    const item = files.find(f => f.path === pathname);
    const contents = `import { getSupabaseAuth } from "./supabase.adapter.js";\n\nexport function ${method}(\n  payload: Parameters<ReturnType<typeof getSupabaseAuth>["${method}"]>[0],\n) {\n  return getSupabaseAuth().${method}(payload);\n}\n`;
    if (item) item.content = contents;
    else files.push(file(pathname, contents, true));
  }
  files.push(file("SUPABASE.md", `# Supabase Auth integration\n\nOpt-in browser adapter; not an SSR authorization implementation. Install @supabase/supabase-js with your package manager. In browser bootstrap create a Supabase client with the public URL and publishable/anon key and pass it to configureSupabaseAuth exported by this slice. Never import service_role or secret keys into frontend code. Configure email recovery templates to include the recovery OTP; verify-code is for password recovery, not signup confirmation. Email-confirmation signup can return null. Subscribe to onAuthStateChange in application bootstrap to synchronize UI state; use adapter.logout to revoke the session. RLS and server authorization must be configured and tested independently. See the CLI docs/AUTH-SUPABASE-CONTRACT.md for the complete contract and acceptance.\n`, false));
}

function supabaseDeclaration() {
  return fs.readFileSync(new URL("./generators/supabase-auth-contract.d.ts", import.meta.url), "utf8");
}
