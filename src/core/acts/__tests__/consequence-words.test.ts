/**
 * DLG-1 — what the act seam hands the ConsequenceDialog so it can speak a quantity surveyor's words
 * (docs/design/consequence-dialog.md, I-445 and I-446), judged where it is decided: the pure
 * rules, with no store and no screen.
 *
 *   - a storey-height reading states how the level STANDS before and after it lands, by the one
 *     `storeyHeightStanding` the stack itself is read with (L-MEA-07, D-001);
 *   - the lines an act would re-derive are counted by class, kind and level, up the building;
 *   - the digest binds the standing, and is blind to the counting, so a commit that recomputes only
 *     what it binds still carries the digest the person was shown (L-ACT-02).
 */
import { describe, expect, test } from "vitest";
import { canonical, consequenceDigest, type Consequence } from "../consequence";
import { storeyHeightMoved } from "../author-storey-height";
import { groupLines, type GroupableLine } from "../line-groups";
import { createHash } from "node:crypto";

/** A reading as the store keeps it, under a key that says whose it is and how it was made. */
const reading = (key: string, metres: string, extra: Partial<{ basis: string; sourceKey: string | null; valueAsWritten: string; unitAsWritten: string }> = {}) => ({
  readingKey: key,
  canonicalMetres: metres,
  basis: "ENTERED",
  sourceKey: null,
  valueAsWritten: metres,
  unitAsWritten: "m",
  ...extra,
});

describe("I-445: a storey-height reading says how the level stands before and after it", () => {
  test("two agreeing readings and a third that disagrees: agreed at the metres, then suspended over three", () => {
    const held = [reading("a", "3.3528"), reading("b", "3.3528")];
    const moved = storeyHeightMoved(held, reading("c", "3.2"));
    expect(moved.before, "the level stands agreed at its exact metres over two readings").toEqual({ standing: "AGREED", value: "3.3528", unit: "m", readings: 2 });
    expect(moved.after, "a third reading that disagrees suspends it, at no figure (L-REG-03)").toEqual({ standing: "SUSPENDED", value: null, unit: "m", readings: 3 });
    expect(moved.recorded, "and the figure the act records is stated with its unit").toEqual({ value: "3.2", unit: "m" });
  });

  test("a re-affirmation under the same key supersedes the reading it corrects and settles the suspension", () => {
    const held = [reading("a", "3.3528"), reading("b", "3.3528"), reading("c", "3.2")];
    const moved = storeyHeightMoved(held, reading("c", "3.3528"));
    expect(moved.before.standing, "suspended over three readings").toBe("SUSPENDED");
    expect(moved.after, "agreed again, and still three readings — the corrected one is superseded, not added (L-MEA-07)").toEqual({ standing: "AGREED", value: "3.3528", unit: "m", readings: 3 });
  });

  test("the first reading of a level: not stated, then agreed over one", () => {
    const moved = storeyHeightMoved([], reading("a", "3.048"));
    expect(moved.before, "a level nobody read stands at nothing").toEqual({ standing: "NONE", value: null, unit: "m", readings: 0 });
    expect(moved.after).toEqual({ standing: "AGREED", value: "3.048", unit: "m", readings: 1 });
  });

  test("D-001 is honoured: a rounded metric print beside the exact imperial one stays agreed, at the exact metres", () => {
    // 11'-0" as the section's imperial mark carries it: 132 inches, exactly 3.3528 m (L-FRM-06).
    const imperial = reading("print-in", "3.3528", { basis: "TRANSCRIBED", sourceKey: "DXF_HANDLE:1A", valueAsWritten: "132", unitAsWritten: "in" });
    const metric = reading("print-m", "3.353", { basis: "TRANSCRIBED", sourceKey: "DXF_HANDLE:1B", valueAsWritten: "3.353", unitAsWritten: "m" });
    const moved = storeyHeightMoved([imperial], metric);
    expect(moved.after.standing, "the two prints of one height resolve to one standing, as the stack reads them").toBe("AGREED");
    expect(moved.after.value, "carried at the exact print, never the rounded one").toBe("3.3528");
  });
});

/** One line as grouping reads it, standing on a level of the stack unless told otherwise. */
const line = (elementClass: string, kind: string, level: Partial<GroupableLine> = {}): GroupableLine => ({
  elementClass,
  kind,
  levelId: "lvl-gf",
  levelLabel: "GF",
  levelOrdinal: 0,
  levelSlot: null,
  ...level,
});

