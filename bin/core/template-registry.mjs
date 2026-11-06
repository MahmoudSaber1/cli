import { getCapabilities } from "./capability-matrix.mjs";
import { hasFrameworkAdapter, listFrameworkAdaptersByTarget } from "./frameworks/index.mjs";
import { adapterTargetsForSelection } from "./project-target.mjs";

const templates = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and a complete FSD architecture",
    repo: "FSD-CLI/FSD",
    ref: "55530ec14fdcabad6491a3b36edb210ddee54100",
    status: "stable",
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js with App Router and a complete FSD architecture",
    repo: "FSD-CLI/FSD-NEXTJS",
    ref: "b360aefb2318df540310daa27f477904790da9eb",
    status: "stable",
  },
  {
    title: "Vue + Vite",
    value: "vue-vite",
    description: "Vue with Vite and framework-native FSD segments",
    repo: "FSD-CLI/FSD-VUE",
    ref: "82a12276ef0c2942e16fc01f42e03872d1b8d321",
    status: "stable",
  },
  {
    title: "Nuxt",
    value: "nuxt",
    description: "Nuxt with framework-native FSD segments",
    repo: "FSD-CLI/FSD-NUXT",
    ref: "533c5f99de833e769218188a17b258684beaa52c",
    status: "stable",
  },
  {
    title: "SvelteKit",
    value: "sveltekit",
    description: "SvelteKit with framework-native FSD segments",
    repo: "FSD-CLI/fsd-sveltekit",
    ref: "9ff28cf67068bd76b6cb26b33338f45d47394fb0",
    status: "stable",
  },
];

function validateRegistry(items) {
  const ids = new Set();
  for (const template of items) {
    if (ids.has(template.value)) {
      throw new Error(`Duplicate template id "${template.value}".`);
    }
    ids.add(template.value);
    getCapabilities(template.value);

    if (template.status === "stable" && (!template.repo || !/^[a-f0-9]{40}$/.test(template.ref ?? "") || !hasFrameworkAdapter(template.value))) {
      throw new Error(
        `Stable template "${template.value}" must provide a repository, full immutable commit and framework adapter.`
      );
    }
  }
}

validateRegistry(templates);

export const TEMPLATE_REGISTRY = Object.freeze(
  templates.map((template) =>
    Object.freeze({
      ...template,
      available: template.status === "stable",
    })
  )
);

export function listTemplates({ includePlanned = true } = {}) {
  return includePlanned
    ? [...TEMPLATE_REGISTRY]
    : TEMPLATE_REGISTRY.filter((template) => template.available);
}

/**
 * Lists the templates whose adapter supports a project target selection.
 *
 * A selection maps to one or more adapter targets (bin/core/project-target.mjs);
 * a template qualifies when its adapter serves any of them — a "universal"
 * project still creates one app at a time, so an adapter for either side is
 * a candidate. Selections no adapter serves yet (today: "mobile") return
 * an empty list; presenting that state is the caller's job.
 *
 * @param {string} selection - A project target selection ("web", "multi-web", "mobile", "universal").
 * @returns {object[]} The matching templates, in registry order.
 */
export function listTemplatesForTarget(selection) {
  const supportedIds = new Set(
    adapterTargetsForSelection(selection).flatMap((target) =>
      listFrameworkAdaptersByTarget(target).map((adapter) => adapter.id)
    )
  );
  return listTemplates().filter((template) => supportedIds.has(template.value));
}

export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY.find((template) => template.value === templateId);
}

export function getAvailableTemplate(templateId) {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown framework "${templateId}".`);
  }
  if (!template.available) {
    throw new Error(`${template.title} support is planned but not available yet.`);
  }
  return template;
}

export function getTemplateProvenance(template) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(template.repo ?? "") ||
      !/^[a-f0-9]{40}$/.test(template.ref ?? "")) {
    throw new Error("Template source must be a GitHub repository and full immutable commit.");
  }
  return {schemaVersion: 1, framework: template.value, repository: template.repo,
    requestedRef: template.ref, resolvedCommit: template.ref};
}
