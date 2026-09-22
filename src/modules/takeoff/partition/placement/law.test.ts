// Interpretation I-303's reader, judged on the strings F-RCC6-BNBC actually carries (L-CAD-07, Q-07).
//
// I-303: A PLAN NOTE IS EVIDENCE ABOUT ITS MEMBER. A note naming a mark says that member is not one of
// the plan's typical, so it is not expanded by the view's authored typical range: it stands on the
// level the plan draws, or over the range its own note states. The reading only ever NARROWS a span —
// it may never place a member on a storey the view's span does not reach — so no reading proved here
// can move a published cell in the OVER direction, and L-QTY-06's band (3 % under, 0 % over) is
// approached from the side the law leaves room on.
//
// Two of this fixture's strings are the doors this increment opens:
//   S-10, handle 9BA: `C7 %%C450 PORCH COLUMN`                   — mark C7, a circle, on GF alone
//   S-10, handle 9BC: `C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)` — mark C5, 1F..6F
// and two more are the strings that must read as NO range at all, because each names a mark and then
// names two floors while saying nothing whatever about where a member stands:
//   `C4 3RD-4TH BARS REVISED; ISSUED FO`  — a paper-space revision row
//   `C2 GF TO 2ND:`                       — a heading on the schedule sheet
// Those two are each ALSO excluded from the placement stage outright, by a fence this file does not
// own and therefore proves nothing about: the revision row never reaches the reader because
// `partitionArtifact` takes only MODEL-space entities (`../views/assign.ts:95`), and the schedule
// heading never reaches it because `detectPlacements` examines only views `yieldsInstances` admits —
// the layout plans (`./detect.ts:85`). What IS proved here is the reader's own behaviour behind both
// fences: neither string states a band, so even a fence that failed could not pin the seven C4
// placements to 3F-4F and under-measure the sheet's biggest mark family by five storeys.
//
// Pure: no store, no fixture file, no database. The drawing's words are spelled here, so the reading
// is what is graded and not the extraction.
import { describe, expect, test } from "vitest";
import { type BandStatement, bandCovers, bandOpen, placedBy } from "@/core/offers/contract";
import { isMarkFamily, normaliseMark } from "../notation";
import { bandStatedIn, classOfMark, levelSightingsOf, levelWordsOf, memberNoteOf, soleNotesAmong } from "./law";

/** S-10's two notes, verbatim, control codes and brackets and all. */
const C7_NOTE = "C7 %%C450 PORCH COLUMN";
const C5_NOTE = "C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)";

/** The two strings that name a mark and then name floors while stating no range at all. */
const REVISION_ROW = "C4 3RD-4TH BARS REVISED; ISSUED FO";
const SCHEDULE_HEADING = "C2 GF TO 2ND:";

/**
 * The live stack these bands are read against — the fixture's own seven storeys, GF and 1F..6F, with
 * the ordinal each physically stands at (L-MEA-07: a range over a building is physical).
 */
const LEVELS = [
  { label: "GF", ordinal: 0 },
  { label: "1F", ordinal: 1 },
  { label: "2F", ordinal: 2 },
  { label: "3F", ordinal: 3 },
  { label: "4F", ordinal: 4 },
  { label: "5F", ordinal: 5 },
  { label: "6F", ordinal: 6 },
];

/** That stack's placement, made by core's own rule rather than by a lookup of this file's (B-17). */
const PLACE = placedBy(LEVELS);

/**
 * The labels of that stack one stated band covers, read through core's own `bandCovers`. A band the
 * note never stated covers nothing here — which is not what `bandOpen` would say of a band with both
 * ends open, and is exactly why a note stating no range answers null rather than such a band.
 */
function coveredBy(band: BandStatement | null | undefined): string[] {
  if (band === undefined || band === null) return [];
  return LEVELS.filter((level) => bandCovers(band, level.ordinal, PLACE)).map((level) => level.label);
}

/** Every string this suite reads, for the properties that must hold of ALL of them at once. */
const EVERY_TEXT = [C7_NOTE, C5_NOTE, REVISION_ROW, SCHEDULE_HEADING, "C7", "C7 450", "SW1 SHEAR WALL", "B4 DROP BEAM OVER LOBBY (STARTS AT 2F)"];

