import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { getCapabilityChoices } from "../core/capability-matrix.mjs";
import { spawnSafe } from "../core/command-runner.mjs";
import { getRunScriptCommand } from "../core/package-managers.mjs";
import { resolveProjectPath } from "../core/project-path.mjs";
import {
  cloneTemplate,
  beginProjectTransaction,
  installProjectDependencies,
  prepareProject,
  verifyCommitlintRejectsInvalidMessage,
} from "../core/project-lifecycle.mjs";
import { applyPackageIdentity } from "../core/package-identity.mjs";
import { applyTemplateIdentity } from "../core/template-identity.mjs";
import {
  describePackageNameSuggestion,
  resolveExplicitPackageName,
} from "../core/package-name.mjs";
import {
  DEFAULT_PROJECT_TARGET,
  PROJECT_TARGET_OPTIONS,
  assertProjectTargetAvailable,
  getProjectTargetOption,
} from "../core/project-target.mjs";
import {
  getAvailableTemplate,
  getTemplate,
  listTemplates,
} from "../core/template-registry.mjs";
import { checkNodeVersion } from "../core/runtime-requirements.mjs";
import { normalizeProjectConfig } from "../project-config.mjs";
import { writeInitialManifest } from "../upgrade/manifest.mjs";
import { showBanner } from "../cli/output.mjs";

function handleCancel() {
  console.log(`\n${chalk.yellow("  Cancelled.")}\n`);
  process.exit(0);
}

const onCancel = { onCancel: handleCancel };

export function createDefaultProjectConfig(framework, overrides = {}) {
  return normalizeProjectConfig(framework, overrides);
}

function readCliVersion() {
  return JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  ).version;
}

function getConfigOverrides(options) {
  return Object.fromEntries(
    ["packageManager", "apiClient", "serverState", "clientState", "forms"]
      .filter((key) => options[key] !== undefined)
      .map((key) => [key, options[key]])
  );
}

async function selectProjectName(projectName) {
  if (projectName) return projectName;
  const answer = await prompts(
    {
      type: "text",
      name: "projectName",
      message: "Project name",
      initial: "my-fsd-app",
    },
    onCancel
  );
  return answer.projectName;
}

async function selectTemplate(framework) {
  if (framework) return getAvailableTemplate(framework);

  const answer = await prompts(
    {
      type: "select",
      name: "template",
      message: "Select framework",
      choices: listTemplates().map((template) => ({
        title: template.available
          ? template.title
          : `${template.title} ${chalk.dim("(Coming Soon)")}`,
        value: template.value,
      })),
    },
    onCancel
  );
  const template = getTemplate(answer.template);
  if (!template?.available) {
    throw new Error(`${template?.title ?? "Template"} support is coming soon.`);
  }
  return template;
}

export function getProjectQuestions(framework) {
  const defaults = createDefaultProjectConfig(framework);
  return [
    ["apiClient", "API client"],
    ["serverState", "Server state"],
    ["clientState", "Client state"],
    ["forms", "Forms and validation"],
    ["packageManager", "Package manager"],
  ].map(([name, message]) => {
    const choices = getCapabilityChoices(framework, name);
    return {
      type: "select",
      name,
      message,
      choices,
      initial: choices.findIndex(({ value }) => value === defaults[name]),
    };
  });
}

async function promptProjectConfig(framework) {
  const answers = await prompts(getProjectQuestions(framework), onCancel);
  return normalizeProjectConfig(framework, {
    ...answers,
  });
}

function showNextSteps(projectName, depsInstalled, packageManager) {
  console.log(`\n${chalk.bold.white("  Next steps:")}\n`);
  console.log(`    ${chalk.cyan("$")} cd ${projectName}`);
  if (!depsInstalled) console.log(`    ${chalk.cyan("$")} ${packageManager} install`);
  const dev = getRunScriptCommand(packageManager, "dev");
  console.log(`    ${chalk.cyan("$")} ${dev.command} ${dev.args.join(" ")}`);
  console.log();
}

