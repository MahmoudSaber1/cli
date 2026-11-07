import chalk from "chalk";

export function showBanner() {
  const banner = `
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ███████╗███████╗██████╗                                                  │
│    ██╔════╝██╔════╝██╔══██╗                                                 │
│    █████╗  ███████╗██║  ██║                                                 │
│    ██╔══╝  ╚════██║██║  ██║                                                 │
│    ██║     ███████║██████╔╝                                                 │
│    ╚═╝     ╚══════╝╚═════╝                                                  │
│                                                                             │
│           ◢◤◢◤◢◤  FEATURE-SLICED DESIGN ARCHITECTURE  ◢◤◢◤◢◤                │
│                                                                             │
│   app → pages → widgets → features → entities → shared                     │
│                                                                             │
│   Scalable • Maintainable • Enterprise Frontend Architecture                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘`;
  console.log(chalk.cyanBright(banner));
}

export function showHelp(version, program = "create-fsd-architecture") {
  console.log(`${program} v${version}

Usage:
  fsd create [project-name] [options]
  fsd generate <type> <name...> [--force] [--dry-run]     (alias: fsd g)
  fsd <check|doctor> [--architecture]
  fsd config
  fsd upgrade [--dry-run] [--check] [--yes] [--no-install] [--allow-dirty]

  fsd and create-fsd-architecture are the same CLI; install it globally with
  npm install -g create-fsd-architecture, or run it once with npx.

Flag form (also works with create-fsd-architecture):
  create-fsd-architecture [project-name] [options]
  create-fsd-architecture --generate <type> <name...> [--force] [--dry-run]
  create-fsd-architecture -g <type> [names...] --segments ui,api [--root src]
  create-fsd-architecture -g shared <ui|api> [components...] [--dry-run]

Commands:
      create [project-name]     Scaffold a new FSD project (default action)
  g,  generate <type> <name>    Generate an FSD slice in the current project
  -g, --generate <type> <name>  Same as generate
      --list-templates          Show stable and planned framework templates
      check                     Inspect config/layers (not import architecture)
       doctor                    Diagnose the local project and toolchain
       config                    Print the resolved FSD configuration
       upgrade                   Safely migrate CLI-owned project tooling

Create options:
  -f, --framework <id>          Select a framework without the template prompt
      --target <target>         Project target: web (multi-web, mobile and universal are not yet available)
      --monorepo                Shortcut for --target multi-web (not yet available)
      --mobile                  Shortcut for --target mobile (not yet available)
  -y, --yes                     Accept defaults (requires name and --framework)
      --package-manager <id>    Select npm, pnpm, yarn, or bun
      --package-name <name>     Set the npm package name independently of the folder name
      --api-client <id>         Select axios or fetch
      --server-state <id>       Override the framework server-state default
      --client-state <id>       Override the framework client-state default
      --forms <id>              Override the framework forms default
      --no-install              Create the project without installing packages
      --no-start                Do not start the development server
      --dry-run                 Preview every planned change without writing files
      --segments <names>        Structure-only comma-separated segments; preserve existing files
  -r, --root <path>             Source root for structure-only generation
       --auth-provider supabase  Opt-in browser Supabase adapter for feature auth
       --force                   Replace an existing target with automatic rollback

Upgrade options:
       --dry-run                 Show the upgrade plan and make no changes
       --check                   Read-only CI status (0 current, 2 available, 3 blocked, 4 invalid)
   -y, --yes                     Apply only when the complete plan has no conflicts
       --no-install              Do not install dependencies after a dependency migration
       --allow-dirty             Permit apply in a dirty Git worktree after a warning

Global options:
  -h, --help                    Show this help
  -v, --version                 Show the installed CLI version

Examples:
  npm install -g create-fsd-architecture
  fsd create my-app --framework react-vite --yes
  fsd g widget navbar sidebar footer bottom-bar
  npx create-fsd-architecture my-app
  npx create-fsd-architecture my-app --framework react-vite --yes --no-install
  npx create-fsd-architecture --generate feature auth
  npx create-fsd-architecture --generate feature auth --auth-provider supabase
  npx create-fsd-architecture -g entity product customer --dry-run
  npx create-fsd-architecture -g widget navbar sidebar footer bottom-bar
  npx create-fsd-architecture -g shared ui button input
  npx create-fsd-architecture -g shared api
  npx create-fsd-architecture -g page about consult
  npx create-fsd-architecture -g feature cart --segments ui,api --root src/lib
  npx create-fsd-architecture -g shared --segments ui,lib --root src

Architectural validation:
  check/doctor do not analyze imports or FSD public API violations.
  check --architecture runs the project's installed Steiger; no automatic download.
  Install steiger and @feature-sliced/steiger-plugin and configure project rules.

Support FSD CLI (optional):
  Buy Me a Coffee: https://buymeacoffee.com/ashrafqopiah
  InstaPay (Egypt): ashrafmo-1
  Verify the recipient details before confirming a transfer.`);
}

export function showTemplateList(templates) {
  console.log("Framework templates:\n");
  for (const template of templates) {
    const status = template.available
      ? chalk.green("stable")
      : chalk.yellow("planned");
    console.log(
      `  ${template.value.padEnd(14)} ${status.padEnd(17)} ${template.title}`,
    );
  }
}
