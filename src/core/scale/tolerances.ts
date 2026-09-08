// The two tolerances L-MEA-05's engine judges by, read off the rule-set edition in force for the
// project (L-MEA-01: "parameters are versioned data in an immutable rule-set edition" — a threshold
// a surface or an engine typed for itself would be a second edition nobody pinned). The edition is
// read through its one view (R-SPINE-012), so what a settings screen shows is what this judges by.
import { projectRulesetView } from "../rulesets/editions";
import type { EditionParameter } from "../rulesets/editions/content";
import { SEED_EDITION_CONTENT } from "../rulesets/seed";
import type { ScaleTolerances } from "./proposals";

/** The parameter keys the edition spells these under — the edition's vocabulary, not this file's. */
const VERIFICATION_PARAMETER = "scaleVerificationTolerance";
const ANISOTROPY_PARAMETER = "scaleAnisotropyTolerance";

/** The unit both tolerances are carried in: a share of the reference factor. */
const RATIO_UNIT = "ratio";

/** A tolerance as an edition may spell one: a non-negative decimal. */
const TOLERANCE_VALUE = /^[0-9]+(?:\.[0-9]+)?$/;

/**
 * The scale tolerances in force for one project. A project pinned to an edition is judged by that
 * edition's parameters. L-REG-07 forks every pin platform → tenant → project at creation, so the
 * platform edition is the head of every chain and the content a project's own pin is a verbatim
 * copy of until somebody authors a fork; a project the store holds no pin for is judged by that
 * head rather than by nothing — the one edition every project in the product descends from.
 *
 * An edition that carries no such parameter, or carries it in another unit, is an inconsistency of
 * the store — the seed carries both — and is a plain Error rather than a refusal (ARCH-03).
 */
export async function scaleTolerancesOf(scope: { readonly tenantId: string; readonly projectId: string }): Promise<ScaleTolerances> {
  const edition = await projectRulesetView(scope);
  const parameters = edition.pinned ? edition.parameters : SEED_EDITION_CONTENT.parameters;
  return {
    verification: parameterOf(parameters, VERIFICATION_PARAMETER),
    anisotropy: parameterOf(parameters, ANISOTROPY_PARAMETER),
  };
}

/** One tolerance off an edition's parameters, checked to be the ratio the law reads it as. */
function parameterOf(parameters: Readonly<Record<string, EditionParameter>>, key: string): string {
  const held = parameters[key];
  if (held === undefined) throw new Error(`the rule-set edition in force carries no ${key}, so L-MEA-05's scale engine has no tolerance to judge by (L-MEA-01)`);
  if (held.unit !== RATIO_UNIT || !TOLERANCE_VALUE.test(held.value)) {
    throw new Error(`the rule-set edition in force spells ${key} as ${held.value} ${held.unit}, and a scale tolerance is a ratio (L-MEA-01)`);
  }
  return held.value;
}
