import { reactFamilyGenerator } from "./react.mjs";
import { svelteFamilyGenerator } from "./svelte.mjs";
import { vueFamilyGenerator } from "./vue.mjs";

/**
 * The shared family generator interface.
 *
 * A family generator builds the file plan for one generated slice
 * (`fsd generate <type> <name>`). Every framework family implements the
 * same interface, so the generate flow never branches on the family: it
 * resolves the adapter's family to a generator here and calls
 * `createFilePlan`. Before this registry existed, `bin/generator.mjs`
 * imported the Vue and Svelte planners directly and kept the React
 * planner inline; the three implementations now sit side by side behind
 * one contract.
 *
 * @typedef {object} FamilyGenerator
 * @property {string} family - Framework family this generator serves
 *   ("react", "vue", "svelte"). Matches the adapter contract's `family`.
 * @property {(type: string, name: string, config: object) => object[]} createFilePlan -
 *   Builds the planned files for a slice: an array of file entries as
 *   produced by `file()` in `./shared.mjs`.
 */

const familyGenerators = new Map(
  [reactFamilyGenerator, vueFamilyGenerator, svelteFamilyGenerator].map((generator) => [
    generator.family,
    generator,
  ])
);

/**
 * @param {string} family - Framework family from the adapter contract.
 * @returns {FamilyGenerator} The family's generator.
 */
export function getFamilyGenerator(family) {
  const generator = familyGenerators.get(family);
  if (!generator) {
    throw new Error(`Framework family "${family}" does not have a generator implementation yet.`);
  }
  return generator;
}

/**
 * @param {string} family - Framework family from the adapter contract.
 * @returns {boolean} Whether the family has a generator implementation.
 */
export function hasFamilyGenerator(family) {
  return familyGenerators.has(family);
}

/**
 * @returns {FamilyGenerator[]} Every registered family generator.
 */
export function listFamilyGenerators() {
  return [...familyGenerators.values()];
}