describe("a plan's texts partition into marks and notes by construction", () => {
  test("both of the fixture's door strings read as no mark at all today, because a mark is compared with its whitespace stripped", () => {
    // `normaliseMark` is `dotlessUpper` over the folded glyphs (`@/core/identity`), and `dotlessUpper`
    // strips whitespace — so a whole note closes up into one word that `MARK_FAMILY` refuses. This is
    // WHY placing these two members is a door and not a change of reading: nothing reads them now.
    expect(normaliseMark(C7_NOTE)).toBe("C7Ø450PORCHCOLUMN");
    expect(isMarkFamily(C7_NOTE)).toBe(false);
    expect(classOfMark(C7_NOTE)).toBeNull();
    expect(isMarkFamily(C5_NOTE)).toBe(false);
    expect(classOfMark(C5_NOTE)).toBeNull();
  });

  test("a text whose whole content is a mark is the mark reader's and is never read as a note", () => {
    expect(classOfMark("C7")).toBe("column");
    expect(memberNoteOf("C7")).toBeNull();
    expect(memberNoteOf("  SW1  ")).toBeNull();
  });

  test("a text the mark reader takes is refused a note reading even where it carries a second word", () => {
    // Whitespace is the only thing between `C7 450` and the mark `C7450`, and the mark reader compares
    // without it. The guard is explicit rather than left to the shape of the family pattern.
    expect(classOfMark("C7 450")).toBe("column");
    expect(memberNoteOf("C7 450")).toBeNull();
  });

  test("no text is read as both a mark and a note", () => {
    for (const said of EVERY_TEXT) {
      expect(classOfMark(said) === null || memberNoteOf(said) === null).toBe(true);
    }
  });

  test("a note is a mark and at least one further word about it", () => {
    expect(memberNoteOf("")).toBeNull();
    expect(memberNoteOf("   ")).toBeNull();
    expect(memberNoteOf(C7_NOTE)?.mark).toBe("C7");
  });
});

describe("the classes a note is read for", () => {
  test("a first token naming no class this stage places is no note", () => {
    // `S` is nothing and `X` is nothing: the prefix map is closed, and a class guessed from a letter
    // would place a stair flight as a shear wall (L-QTY-04).
    expect(memberNoteOf("S1 STAIR FLIGHT TO 2F")).toBeNull();
    expect(memberNoteOf("X1 SETTING OUT POINT")).toBeNull();
    expect(memberNoteOf("NOTE ALL DIMENSIONS IN MM")).toBeNull();
  });

  test("a note about a framed class is refused, because no outline stands for a beam", () => {
    // A beam is placed off the pair of edge lines it is drawn as (`./runs`), not off an outline near
    // its text — so a note about one has no member here to be evidence about.
    expect(classOfMark("B4")).toBe("beam");
    expect(memberNoteOf("B4 DROP BEAM OVER LOBBY (STARTS AT 2F)")).toBeNull();
    expect(memberNoteOf("TB1 TIE BEAM UNDER PORCH")).toBeNull();
  });

  test("a note names the class its mark names, in the catalogue's own spelling", () => {
    expect(memberNoteOf(C7_NOTE)?.type).toBe("column");
    expect(memberNoteOf("SW1 CORE WALL (STARTS AT 1F)")?.type).toBe("shear_wall");
  });
});

describe("the remainder must state something I-303 can act on", () => {
  test("a mark followed by prose the grammar takes nothing from is not a note", () => {
    // The last fence, and the one that makes the rule safe rather than merely narrow. A note stating
    // no range is NOT inert — I-303's other half puts its member on the level the plan draws and
    // takes every other storey away — so a rule that read any mark-headed sentence as a note would
    // collapse a mark's span on the strength of a draughtsman's aside (L-QTY-01: never a guess).
    expect(memberNoteOf("C4 SEE DETAIL 3/S-12")).toBeNull();
    expect(memberNoteOf("C1 COLUMN")).toBeNull();
    expect(memberNoteOf("C4 COLUMN POSITIONS ARE FACE-FLUSH ON THE OUTER FACE")).toBeNull();
  });

  test("this fixture's own two mark-headed texts are refused by their WORDS, not by where they were drawn", () => {
    // Both name a mark and then name floors, and both are talking about something else — bars, and a
    // schedule band. Two fences outside this reader already keep them out of the stage on THIS
    // drawing (a paper-space text is in no view's assignment map; a SCHEDULE view yields no
    // instances), and neither is a guarantee about the next drawing. A reading that is only safe
    // because of where a text was filed is not a reading.
    expect(memberNoteOf(REVISION_ROW)).toBeNull();
    expect(memberNoteOf(SCHEDULE_HEADING)).toBeNull();
  });

  test("S-23's shear-wall notes are refused here, before the singularity guard has to count them", () => {
    // `SW1 L=2563` states neither a shape nor a range, so it never reaches the guard at all — which
    // is what makes that guard belt-and-braces rather than the only thing standing between this rule
    // and twenty-four members of shear wall.
    expect(memberNoteOf("SW1 L=2563")).toBeNull();
    expect(memberNoteOf("SW1 L=2493")).toBeNull();
  });

  test("the two answers I-303 admits are the two that pass", () => {
    expect(memberNoteOf(C7_NOTE)).not.toBeNull();
    expect(memberNoteOf(C5_NOTE)).not.toBeNull();
  });
});

