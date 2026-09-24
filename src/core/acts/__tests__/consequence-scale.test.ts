// A view's scale in an affirmation's Consequence is bound by the digest (I-566): the rank a view
// stands at is not part of its calibration key, so what the person was shown is what they confirm.
import { describe, expect, test } from "vitest";
import { consequenceDigest, type Consequence, type ScaleOfSubject } from "..";

const KEY = "2e129c698d2eb662e651f95805d7243baae7a58d5c3c8d2c24db5280ffde6b2e";

function affirmation(after: ScaleOfSubject | undefined): Consequence {
  return {
    actType: "AFFIRM_SCALE",
    tenantId: "tenant-1",
    projectId: "project-1",
    rendering: "SUBJECTS",
    subjects: [{ subjectId: "LAYOUT_PLAN:DXF_HANDLE:20AC", before: [], after: [KEY], ...(after === undefined ? {} : { scale: { before: null, after } }) }],
  };
}

const AT = { factorX: "0.001000000000", factorY: "0.001000000000", millimetresX: "1", millimetresY: "1" };

describe("the digest over a scale affirmation", () => {
  test("binds the rank a view is shown standing at", () => {
    expect(consequenceDigest(affirmation({ rank: "DIMENSION_RATIO", ...AT }))).not.toBe(consequenceDigest(affirmation({ rank: "FILE_UNITS", ...AT })));
  });

  test("and a subject that carries no scale digests as it always did", () => {
    expect(consequenceDigest(affirmation(undefined))).not.toBe(consequenceDigest(affirmation({ rank: "FILE_UNITS", ...AT })));
    // Pinned: this is the digest the same Consequence had before scale entered the digest (computed
    // against the base's consequence.ts), so any drift in how other acts digest reds here.
    expect(consequenceDigest(affirmation(undefined))).toBe("c8ff6942d5358809ea4e57acd238b22f4d1f2869506d8b42d999a9f8f3976c87");
  });
});
