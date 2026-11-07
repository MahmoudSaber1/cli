import {
  PROJECT_TARGET_OPTIONS,
  isProjectTargetAvailable,
  isProjectTargetSelection,
  projectTargetUnavailableMessage,
} from "../core/project-target.mjs";

const BOOLEAN_FLAGS = new Map([
  ["--yes", "yes"],
  ["-y", "yes"],
  ["--no-install", "noInstall"],
  ["--no-start", "noStart"],
  ["--dry-run", "dryRun"],
  ["--force", "force"],
  ["--monorepo", "monorepo"],
  ["--mobile", "mobile"],
]);

const VALUE_FLAGS = new Map([
  ["--framework", "framework"],
  ["--template", "framework"],
  ["-f", "framework"],
  ["--target", "target"],
  ["--package-manager", "packageManager"],
  ["--package-name", "packageName"],
  ["--api-client", "apiClient"],
  ["--server-state", "serverState"],
  ["--client-state", "clientState"],
  ["--forms", "forms"],
]);

export class CliUsageError extends Error {}

function parseUpgradeArgs(args) {
  const options = {
    command: "upgrade",
    dryRun: false,
    check: false,
    yes: false,
    noInstall: false,
    allowDirty: false,
  };
  const flags = new Map([
    ["--dry-run", "dryRun"],
    ["--check", "check"],
    ["--yes", "yes"],
    ["-y", "yes"],
    ["--no-install", "noInstall"],
    ["--allow-dirty", "allowDirty"],
  ]);

  for (const argument of args.slice(1)) {
    if (!flags.has(argument)) {
      if (argument.startsWith("-")) {
        throw new CliUsageError(`Unknown upgrade option "${argument}".`);
      }
      throw new CliUsageError(`Unexpected argument "${argument}".`);
    }
    options[flags.get(argument)] = true;
  }

  if (options.check && (options.yes || options.noInstall)) {
    throw new CliUsageError(
      "--check cannot be combined with --yes or --no-install.",
    );
  }
  return options;
}

const GENERATE_SUBCOMMANDS = new Set(["generate", "g"]);

// `fsd create ...` and `fsd generate|g ...` are subcommand spellings of the
// flag-based commands, so both entry points share one parser.
export function normalizeSubcommand(args) {
  if (args[0] === "create") return args.slice(1);
  if (GENERATE_SUBCOMMANDS.has(args[0])) return ["--generate", ...args.slice(1)];
  return args;
}