function showProjectPlan({ projectName, targetDir, target, template, projectConfig, options }) {
  const replace = fs.existsSync(targetDir) && options.force;
  console.log(chalk.bold("  Project plan (dry run)\n"));
  console.log(`  Target: ${targetDir}`);
  console.log(`  Project target: ${getProjectTargetOption(target).title} (${target})`);
  console.log(`  Template: ${template.title} (${template.repo}#${template.ref})`);
  console.log(`  Package manager: ${projectConfig.packageManager}`);
  console.log(`  API client: ${projectConfig.apiClient}`);
  console.log(`  Server state: ${projectConfig.serverState}`);
  console.log(`  Client state: ${projectConfig.clientState}`);
  console.log(`  Forms: ${projectConfig.forms}\n`);
  console.log(`  ${replace ? "1. Back up and replace the existing target" : "1. Create the target directory"}`);
  console.log("  2. Download the selected template");
  console.log("  3. Write fsd.config.json and configure the selected stack");
  console.log("  4. Initialize Git, Husky, and Commitlint");
  console.log(
    options.noInstall ? "  5. Skip dependency installation" : "  5. Install dependencies"
  );
  console.log("  6. Roll back all changes if project setup fails\n");
  console.log(chalk.dim(`  No files were changed for ${projectName}.`));
}

/**
 * Resolves the npm package name of a project.
 *
 * A project name that is a valid folder name is not always a valid npm
 * package name: "MyApp" is a fine folder but not a publishable package. The
 * CLI suggests the normalized name and asks the user to confirm it. Declining
 * keeps the name the user typed.
 *
 * `--yes` never asks and never fails on a name that can be fixed: it uses the
 * normalized name and reports it.
 *
 * `--package-name` overrides the package name independently of the folder
 * name. It is never rewritten: an invalid name is refused.
 *
 * @param {string} projectName
 * @param {{yes?: boolean, packageName?: string}} options
 * @param {Function} ask the prompt implementation, injectable for the tests
 * @returns {Promise<{packageName: string, warning: string|null}>}
 */
export async function resolvePackageName(projectName, options = {}, ask = prompts) {
  if (options.packageName) {
    return {
      packageName: resolveExplicitPackageName(options.packageName),
      warning: null,
    };
  }

  const suggestion = describePackageNameSuggestion(projectName);
  if (suggestion.valid) {
    return { packageName: suggestion.name, warning: null };
  }

  if (options.yes) {
    return {
      packageName: suggestion.name,
      warning: `"${projectName}" is not a valid npm package name (${suggestion.issues.join(
        ", "
      )}). Using "${suggestion.name}" instead.`,
    };
  }

  const answer = await ask(
    {
      type: "confirm",
      name: "useSuggestedPackageName",
      message: suggestion.message,
      initial: true,
    },
    onCancel
  );

  return {
    packageName: answer.useSuggestedPackageName
      ? suggestion.name
      : suggestion.raw,
    warning: null,
  };
}

/**
 * Resolves the project target for the create flow.
 *
 * The target step sits between the project name and the framework: the
 * chosen target decides what the rest of the flow can offer (the tool
 * step for multi-app targets, and framework filtering once it lands).
 *
 * An explicit `options.target` wins and is validated. `--yes` never asks
 * and defaults to "web", so existing non-interactive commands behave
 * exactly as before. The selection is flow state only — persisting it
 * into the project config is separate follow-up work.
 *
 * @param {{yes?: boolean, target?: string}} options
 * @param {Function} ask the prompt implementation, injectable for the tests
 * @returns {Promise<string>} the project target selection
 */
export async function resolveProjectTarget(options = {}, ask = prompts) {
  if (options.target !== undefined) {
    const selection = getProjectTargetOption(options.target).value;
    assertProjectTargetAvailable(selection);
    return selection;
  }

  if (options.yes) return DEFAULT_PROJECT_TARGET;

  const answer = await ask(
    {
      type: "select",
      name: "target",
      message: "Project target",
      choices: PROJECT_TARGET_OPTIONS.map((option) => ({
        title: option.available ? option.title : `${option.title} (Coming Soon)`,
        value: option.value,
        description: option.description,
        disabled: !option.available,
      })),
      initial: PROJECT_TARGET_OPTIONS.findIndex(
        ({ value }) => value === DEFAULT_PROJECT_TARGET
      ),
    },
    onCancel
  );
  assertProjectTargetAvailable(answer.target);
  return answer.target;
}

