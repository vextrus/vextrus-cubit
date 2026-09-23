/**
 * I-506, I-353 — the registry pane says a mark once, however many schedules named it
 * (docs/design/s-schedules.md §0 I-506; `familiesViewOf`, src/modules/takeoff/schedules-ui/family-view.ts).
 *
 * F-ARCH states D2 in the ground floor's door schedule AND the typical floors': the store keeps one
 * family under each schedule, and the pane printed two `D2` rows under one React key. The mark is one
 * door type standing on two floor groups, so it is said once with its bands from the ground up — and a
 * mark only one schedule names is the family it always was.
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import type { MemberFamily, MemberVariant } from "@/modules/takeoff/partition";
import { familiesViewOf } from "@/modules/takeoff/schedules-ui/family-view";

/** One opening family as a door schedule's caption bands it (I-506). */
function opening(scheduleKey: string, band: { from: string; to: string }, title: string): MemberFamily {
  const variant: MemberVariant = {
    variantKey: `${band.from}-${band.to}`,
    bandText: title,
    bandFrom: band.from,
    bandTo: band.to,
    sectionText: "3'-0\" X 7'-0\"",
    sectionWidth: 36,
    sectionDepth: 84,
    sectionUnit: "in",
    sourceKeys: [`${scheduleKey}:size`, scheduleKey],
    zones: [],
  };
  return { scheduleKey, family: "D2", markText: "D-2", rowIndex: 3, sourceKeys: [`${scheduleKey}:mark`], variants: [variant] };
}

describe("I-506: one mark, one family, its bands from the ground up", () => {
  test("D2 of the typical floors' schedule and D2 of the ground floor's are one family with two bands, GF first", () => {
    const typical = opening("DXF_HANDLE:81C", { from: "1ST", to: "6TH" }, "DOOR & WINDOW SCHEDULE (1ST TO 6TH FLOOR)  SCALE 1:50");
    const ground = opening("DXF_HANDLE:7FD", { from: "GF", to: "GF" }, "DOOR & WINDOW SCHEDULE (GROUND FLOOR)  SCALE 1:50");
    const views = familiesViewOf([typical, ground]);
    expect(views.map((view) => view.family)).toEqual(["D2"]);
    const [d2] = views;
    expect(d2?.variants.map((variant) => variant.variantKey), "the ground floor first, as a schedule is read").toEqual(["GF-GF", "1ST-6TH"]);
    expect(d2?.variants.map((variant) => variant.bandFace)).toEqual([
      { from: "GF", to: "GF" },
      { from: "1ST", to: "6TH" },
    ]);
    expect(d2?.sourceKeys, "the mark cites every cell that named it").toEqual(["DXF_HANDLE:81C:mark", "DXF_HANDLE:7FD:mark"]);
  });

  test("a mark one schedule names is the family it always was", () => {
    const ground = opening("DXF_HANDLE:7FD", { from: "GF", to: "GF" }, "DOOR & WINDOW SCHEDULE (GROUND FLOOR)  SCALE 1:50");
    const [only] = familiesViewOf([ground]);
    expect(only?.variants.map((variant) => variant.variantKey)).toEqual(["GF-GF"]);
    expect(only?.sourceKeys).toEqual(["DXF_HANDLE:7FD:mark"]);
  });
});
