// R-AI-005: "per-project model spend, calls, and outcomes on the project home". One project's answer,
// gathered where a surface asks for it — the ledger's own totals plus what its proposals came to.
//
// The money and the counts are the ledger's, derived by `modelSpendByProject` and not re-derived
// here (B-17): a second sum over `model_calls` would be a second answer about the same money. What
// this door adds is the join with R-AI-001's dispositions, which the AI module owns.
import { forTenant, modelSpendByProject } from "../../../core/db";
import { minimalDecimal } from "../../../core/model-ledger.types";
import { dispositionCountsOf } from "../sheet-understanding";

/** Which project's spend is being asked for, in whose workspace. */
export type ProjectAiSpendScope = { tenantId: string; projectId: string };

/**
 * What one project has spent on model calls and what came of them: how many calls were made, how
 * they ended, the tokens they spent, the money attributed for them, and how the readings they
 * proposed were dispositioned.
 */
export type ProjectAiSpend = {
  readonly projectId: string;
  readonly calls: number;
  readonly proposed: number;
  readonly refused: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Money as an exact decimal string, in the ledger's one spelling (B-17) — never a float. */
  readonly attributedCost: string;
  readonly accepted: number;
  readonly edited: number;
  readonly rejected: number;
};

/** Nothing spent, spelled the one way the ledger spells money — `minimalDecimal`'s own zero. */
const NOTHING_SPENT = minimalDecimal("0");

/**
 * One project's AI spend (R-AI-005).
 *
 * A project nobody has called a model for answers zeros rather than nothing: the surface that shows
 * this is a project home, and "no calls yet" is a fact it states — an absent answer would leave it
 * unable to tell that from a read that failed (R-UI-050's reading of an empty surface).
 */
export async function projectAiSpendOf(scope: ProjectAiSpendScope): Promise<ProjectAiSpend> {
  const ledger = (await modelSpendByProject(forTenant({ tenantId: scope.tenantId }))).find((entry) => entry.projectId === scope.projectId);
  const dispositions = await dispositionCountsOf(scope);

  return Object.freeze({
    projectId: scope.projectId,
    calls: ledger?.calls ?? 0,
    proposed: ledger?.proposed ?? 0,
    refused: ledger?.refused ?? 0,
    inputTokens: ledger?.inputTokens ?? 0,
    outputTokens: ledger?.outputTokens ?? 0,
    attributedCost: ledger?.attributedCost ?? NOTHING_SPENT,
    accepted: dispositions.accepted,
    edited: dispositions.edited,
    rejected: dispositions.rejected,
  });
}
