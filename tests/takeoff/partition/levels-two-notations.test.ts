/**
 * D-001 over the drawings themselves (AM-01's two fixtures, never one for the other).
 *
 * F-RCC6-BNBC's building section (S-25) states its storeys in two notations — `GF EL +0.000` …
 * `ROOF EL +21.641` on the right, `P.L= +0'-0"`, `E.G.L (-1'-6")`, `EL +11'-0"` and a bare `+3.353` on
 * the left — and the Bible's trap register expects them to "resolve to one level stack" (T-NOT-LEVEL).
 * F-RCC6's section states its storeys in one, and its proposal must not move by a byte.
 *
 * The texts are read out of the COMMITTED DXF, by the handles the product's own partition assigns to
 * each section view (measured over the cad CLI's EntityGraph: `MEMBER_SECTION:DXF_HANDLE:1D96`, 13
 * texts of 78 entities; `MEMBER_SECTION:DXF_HANDLE:669`, 11 of 86), with their strings and insertion
 * points exactly as drawn. The one-view assignment is staged here because the partition is its own
 * stage and its own proof; what is guarded is that no model-space text inside the section's own
 * extent was left out of it. No database, no CLI: the unit lane reads bytes (L-CAD-03, B-19).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { carryToMetres, readingKey, storeyHeightStanding } from "@/core/levels";
import { exact } from "@/core/units/canon";
import type { ProposedLevelRow } from "@/modules/takeoff/partition/levels-proposal/propose";
import { REPO_ROOT, rcc6Section, s25Section } from "./support/section-texts";

/** S-25's building section, F-RCC6-BNBC: eight storey marks, four figures on the left, the caption. */
const S25 = s25Section();

/** F-RCC6's section A-A: eight storey marks, the ground's word, the caption and its note. */
const RCC6 = rcc6Section();

/** The generator's independent model of F-RCC6-BNBC: its storey heights, in millimetres (AM-01). */
const MODEL_STOREYS = (JSON.parse(readFileSync(join(REPO_ROOT, "fixtures", "rcc6-bnbc", "model.json"), "utf8")) as { storeys: Record<string, string> }).storeys;

describe("the sections are read whole", () => {
  test("no model-space text drawn inside either section's extent is left out of it", () => {
    expect(new Set(S25.inside), "S-25's building section").toEqual(new Set(S25.handles));
    expect(new Set(RCC6.inside), "F-RCC6's section A-A").toEqual(new Set(RCC6.handles));
  });
});

describe("D-001 on F-RCC6-BNBC S-25: two notations, one level stack", () => {
  test("each storey is proposed once, and the ground storey's height is read again off the imperial marks", () => {
    const stack = S25.proposed;
    expect(stack.map((level) => level.label), "the eight storeys the section marks, once each — no imperial figure is a storey of its own (T-NOT-LEVEL)").toEqual([
      "GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF",
    ]);
    expect(stack.map((level) => level.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(stack.map((level) => level.markKey), "each cites its own metric mark").toEqual(["1D4A", "1D4C", "1D4E", "1D50", "1D52", "1D54", "1D56", "1D58"].map((handle) => `DXF_HANDLE:${handle}`));
    expect(stack.map((level) => level.heightAsWritten), "the metric marks write no unit, so their heights stay a person's to transcribe (B-07)").toEqual(Array(8).fill(null));
    expect(
      stack[0]?.otherNotation,
      "P.L= +0'-0\" is drawn 180 above GF's line and EL +11'-0\" 180 above 1F's: GF stands 11'-0\" (132 in), cited to GF's own imperial mark",
    ).toEqual({ heightAsWritten: "132", heightUnit: "in", markKey: "DXF_HANDLE:1D90", elevation: 0 });
    expect(
      stack.slice(1).filter((level) => level.otherNotation !== undefined),
      "no other storey has two imperial marks to difference — the E.G.L is the site, and 1F's imperial mark has none above it",
    ).toEqual([]);
  });

  test("with the section's metric figures transcribed, every storey stands at the model's height — GF at 3.3528 m on both readings", () => {
    const stack = S25.proposed;
    const actor = "00000000-0000-4000-8000-000000000900";
    for (const [at, level] of stack.slice(0, -1).entries()) {
      const above = stack[at + 1] as ProposedLevelRow;
      const levelId = `00000000-0000-4000-8000-00000000000${String(at + 1)}`;
      // What J-000's walk transcribes: the distance to the mark above in the metres the section's EL
      // figures are printed in, citing the mark it is read off (TRANSCRIBED, L-QTY-01).
      const metric = carryToMetres(exact(above.elevation).sub(level.elevation).toString(), "m");
      const readings = [
        { ...metric, basis: "TRANSCRIBED", sourceKey: above.markKey, readingKey: readingKey({ levelId, actorId: actor, basis: "TRANSCRIBED", sourceKey: above.markKey }) },
        ...(level.otherNotation === undefined
          ? []
          : [
              {
                ...carryToMetres(level.otherNotation.heightAsWritten, level.otherNotation.heightUnit),
                basis: "TRANSCRIBED",
                sourceKey: level.otherNotation.markKey,
                readingKey: readingKey({ levelId, actorId: actor, basis: "TRANSCRIBED", sourceKey: level.otherNotation.markKey }),
              },
            ]),
      ];
      const standing = storeyHeightStanding(readings);
      const model = exact(MODEL_STOREYS[level.label] as string).div(1000);
      expect(standing.standing, `${level.label} stands agreed on ${String(readings.length)} reading(s)`).toBe("AGREED");
      expect(exact(standing.canonicalMetres as string).eq(model), `${level.label} stands at ${standing.canonicalMetres ?? "—"} m; F-RCC6-BNBC model.json storeys says ${model.toString()} m`).toBe(true);
    }
    const gf = stack[0] as ProposedLevelRow;
    expect(exact(carryToMetres(exact((stack[1] as ProposedLevelRow).elevation).sub(gf.elevation).toString(), "m").canonicalMetres).toString(), "the metric print alone would bill GF at 3.353 m").toBe("3.353");
  });
});

describe("F-RCC6's section states one notation, and proposes exactly what it always did", () => {
  test("the eight storeys, their elevations, no height and no second reading — row for row", () => {
    const expected = [
      ["FDN", -1.5, "5AC"],
      ["GF", 0, "5AE"],
      ["1F", 3, "5B0"],
      ["2F", 6, "5B2"],
      ["3F", 9, "5B4"],
      ["4F", 12, "5B6"],
      ["5F", 15, "5B8"],
      ["ROOF", 18, "5BA"],
    ] as const;
    expect(RCC6.proposed, "strictly: an added key, even an undefined one, fails here").toStrictEqual(
      expected.map(([label, elevation, handle], ordinal) => ({
        viewKey: "MEMBER_SECTION:DXF_HANDLE:669",
        label,
        ordinal,
        elevation,
        heightAsWritten: null,
        heightUnit: null,
        markKey: `DXF_HANDLE:${handle}`,
      })),
    );
  });
});