export async function runCreateProject(options) {
  showBanner();
  const projectName = await selectProjectName(options.projectName);
  if (!projectName) throw new Error("Project name is required.");

  const targetDir = resolveProjectPath(process.cwd(), projectName);
  if (fs.existsSync(targetDir) && !options.force) {
    throw new Error(
      `Folder "${projectName}" already exists. Re-run with --force to replace it.`
    );
  }

  // The folder name and the package name are independent: the folder keeps
  // the name the user typed, the package name is the npm-safe version of it.
  const { packageName, warning } = await resolvePackageName(projectName, options);
  if (warning) console.log(chalk.yellow(`  ${warning}`));

  const target = await resolveProjectTarget(options);

  const template = await selectTemplate(options.framework);

  // Fail before any download or write so the user never gets a project that
  // the current Node runtime cannot build.
  const nodeCheck = checkNodeVersion(process.versions.node, { framework: template.value });
  if (!nodeCheck.ok) {
    throw new Error(
      `${nodeCheck.message} The ${template.title} template cannot be created with this Node.js runtime.`
    );
  }

  const overrides = getConfigOverrides(options);
  const projectConfig = options.yes
    ? createDefaultProjectConfig(template.value, overrides)
    : normalizeProjectConfig(template.value, {
        ...(await promptProjectConfig(template.value)),
        ...overrides,
      });

  if (options.dryRun) {
    showProjectPlan({ projectName, targetDir, target, template, projectConfig, options });
    return;
  }

  const transaction = beginProjectTransaction(targetDir, { force: options.force });
  const rollbackOnCancel = {
    onCancel: () => {
      transaction.rollback();
      handleCancel();
    },
  };

  console.log();
  const downloadSpinner = ora({ text: "Downloading template...", color: "cyan" }).start();
  try {
    await cloneTemplate(template, targetDir);
    downloadSpinner.succeed(chalk.green("Template downloaded at verified immutable commit."));
  } catch (error) {
    downloadSpinner.fail(chalk.red("Failed to download template."));
    transaction.rollback();
    throw error;
  }

  const setupSpinner = ora({
    text: "Configuring FSD stack, Git, and Husky...",
    color: "cyan",
  }).start();
  try {
    applyPackageIdentity(targetDir, packageName);
    applyTemplateIdentity(targetDir, projectName);
    prepareProject(targetDir, projectConfig);
    writeInitialManifest(targetDir, projectConfig, readCliVersion());
    setupSpinner.succeed(chalk.green("FSD stack, Git, and Husky configured."));
  } catch (error) {
    setupSpinner.fail(chalk.red("Project configuration failed."));
    transaction.rollback();
    throw error;
  }

  let shouldInstall = options.yes && !options.noInstall;
  if (!options.yes && !options.noInstall) {
    const answer = await prompts(
      {
        type: "confirm",
        name: "installDeps",
        message: "Install dependencies now?",
        initial: true,
      },
      rollbackOnCancel
    );
    shouldInstall = answer.installDeps;
  }

  let depsInstalled = false;
  if (shouldInstall) {
    const installSpinner = ora({ text: "Installing dependencies...", color: "cyan" }).start();
    try {
      installProjectDependencies(targetDir, projectConfig.packageManager);
      installSpinner.succeed(chalk.green("Dependencies installed."));
      depsInstalled = true;
    } catch (error) {
      installSpinner.fail(chalk.red("Failed to install dependencies."));
      transaction.rollback();
      const detail = [error.stderr, error.stdout, error.message]
        .filter(Boolean)
        .map(String)
        .join("\n");
      throw new Error(
        `Dependency installation failed; project changes were rolled back.\n${detail}`,
        { cause: error }
      );
    }
  }

  if (depsInstalled) {
    const commitlintSpinner = ora({ text: "Verifying Commitlint...", color: "cyan" }).start();
    try {
      verifyCommitlintRejectsInvalidMessage(targetDir);
      commitlintSpinner.succeed(chalk.green('Commitlint rejected invalid message "test".'));
    } catch (error) {
      commitlintSpinner.fail(chalk.red("Commitlint verification failed."));
      transaction.rollback();
      throw error;
    }
  } else {
    console.log(chalk.dim("  Commitlint verification skipped until dependencies are installed."));
  }

  let shouldStart = false;
  if (depsInstalled && !options.yes && !options.noStart) {
    const answer = await prompts(
      {
        type: "confirm",
        name: "startDev",
        message: "Start development server now?",
        initial: true,
      },
      rollbackOnCancel
    );
    shouldStart = answer.startDev;
  }

  if (shouldStart) {
    transaction.commit();
    console.log(`\n${chalk.cyan("  Starting development server...")}\n`);
    const dev = getRunScriptCommand(projectConfig.packageManager, "dev");
    const child = spawnSafe(dev.command, dev.args, {
      cwd: targetDir,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", (error) => {
      console.log(chalk.red(`  Failed to start dev server: ${error.message}`));
      showNextSteps(projectName, true, projectConfig.packageManager);
    });
    return;
  }

  transaction.commit();
  console.log(`\n${chalk.green.bold("  Project created successfully!")}`);
  showNextSteps(projectName, depsInstalled, projectConfig.packageManager);
}