describe("the range a note states", () => {
  test("a note stating no range answers a null band, which the caller reads as the level the plan draws", () => {
    expect(memberNoteOf(C7_NOTE)?.band).toBeNull();
    expect(bandStatedIn("%%C450 PORCH COLUMN")).toBeNull();
    // Never a band with both ends open, which the stack would read as every storey at once — mark C7
    // would then stand seven times where the plan draws it once, and I-303 may never move a cell over.
    expect(coveredBy(memberNoteOf(C7_NOTE)?.band)).toEqual([]);
  });

  test("STARTS AT 1F states a band open at the top, which is what bandCovers already means", () => {
    expect(memberNoteOf(C5_NOTE)?.band).toEqual({ from: "1F", to: null });
    // Read against the fixture's own stack: 1F..6F and never the ground floor. The open top is no
    // bound, exactly as `bandCovers` documents it — the band runs to the top of what it is read
    // against, which is the whole of mark C5's six members.
    expect(coveredBy(memberNoteOf(C5_NOTE)?.band)).toEqual(["1F", "2F", "3F", "4F", "5F", "6F"]);
  });

  test("a note naming two floors with no bounding word states no range", () => {
    // Both of these NAME floors and say nothing about where a member stands. A rule reading a range
    // out of any two level words would pin the C4 family to two storeys of seven. (Neither reaches
    // `memberNoteOf` at all now — the remainder fence refuses both — but the band reader must answer
    // null on its own account, because it is what that fence asks.)
    expect(bandStatedIn("3RD-4TH BARS REVISED; ISSUED FO")).toBeNull();
    expect(bandStatedIn("GF TO 2ND:")).toBeNull();
  });

  test("exactly one bounding word is admitted, and a word that merely resembles one is not", () => {
    expect(bandStatedIn("STARTS AT 3F")).toEqual({ from: "3F", to: null });
    expect(bandStatedIn("START AT 3F")).toBeNull();
    expect(bandStatedIn("STARTING AT 3F")).toBeNull();
    expect(bandStatedIn("ENDS AT 3F")).toBeNull();
    expect(bandStatedIn("UP TO 3F")).toBeNull();
  });

  test("the level a bounding word bounds is the first one written after it", () => {
    // `OVER TG1` is a beam this column sits on, not the storey it starts at; the word order is the
    // only thing that says so.
    expect(bandStatedIn("FLOATING COLUMN OVER TG1 (STARTS AT 1F)")).toEqual({ from: "1F", to: null });
    expect(bandStatedIn("SITS ON GF SLAB, STARTS AT 2F")).toEqual({ from: "2F", to: null });
  });

  test("a bounding word naming no level after it states no range", () => {
    expect(bandStatedIn("STARTS HIGHER UP")).toBeNull();
    expect(bandStatedIn("1F STARTS")).toBeNull();
  });

  test("no note can ever state a band with both ends open, because an open band covers everything", () => {
    // `bandOpen` means "covers everything" (`contract.ts`), which is the precise OPPOSITE of what a
    // note stating no range says. A note stating no range must therefore answer null, and a band this
    // reader DOES answer must carry a stated start. Asserted over every string this suite reads and
    // over the fixture's own two, so the impossibility is a property and not an example.
    for (const said of [...EVERY_TEXT, "C1 STARTS", "C1 COLUMN", "C1 STARTS AT 4F"]) {
      const band = bandStatedIn(said);
      if (band === null) continue;
      expect(bandOpen(band)).toBe(false);
      expect(band.from).not.toBeNull();
    }
  });
});

