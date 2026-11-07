/**
 * Project targets: what kind of project the user is creating.
 *
 * The init flow asks for a project target right after the project name and
 * before the framework, because the target decides what the rest of the
 * flow can offer: which tool step applies (a monorepo tool for multi-app
 * targets, a mobile tool for mobile ones) and — once framework filtering
 * lands — which frameworks can serve it.
 *
 * A project target is a user-facing choice, not an adapter property. The
 * adapter contract (bin/core/frameworks/adapter-contract.mjs) knows only
 * the targets a single adapter can serve ("web", "mobile"); a selection
 * like "universal" describes a workspace of several apps, so it maps to
 * more than one adapter target. `adapterTargetsForSelection` is that
 * mapping, and it is the only place the two vocabularies meet.
 *
 * The selection is flow state for now: persisting it into the project
 * config is separate follow-up work, and the `--target` flag arrives with
 * the CLI flags work. Nothing here writes to disk.
 *
 * Only the web target is implemented today. The other selections are
 * roadmap items (multi-app workspaces, mobile support), so they carry
 * `available: false` plus the reason: the prompt offers them as disabled
 * "Coming Soon" choices — the same treatment planned templates get — and
 * every programmatic entry point rejects them through
 * `assertProjectTargetAvailable` instead of silently creating a plain
 * web project. When a target's support lands, flipping its `available`
 * flag is the only change needed here.
 */

/**
 * A project target as chosen in the init flow.
 *
 * @typedef {"web" | "multi-web" | "mobile" | "universal"} ProjectTargetSelection
 */

/** The target assumed when the flow never asks (non-interactive runs). */
export const DEFAULT_PROJECT_TARGET = "web";

/**
 * The target choices, in prompt order. `value` is the stored selection;
 * `adapterTargets` lists the adapter-contract targets a project with this
 * selection needs.
 */
export const PROJECT_TARGET_OPTIONS = Object.freeze([
  Object.freeze({
    value: "web",
    title: "Web",
    description: "A single web application",
    adapterTargets: Object.freeze(["web"]),
    available: true,
  }),
  Object.freeze({
    value: "multi-web",
    title: "Multi-web",
    description: "Several web applications in one workspace",
    adapterTargets: Object.freeze(["web"]),
    available: false,
    unavailableReason: "monorepo workspaces are not supported yet",
  }),
  Object.freeze({
    value: "mobile",
    title: "Mobile",
    description: "A mobile application",
    adapterTargets: Object.freeze(["mobile"]),
    available: false,
    unavailableReason: "no framework supports mobile yet",
  }),
  Object.freeze({
    value: "universal",
    title: "Universal",
    description: "Web and mobile applications in one workspace",
    adapterTargets: Object.freeze(["web", "mobile"]),
    available: false,
    unavailableReason:
      "no framework supports mobile yet, so its mobile half cannot be created",
  }),
]);

const OPTIONS_BY_VALUE = new Map(PROJECT_TARGET_OPTIONS.map((option) => [option.value, option]));

/**
 * @param {string} selection - A project target selection.
 * @returns {boolean} Whether the value is a known project target.
 */
export function isProjectTargetSelection(selection) {
  return OPTIONS_BY_VALUE.has(selection);
}

/**
 * Returns the prompt choice for a selection.
 *
 * @param {ProjectTargetSelection} selection - A project target selection.
 * @returns {(typeof PROJECT_TARGET_OPTIONS)[number]} The matching option.
 */
export function getProjectTargetOption(selection) {
  const option = OPTIONS_BY_VALUE.get(selection);
  if (!option) {
    throw new Error(
      `Unknown project target "${selection}". Supported targets: ${PROJECT_TARGET_OPTIONS.map(
        (choice) => choice.value
      ).join(", ")}.`
    );
  }
  return option;
}

/**
 * Maps a project target selection to the adapter-contract targets a
 * project with that selection needs.
 *
 * @param {ProjectTargetSelection} selection - A project target selection.
 * @returns {string[]} Adapter targets ("web" and/or "mobile").
 */
export function adapterTargetsForSelection(selection) {
  return [...getProjectTargetOption(selection).adapterTargets];
}

/**
 * @param {string} selection - A project target selection.
 * @returns {boolean} Whether projects with this target can be created today.
 */
export function isProjectTargetAvailable(selection) {
  return getProjectTargetOption(selection).available;
}

/**
 * Explains why a project target cannot be selected yet.
 *
 * @param {ProjectTargetSelection} selection - An unavailable selection.
 * @returns {string} The user-facing explanation.
 */
export function projectTargetUnavailableMessage(selection) {
  const option = getProjectTargetOption(selection);
  return `The ${option.title} project target is not available yet: ${option.unavailableReason}. Only Web projects can be created today.`;
}

/**
 * Rejects a selection whose target is not implemented yet, so no entry
 * point (prompt, flags, or a direct call) can proceed with it.
 *
 * @param {ProjectTargetSelection} selection - A project target selection.
 */
export function assertProjectTargetAvailable(selection) {
  if (!isProjectTargetAvailable(selection)) {
    throw new Error(projectTargetUnavailableMessage(selection));
  }
}
