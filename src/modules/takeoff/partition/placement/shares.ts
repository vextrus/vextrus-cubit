// L-MEA-01's placement bands, as this stage reads them: "placement constants are content-scaled
// shares of the minimum grid spacing (rule-set parameters)" (L-CAD-07).
//
// The values are the project's PINNED edition's and nothing else — no default, no constant beside a
// call site. An edition authored with other numbers moves what the stage measures with it, which is
// the whole point of rules as data: a threshold written into code is a rule nobody can version
// (L-MEA-01, B-19).
import { projectRulesetView } from "@/core/rulesets/editions";

/** The four shares, as the decimal strings the edition states them in (increment interfaces). */
export type PlacementShares = {
  readonly containmentMerge: string;
  readonly nearAnchor: string;
  readonly footprintMin: string;
  readonly footprintMax: string;
};

/**
 * Which parameter of an edition each share is read off. The parameter names are the edition's own
 * vocabulary; the share names are what the stage calls them, and the map between them lives here so
 * neither is spelled twice (B-17).
 */
const SHARE_PARAMETER: Readonly<Record<keyof PlacementShares, string>> = Object.freeze({
  containmentMerge: "placementContainmentMerge",
  nearAnchor: "placementNearAnchor",
  footprintMin: "placementFootprintMin",
  footprintMax: "placementFootprintMax",
});

/** The four share names, in the order the stage's own detail reports them. */
const SHARE_NAMES = Object.keys(SHARE_PARAMETER) as (keyof PlacementShares)[];

/**
 * The shares one project's pin states (L-MEA-01). A project with no pin, and a pinned edition that
 * states none of these, are both inconsistencies of the store rather than answers anybody can act on:
 * L-REG-07 makes an unpinned project unrepresentable and the seed states all four, so a run that
 * found neither would be measuring by numbers nobody authored (ARCH-03).
 */
export async function placementSharesOf(scope: { readonly tenantId: string; readonly projectId: string }): Promise<PlacementShares> {
  const view = await projectRulesetView(scope);
  if (!view.pinned) {
    throw new Error(`project ${scope.projectId} is pinned to no rule-set edition, so the placement shares are stated by nothing (L-REG-07, L-MEA-01)`);
  }
  const read = (share: keyof PlacementShares): string => {
    const parameter = SHARE_PARAMETER[share];
    const held = view.parameters[parameter];
    if (held === undefined) {
      throw new Error(`the pinned rule-set edition states no \`${parameter}\`, so the placement share \`${share}\` is scaled by nothing (L-MEA-01)`);
    }
    return held.value;
  };
  return Object.fromEntries(SHARE_NAMES.map((share) => [share, read(share)])) as unknown as PlacementShares;
}

/**
 * One share as the number it scales by. The edition states a decimal string, and a share the edition
 * did not state as a number is an edition nobody can measure with — said here rather than becoming a
 * `NaN` that quietly places nothing (ARCH-03).
 */
export function shareValue(shares: PlacementShares, share: keyof PlacementShares): number {
  const said = shares[share];
  const value = Number(said);
  if (!Number.isFinite(value)) throw new Error(`the placement share \`${share}\` is stated as "${said}", which is no share of anything (L-MEA-01)`);
  return value;
}