describe("I-446: the lines an act re-derives, counted as a quantity surveyor counts them", () => {
  const onFirst = { levelId: "lvl-1f", levelLabel: "1F", levelOrdinal: 1 };
  const inFoundation = { levelId: null, levelLabel: null, levelOrdinal: null, levelSlot: "FOUNDATION" };
  const nowhere = { levelId: null, levelLabel: null, levelOrdinal: null };
  const lines: GroupableLine[] = [
    line("column", "rcc.formwork", onFirst),
    line("column", "rcc.concrete"),
    line("beam", "rcc.concrete", nowhere),
    line("column", "rcc.formwork"),
    line("pile_cap", "rcc.concrete", inFoundation),
    line("column", "rcc.concrete"),
    line("column", "rcc.concrete", onFirst),
  ];

  test("one group per (class, kind, level), whose counts add up to every line named", () => {
    const groups = groupLines(lines);
    expect(groups.reduce((sum, group) => sum + group.count, 0), "a group is a reading of the ids, never a filter of them").toBe(lines.length);
    expect(groups.map((group) => [group.description, group.levelLabel ?? group.levelSlot, group.count])).toEqual([
      ["Pile cap · Concrete", "FOUNDATION", 1],
      ["Column · Concrete", "GF", 2],
      ["Column · Formwork", "GF", 1],
      ["Column · Concrete", "1F", 1],
      ["Column · Formwork", "1F", 1],
      ["Beam · Concrete", null, 1],
    ]);
  });

  test("the order is the building's, then the bill's — whatever order the lines arrived in", () => {
    const forward = groupLines(lines);
    const backward = groupLines([...lines].reverse());
    expect(backward, "one set of lines reads one way").toEqual(forward);
    expect(groupLines([]), "no line, no group").toEqual([]);
  });
});

/** A storey-height consequence as the seam answers it, with or without its presentation. */
function heightConsequence(over: { standing?: "suspends" | "settles"; groups?: boolean; label?: string } = {}): Consequence {
  const standing =
    over.standing === undefined
      ? undefined
      : over.standing === "suspends"
        ? storeyHeightMoved([reading("a", "3.3528"), reading("b", "3.3528")], reading("c", "3.2"))
        : storeyHeightMoved([reading("a", "3.3528")], reading("c", "3.2"));
  return {
    actType: "AUTHOR_STOREY_HEIGHT",
    tenantId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    projectId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
    rendering: "SUBJECTS",
    subjects: [{ subjectId: "key-c", subjectLabel: over.label ?? "GF", before: [], after: ["3.2"], ...(standing === undefined ? {} : { standing }) }],
    effects: {
      linesRederiving: ["line-1", "line-2"],
      signaturesVoiding: [],
      ...(over.groups === true ? { lineGroups: groupLines([line("column", "rcc.concrete"), line("column", "rcc.concrete")]) } : {}),
    },
  };
}

describe("L-ACT-02: what the digest binds of the new presentation", () => {
  test("the standing is bound: the same key's reading over a level that would suspend and one that would not are two consequences", () => {
    expect(consequenceDigest(heightConsequence({ standing: "suspends" })), "a person confirmed the standing they were shown (I-44)").not.toBe(
      consequenceDigest(heightConsequence({ standing: "settles" })),
    );
  });

  test("the counting is not: grouped or ungrouped, labelled or not, the same ids digest alike", () => {
    const bare = consequenceDigest(heightConsequence({ standing: "suspends" }));
    expect(consequenceDigest(heightConsequence({ standing: "suspends", groups: true })), "the groups are a reading of the bound ids (I-446)").toBe(bare);
    expect(consequenceDigest(heightConsequence({ standing: "suspends", label: "Ground floor" })), "and a label is presentation, as it always was").toBe(bare);
  });

  test("an act that carries neither digests exactly as it did before DLG-1", () => {
    const plain = heightConsequence();
    // The canonical form the digest was taken over before this slice: the subjects' three facts and
    // the effects object whole — which, for an effects object holding only its two lists, is exactly
    // those two lists.
    const before = createHash("sha256")
      .update(
        canonical({
          actType: plain.actType,
          tenantId: plain.tenantId,
          projectId: plain.projectId,
          rendering: plain.rendering,
          subjects: plain.subjects.map((subject) => ({ subjectId: subject.subjectId, before: subject.before, after: subject.after })),
          effects: plain.effects,
        }),
        "utf8",
      )
      .digest("hex");
    expect(consequenceDigest(plain), "no stored act's digest moves for an act whose consequence carries no standing").toBe(before);
  });
});
