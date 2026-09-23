/**
 * BOQ-SHAPE — what makes a reading an ISSUE is the day it went out, in the document's zone and words
 * (s-boq I-530, L-FMT-01, R-SPINE-040: the template reads no clock, the issuer stamps the day).
 *
 * Nothing here opens a database or renders a document, and nothing measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { BOQ_DRAFT_KIND } from "@/core/documents/kinds/boq-draft";
import { boqDraftPayloadOf } from "@/modules/takeoff/boq/emission";
import { stampIssue } from "@/modules/takeoff/boq/job";

const read = boqDraftPayloadOf({
  project: "Bashundhara G+6",
  campaignId: "c-1",
  setRevisionId: "r-1",
  levels: [{ levelId: "l-gf", ordinal: 0, label: "GF" }],
  lines: [{ lineId: "a", objectKey: "C1", class: "column", kind: "rcc.concrete", levelId: "l-gf", value: "0.4572", unit: "m3", quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED", coverage: "COMPLETE" }],
  coverageComplete: true,
  front: { client: null, site: null, drawingSet: "Golden Path Set, revision 1, pinned 23 Sep 2026", drawings: ["rcc6-bnbc.dxf"], issued: null },
});

describe("I-530: the issue stamps its day in the document's zone", () => {
  test("an instant late on the 23rd in UTC is the 24th in Dhaka, and the paper says the 24th", () => {
    const issued = stampIssue(read, new Date("2026-09-23T20:30:00Z"));
    expect(issued.front?.issued, "the day the issue went out, DD MMM YYYY, in Asia/Dhaka").toBe("24 Sep 2026");
    expect(issued.front?.drawingSet, "and nothing else the reading said is touched").toBe(read.front?.drawingSet);
    expect(read.front?.issued, "the reading itself stays unissued").toBeNull();
    expect(BOQ_DRAFT_KIND.payloadSchema.safeParse(issued).success, "the kind's schema reads the stamped payload").toBe(true);
  });

  test("a reading with no front matter still gets its issue day, and states nothing else it does not know", () => {
    const bare = { ...read };
    delete (bare as { front?: unknown }).front;
    const issued = stampIssue(bare, new Date("2026-09-24T03:00:00Z"));
    expect(issued.front, "the day, and nothing invented beside it").toEqual({ client: null, site: null, drawingSet: null, drawings: [], issued: "24 Sep 2026" });
  });
});
