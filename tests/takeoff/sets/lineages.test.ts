/**
 * AC-1 — a drawing is the lineage of rows one project stores under one presented name, and each
 * distinct sha256 in that lineage is a revision (R-TO-005, L-REG-06, I-95/I-A).
 *
 * The rows are staged so that the two orders the rule names DISAGREE: the oldest row of each
 * lineage carries the HIGHEST surrogate id, so a reading that ordered by id rather than by arrival
 * answers the wrong drawing every time instead of half the time. Every expectation is derived from
 * the rows staged in this run — nothing here transcribes a digest, a count or a roster (B-19).
 *
 * Staged lazily and memoised: a throwing hook leaves every case skipped, and a skipped case judges
 * no criterion at all.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  byCodePoint,
  closeStage,
  grantRole,
  openSheetsStage,
  setsSeam,
  stageLineage,
  stagePerson,
  stageProject,
  unique,
  type DrawingLineage,
  type Person,
  type SetsSeam,
  type StagedRow,
} from "./support/sets-stage";

/** One scratch database, the rows this file stages, and the doors it drives them through. */
const BUDGET_MS = 300_000;

interface Staged {
  sets: SetsSeam;
  person: Person;
  projectId: string;
  scope: { tenantId: string; projectId: string };
  revved: { name: string; rows: StagedRow[] };
  single: { name: string; rows: StagedRow[] };
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const sets = await setsSeam();
    await openSheetsStage();
    const { person, projectId } = await stagePerson("lineage");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    // Two names: one stored twice with different content, one stored once. A lineage that swallowed
    // every row of the project would fail the second, and one keyed on the row would fail the first.
    const revvedName = unique("lineage-revved.dxf");
    const singleName = unique("lineage-single.dxf");
    const revved = await stageLineage(person, projectId, revvedName, ["revision-a", "revision-b"]);
    const single = await stageLineage(person, projectId, singleName, ["only-one"]);

    return {
      sets,
      person,
      projectId,
      scope: { tenantId: person.tenantId, projectId },
      revved: { name: revvedName, rows: revved },
      single: { name: singleName, rows: single },
    };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The one lineage the module answers for a presented name, refused where it answers none or many. */
function lineageNamed(lineages: readonly DrawingLineage[], name: string): DrawingLineage {
  const found = lineages.filter((lineage) => lineage.name === name);
  expect(found.length, `the module answers exactly ONE lineage for the presented name ${name} — a drawing is the lineage, never the row (I-95)`).toBe(1);
  return found[0] as DrawingLineage;
}

describe("AC-1: drawing revisions by content hash", () => {
  test("AC-1: two rows under one name are one drawing with two revisions, oldest first", async () => {
    const stage = await staged();
    const lineages = await stage.sets.drawingLineagesOf(stage.scope);
    const lineage = lineageNamed(lineages, stage.revved.name);
    const [first, second] = stage.revved.rows as [StagedRow, StagedRow];

    expect(
      lineage.revisions.map((revision) => revision.sha256),
      "one revision per distinct sha256 the lineage holds, in first-appearance order — the content hash IS the revision (R-TO-005)",
    ).toEqual([first.sha256, second.sha256]);
    expect(
      lineage.revisions.map((revision) => revision.ordinal),
      "the ordinals are 1-based and count the revisions in the order they arrived",
    ).toEqual([1, 2]);
    expect(
      lineage.revisions.map((revision) => revision.revisionId),
      "each row's own drawing_id names the revision that row brought (I-A: both halves of L-REG-06's pair are ids the schema already mints)",
    ).toEqual([first.drawingId, second.drawingId]);

    expect(lineage.drawingId, "the FIRST row's drawing_id names the drawing — the surrogate id a manifest cites (L-REG-06)").toBe(first.drawingId);
    expect(lineage.current.revisionId, "the newest row's revision is the current one").toBe(second.drawingId);
    expect(lineage.current.sha256, "and the content the drawing stands at now is the newest row's").toBe(second.sha256);
    expect(lineage.format, "the lineage carries the format its rows are stored under").toBe("dxf");
  }, BUDGET_MS);

  test("AC-1: a name stored once is a lineage of one, and each name of the project is its own", async () => {
    const stage = await staged();
    const lineages = await stage.sets.drawingLineagesOf(stage.scope);
    const [only] = stage.single.rows as [StagedRow];
    const lineage = lineageNamed(lineages, stage.single.name);

    expect(lineage.revisions.length, "a drawing stored once has one revision — the first upload of a name is that drawing's revision 1").toBe(1);
    expect(lineage.drawingId, "the only row names both the drawing and its one revision").toBe(only.drawingId);
    expect(lineage.current.revisionId, "which is therefore the current revision too").toBe(only.drawingId);
    expect(lineage.current.ordinal, "and it stands at ordinal 1").toBe(1);

    const named = byCodePoint(lineages.map((candidate) => candidate.name));
    expect(named, "every presented name the project holds is one lineage, and no name is answered twice").toEqual(byCodePoint([...new Set(named)]));
    expect(named, "both staged names stand among them").toEqual(expect.arrayContaining(byCodePoint([stage.revved.name, stage.single.name])));
  }, BUDGET_MS);

  test("AC-1: another project's rows of the same name are not this project's lineage", async () => {
    const stage = await staged();
    const elsewhere = stageProject(stage.person.tenantId, `Sets lineage elsewhere ${unique("x")}`);
    await stageLineage(stage.person, elsewhere, stage.revved.name, ["elsewhere"]);

    const lineages = await stage.sets.drawingLineagesOf(stage.scope);
    const lineage = lineageNamed(lineages, stage.revved.name);
    expect(
      lineage.revisions.map((revision) => revision.sha256),
      "a lineage is the rows ONE project stores under one name: another project's rows of that name are another drawing entirely (R-SPINE-004)",
    ).toEqual(stage.revved.rows.map((row) => row.sha256));
  }, BUDGET_MS);
});
