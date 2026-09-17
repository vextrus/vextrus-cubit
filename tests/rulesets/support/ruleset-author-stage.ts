// The Author edition screen's stage: the pin it forks, and the two doors it is handed.
//
// The section takes `preview` and `commit` as props precisely so a suite can mount what a browser
// mounts and settle it by hand (the s-settings-ruleset precedent). The doors below answer in the
// actions' own types — so a shape that drifts fails to compile here rather than silently passing a
// suite — and record what they were asked, which is how a test says "the act carried the figures the
// reader stated" without reaching inside the component.
import type { AuthorParentEdition, RulesetAuthorSectionProps } from "@/app/(app)/t/[tenant]/p/[project]/settings/ruleset-author/ruleset-author-section";
import type { RefusalCode } from "@/core/errors";

/** Three parameters of the seed's own roster: enough to diff, and each with a unit of its own. */
export const STAGED_PARAMETERS = Object.freeze({
  openingDeductionMinM2: Object.freeze({ value: "0.1", unit: "m2" }),
  memberEndNoDeductMaxCm2: Object.freeze({ value: "500", unit: "cm2" }),
  embeddedDuctNoDeductMaxCm2: Object.freeze({ value: "100", unit: "cm2" }),
});

/** The edition this screen opens on — what L-REG-07's creation pin looks like to a surface. */
export const STAGED_PIN: AuthorParentEdition = Object.freeze({
  identity: Object.freeze({ scope: "project" as const, name: "IS1200_IN", version: "2026.08" }),
  digest: "a3f9c2d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  parameters: STAGED_PARAMETERS,
});

/** The digest the minted edition would carry: another sixty-four hex characters, and not the pin's. */
export const MINTED_DIGEST = "b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3";
export const STAGED_CONSEQUENCE_DIGEST = "d1e2f3a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";

export const STAGED_PROJECT = "5eed0000-0000-4000-8000-0000000000a1";
export const STAGED_RULESET_HREF = "/t/t1/p/p1/settings/ruleset";
export const STAGED_PARTICIPANTS_HREF = "/t/t1/p/p1/settings/participants";

/** What a door was asked, in the order it was asked — the record a reader's statement leaves. */
export interface StagedDoors {
  readonly previewed: { version: string; values: Readonly<Record<string, string>> }[];
  readonly committed: { version: string; values: Readonly<Record<string, string>>; consequenceDigest: string }[];
  readonly preview: RulesetAuthorSectionProps["preview"];
  readonly commit: RulesetAuthorSectionProps["commit"];
}

/**
 * A pair of doors that answer as the server actions do. `refuseWith` makes the preview answer a
 * registered refusal instead of a consequence — the leg I-267 rules: answered in place, no dialog.
 */
export function stageDoors(options: { refuseWith?: RefusalCode } = {}): StagedDoors {
  const previewed: StagedDoors["previewed"] = [];
  const committed: StagedDoors["committed"] = [];
  return {
    previewed,
    committed,
    preview: async (request) => {
      previewed.push({ version: request.version, values: request.values });
      if (options.refuseWith !== undefined) return { previewed: false, refusal: options.refuseWith };
      return {
        previewed: true,
        consequence: {
          actType: "AUTHOR_RULESET_EDITION",
          tenantId: "5eed0000-0000-4000-8000-000000000001",
          projectId: request.projectId,
          rendering: "SUBJECTS",
          subjects: [
            {
              subjectId: request.projectId,
              subjectLabel: `${STAGED_PIN.identity.name} @ ${request.version}`,
              before: [`${STAGED_PIN.identity.name} @ ${STAGED_PIN.identity.version}`, STAGED_PIN.digest],
              after: [`${STAGED_PIN.identity.name} @ ${request.version}`, MINTED_DIGEST],
            },
          ],
        },
        consequenceDigest: STAGED_CONSEQUENCE_DIGEST,
      };
    },
    commit: async (request) => {
      committed.push({ version: request.version, values: request.values, consequenceDigest: request.consequenceDigest });
      return { committed: true, actId: "9c1e0000-0000-4000-8000-00000000ac01" };
    },
  };
}
