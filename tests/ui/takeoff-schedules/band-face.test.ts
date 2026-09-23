/**
 * I-436 — the registry's Band cell says a band of floors, never a sheet title
 * (docs/design/s-schedules.md §0 I-436, I-sch-1(c), I-343; L-CAD-08).
 *
 * The store keeps a long-section strip family's band text as the whole title of the sheet its strips
 * stand on — F-RCC6-BNBC's S-16 and S-17 put `1ST FLOOR BEAM LONG SECTIONS - TOP, BOTTOM AND EXTRA
 * BARS` and `TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)` under Band on 106 beam rows. Which
 * stored text is itself a band is the notation's answer (`parseFloorZone`); the ends a strip family
 * was banded at are read here by the reader the strip stage reads them with (`levelWordsOf`), never
 * typed as the ends it would return, so the face is proved over what the registry in fact stores
 * (B-17, B-19). The texts are the ones the J-000 BNBC project stores (read back through db_read).
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import { describe, expect, test } from "vitest";
import { parseFloorZone } from "@/modules/takeoff/partition/notation";
import { levelWordsOf } from "@/modules/takeoff/partition/placement/law";
import type { MemberFamily, MemberVariant } from "@/modules/takeoff/partition";
import { bandFaceOf, familyViewOf, type BandedText } from "@/modules/takeoff/schedules-ui/family-view";

/** A column schedule's band cell, as the registry stores it: the words, and the ends the grammar read. */
function columnBand(bandText: string): BandedText {
  const band = parseFloorZone(bandText);
  return { bandText, bandFrom: band?.from ?? null, bandTo: band?.to ?? null };
}

/** A strip family's band, as the strip stage stores it: the sheet's title, banded first level to last. */
function stripBand(title: string): BandedText {
  const levels = levelWordsOf(title);
  return { bandText: title, bandFrom: levels[0] ?? null, bandTo: levels[levels.length - 1] ?? null };
}

/** The two strip sheets' titles F-RCC6-BNBC states (I-343). */
const FIRST_FLOOR_TITLE = "1ST FLOOR BEAM LONG SECTIONS - TOP, BOTTOM AND EXTRA BARS";
const TYPICAL_TITLE = "TYPICAL FLOOR BEAM LONG SECTIONS (2ND TO 6TH FLOOR)";

describe("I-436: a band the notation reads is said as the schedule wrote it", () => {
  test("F-RCC6-BNBC's column bands stand verbatim — a list, a range, and a range to the building's own label", () => {
    for (const text of ["GF TO 2ND", "3RD & 4TH", "5TH TO 6TH", "ROOF-SRR", "FDN"]) {
      const stored = columnBand(text);
      expect(stored.bandFrom, `the grammar reads a band out of "${text}" — the test stands on what the registry stores`).not.toBeNull();
      expect(bandFaceOf(stored)).toEqual({ written: text });
    }
  });
});

describe("I-436: a band read off a sheet's title is said by its ends", () => {
  test("the first floor's strips say the one floor their sheet names", () => {
    const stored = stripBand(FIRST_FLOOR_TITLE);
    expect(stored.bandFrom, "the strip stage bands this title").not.toBeNull();
    expect(parseFloorZone(FIRST_FLOOR_TITLE), "and the title is no band the notation reads").toBeNull();
    const face = bandFaceOf(stored);
    expect(face).toEqual({ from: stored.bandFrom, to: stored.bandTo });
    expect(face !== null && "from" in face ? [face.from, face.to] : [], "the grammar's own spelling of the one floor").toEqual(["1ST", "1ST"]);
  });

  test("the typical floors' strips say where their band starts and ends", () => {
    const stored = stripBand(TYPICAL_TITLE);
    expect(parseFloorZone(TYPICAL_TITLE), "the title is no band the notation reads").toBeNull();
    const face = bandFaceOf(stored);
    expect(face !== null && "from" in face ? [face.from, face.to] : [], "the ends the title names, as the grammar spells them").toEqual(["2ND", "6TH"]);
    expect(face !== null && "written" in face, "and the title itself is never the face").toBe(false);
  });
});

describe("I-436: a variant whose schedule states no band of floors has no face", () => {
  test("a beam schedule's section header and a footing schedule's plan header stand under Band as no band", () => {
    for (const text of ["SIZE", "L x B (mm)", ""]) expect(bandFaceOf({ bandText: text, bandFrom: null, bandTo: null }), `"${text}"`).toBeNull();
  });
});

/** One stored variant, as the registry hands the screen's reading one. */
function variant(variantKey: string, banded: BandedText): MemberVariant {
  return { variantKey, ...banded, sectionText: "300x600", sectionWidth: 300, sectionDepth: 600, sectionUnit: "mm", sourceKeys: [`DXF_HANDLE:${variantKey}`], zones: [] };
}

/** One stored family, as the registry hands the screen's reading one. */
function family(mark: string, variants: MemberVariant[]): MemberFamily {
  return { scheduleKey: `schedule:${mark}`, family: mark, markText: mark, rowIndex: 0, sourceKeys: [`DXF_HANDLE:${mark}`], variants };
}

describe("I-436: the screen's reading hands every variant its face, and keeps the stored text beside it", () => {
  test("a strip family, a column family and a beam schedule's family, as the registry stores them", () => {
    const strip = familyViewOf(family("1B1", [variant("1ST", stripBand(FIRST_FLOOR_TITLE))]));
    expect(strip.variants.map((one) => [one.bandFace, one.bandText])).toEqual([[{ from: "1ST", to: "1ST" }, FIRST_FLOOR_TITLE]]);

    const typical = familyViewOf(family("B1", [variant("2ND-6TH", stripBand(TYPICAL_TITLE))]));
    expect(typical.variants.map((one) => [one.bandFace, one.bandText])).toEqual([[{ from: "2ND", to: "6TH" }, TYPICAL_TITLE]]);

    const column = familyViewOf(family("C1", [variant("3RD-4TH", columnBand("3RD & 4TH")), variant("GF-2ND", columnBand("GF TO 2ND"))]));
    expect(column.variants.map((one) => one.bandFace), "bands from the ground up (I-353), each as written").toEqual([{ written: "GF TO 2ND" }, { written: "3RD & 4TH" }]);

    const beam = familyViewOf(family("RB1", [variant("SIZE", { bandText: "SIZE", bandFrom: null, bandTo: null })]));
    expect(beam.variants.map((one) => [one.banded, one.bandFace])).toEqual([[false, null]]);
  });
});