describe("the shape a note states", () => {
  test("a note whose remainder yields a diameter states a round member", () => {
    // `%%C` is L-CAD-02's diameter control code and folds to `Ø` before any reading: the plan states
    // the SHAPE and the schedule states the SIZE, and `450x450` beside `Ø450` is not a disagreement.
    expect(memberNoteOf(C7_NOTE)?.shape).toBe("ROUND");
    expect(memberNoteOf("C9 Ø300 CIRCULAR COLUMN")?.shape).toBe("ROUND");
  });

  test("a note stating no diameter states no shape", () => {
    expect(memberNoteOf(C5_NOTE)?.shape).toBeNull();
    expect(memberNoteOf("C9 COLUMN (STARTS AT 2F)")?.shape).toBeNull();
  });

  test("the mark's own token is never read for a shape", () => {
    // The remainder ALONE is put to the diameter reader, so a mark that happens to spell a number is
    // not a circle — and with nothing else stated, `C450 PORCH COLUMN` is not a note at all. Were the
    // mark's own token read here it would state ROUND, pass the remainder fence on that reading, and
    // put a 450 mm circle where the drawing drew a mark.
    expect(memberNoteOf("C450 PORCH COLUMN")).toBeNull();
  });
});

describe("the note half of I-303's singularity guard", () => {
  test("a mark two notes name is excepted by neither of them", () => {
    // S-23's LIFT CORE PLAN writes two notes naming SW1, neither stating a storey. Letting either one
    // except the mark would collapse every shear wall of that core onto one level — the over-narrowing
    // I-303 exists to forbid.
    // Both of these DO state something I-303 acts on — one a shape, one a range — so both clear the
    // remainder fence and the guard is the only thing left standing between them and the mark.
    const notes = [memberNoteOf("SW1 Ø300 CORE WALL"), memberNoteOf("SW1 CORE WALL (STARTS AT 2F)")].flatMap((note) => note ?? []);
    expect(notes).toHaveLength(2);
    expect(soleNotesAmong(notes).has("SW1")).toBe(false);
  });

  test("a mark exactly one note names is that note's to except", () => {
    const notes = [memberNoteOf(C5_NOTE), memberNoteOf(C7_NOTE), memberNoteOf("SW1 CORE WALL"), memberNoteOf("SW1 200 THK")].flatMap((note) => note ?? []);
    const sole = soleNotesAmong(notes);
    expect([...sole.keys()].toSorted()).toEqual(["C5", "C7"]);
    expect(sole.get("C5")?.band).toEqual({ from: "1F", to: null });
    expect(sole.get("C7")?.band).toBeNull();
  });

  test("the guard's other half is the stage's: which members a mark names is not a fact about the notes", () => {
    // Named here so the division is written down somewhere. `soleNotesAmong` answers only that the
    // NOTES single the mark out; that the mark names exactly one member is read off the placements the
    // stage holds, beside its own roster.
    const sole = soleNotesAmong([memberNoteOf(C7_NOTE)].flatMap((note) => note ?? []));
    expect(sole.get("C7")?.mark).toBe("C7");
  });
});

describe("the level words a text says", () => {
  test("levelWordsOf still answers the levels alone, in the order the drawing wrote them", () => {
    expect(levelWordsOf("TYPICAL FLOOR PLAN (1ST TO 6TH)")).toEqual(["1ST", "6TH"]);
    expect(levelWordsOf(REVISION_ROW)).toEqual(["3RD", "4TH"]);
    expect(levelWordsOf(SCHEDULE_HEADING)).toEqual(["GF", "2ND"]);
    expect(levelWordsOf(C5_NOTE)).toEqual(["1F"]);
    expect(levelWordsOf(C7_NOTE)).toEqual([]);
  });

  test("the sightings keep every word, so a bounding word standing among levels can still be seen", () => {
    expect(levelSightingsOf("(STARTS AT 1F)")).toEqual([
      { word: "STARTS", level: null },
      { word: "AT", level: null },
      { word: "1F", level: "1F" },
    ]);
  });

  test("levelWordsOf is exactly the sightings that named a level", () => {
    for (const said of [...EVERY_TEXT, "TYPICAL FLOOR PLAN (1ST TO 6TH)"]) {
      expect(levelWordsOf(said)).toEqual(levelSightingsOf(said).flatMap((sighting) => sighting.level ?? []));
    }
  });
});