export function parseCliArgs(rawArgs) {
  const args = normalizeSubcommand(rawArgs);
  if (args.includes("--help") || args.includes("-h"))
    return { command: "help" };
  if (args.includes("--version") || args.includes("-v"))
    return { command: "version" };
  if (args.includes("--list-templates")) return { command: "list-templates" };

  if (args[0] === "upgrade") return parseUpgradeArgs(args);

  if (["check", "doctor", "config"].includes(args[0])) {
    if (
      ["check", "doctor"].includes(args[0]) &&
      args.length === 2 &&
      args[1] === "--architecture"
    )
      return { command: args[0], architecture: true };
    if (args.length > 1) {
      throw new CliUsageError(`Unexpected argument "${args[1]}".`);
    }
    return { command: args[0] };
  }

  const generateIndex = args.findIndex(
    (arg) => arg === "--generate" || arg === "-g",
  );
  if (generateIndex !== -1) {
    const values = [];
    let force = false;
    let dryRun = false;
    let authProvider;
    let root;
    let segments;
    const tail = args.slice(generateIndex + 1);
    for (let index = 0; index < tail.length; index += 1) {
      const argument = tail[index];
      if (argument === "--force") {
        force = true;
      } else if (argument === "--dry-run") {
        dryRun = true;
      } else if (
        argument === "--auth-provider" ||
        argument.startsWith("--auth-provider=")
      ) {
        authProvider = argument.includes("=")
          ? argument.slice("--auth-provider=".length)
          : tail[++index];
        if (authProvider !== "supabase")
          throw new CliUsageError("--auth-provider supports only supabase.");
      } else if (
        ["--root", "-r", "--segments", "-s"].includes(argument) ||
        argument.startsWith("--root=") ||
        argument.startsWith("--segments=")
      ) {
        const flag = argument.split("=")[0];
        const value = argument.includes("=")
          ? argument.slice(argument.indexOf("=") + 1)
          : tail[++index];
        if (!value || value.startsWith("-"))
          throw new CliUsageError(`${flag} requires a value.`);
        if (["--root", "-r"].includes(flag)) root = value;
        else segments = value.split(",");
      } else if (argument.startsWith("-")) {
        throw new CliUsageError(`Unknown generate option "${argument}".`);
      } else {
        values.push(argument);
      }
    }
    if (args.slice(0, generateIndex).length)
      throw new CliUsageError("Place generate options after --generate.");
    if (root && !segments)
      throw new CliUsageError(
        "--root requires --segments (structure-only generation).",
      );
    if (segments && (force || authProvider))
      throw new CliUsageError(
        "--segments cannot be combined with --force or --auth-provider.",
      );
    return {
      command: "generate",
      type: values[0],
      name: values[1],
      force,
      dryRun,
      ...(authProvider ? { authProvider } : {}),
      ...(values.length > 2 ? { names: values.slice(1) } : {}),
      ...(root ? { root } : {}),
      ...(segments ? { segments } : {}),
    };
  }

  const options = {
    command: "create",
    projectName: undefined,
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
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const [inlineFlag, inlineValue] = argument.split("=", 2);

    if (BOOLEAN_FLAGS.has(argument)) {
      options[BOOLEAN_FLAGS.get(argument)] = true;
      continue;
    }

    if (VALUE_FLAGS.has(inlineFlag)) {
      const value = inlineValue ?? args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliUsageError(`${inlineFlag} requires a value.`);
      }
      options[VALUE_FLAGS.get(inlineFlag)] = value;
      if (inlineValue === undefined) index += 1;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new CliUsageError(`Unknown option "${argument}".`);
    }

    if (options.projectName) {
      throw new CliUsageError(`Unexpected argument "${argument}".`);
    }
    options.projectName = argument;
  }

  if (options.target !== undefined && !isProjectTargetSelection(options.target)) {
    throw new CliUsageError(
      `--target supports only ${PROJECT_TARGET_OPTIONS.map((option) => option.value).join(", ")} (received "${options.target}").`
    );
  }

  // --monorepo and --mobile are shorthands for --target selections. When
  // several spellings appear they must agree on a single target; the
  // resolved selection is what the create flow reads.
  const shorthand = options.monorepo
    ? { flag: "--monorepo", target: "multi-web" }
    : options.mobile
      ? { flag: "--mobile", target: "mobile" }
      : null;
  if (options.monorepo && options.mobile) {
    throw new CliUsageError("--monorepo and --mobile cannot be combined.");
  }
  if (shorthand) {
    if (options.target !== undefined && options.target !== shorthand.target) {
      throw new CliUsageError(
        `--target ${options.target} conflicts with ${shorthand.flag} (which selects ${shorthand.target}).`
      );
    }
    options.target = shorthand.target;
  }

  // Targets whose support has not landed yet are refused here, at the
  // CLI boundary, instead of failing later or silently creating a web
  // project: today only web can be created.
  if (options.target !== undefined && !isProjectTargetAvailable(options.target)) {
    throw new CliUsageError(projectTargetUnavailableMessage(options.target));
  }

  if (options.yes && !options.projectName) {
    throw new CliUsageError("A project name is required when using --yes.");
  }
  if (options.yes && !options.framework) {
    throw new CliUsageError(
      "--framework is required when using --yes (for example, --framework react-vite).",
    );
  }

  return options;
}
