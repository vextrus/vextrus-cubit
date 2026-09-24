/**
 * SRCH-1b — ⌘K 'C2' over F-RCC6-BNBC as the product stores it: read by the shipped `cad/` CLI,
 * written by the shipped ingest job, partitioned by the shipped job, pinned through the one act seam,
 * its proposed storeys inserted as the live stack, and partitioned AGAIN — so every placement row the
 * search reads was written AFTER the revision was pinned, the order session 8 suspected left the
 * pinned record without the members' placements (docs/design/command-palette.md I-632).
 *
 * The door is called through the router's own caller, with a context minted by the shipped
 * `createContext` off a request carrying the principal's real cookie. Every expectation is read off
 * what the stage stored — the placement rows' outline and mark keys, the register rows under the
 * pinned revision — never transcribed (B-19).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { dotlessUpper } from "@/core/identity";
import {
  bnbcArtifact,
  closeStage,
  pinRevisionNaming,
  placementRows,
  proposedLevelRows,
  registerObjectRows,
  runPlacementPartition,
  said,
  stageArtifactIngest,
  stagePlacementProject,
  stageStack,
  type PlacementStage,
  type StoreRow,
} from "../takeoff/partition/support/placement-stage";

const MARK = "C2";

/** A hit as the door answers one — loose, so this file typechecks against the tree, not through it. */
interface Hit {
  kind: string;
  label: string;
  projectId: string;
  drawingId?: string | null;
  layoutName?: string | null;
  sourceKey?: string | null;
  selection?: readonly string[] | null;
  sheetLabel?: string | null;
  elementType?: string | null;
  count?: number | null;
}
type Search = (input: { tenantId: string; query: string; projectId?: string | null }) => Promise<{ hits: readonly Hit[]; refusal?: string | null }>;

let stage: PlacementStage;
let staged: { drawingId: string; ingestId: string };
let setRevisionId: string;
let placed: StoreRow[];
let answer: { hits: readonly Hit[]; refusal?: string | null };

beforeAll(async () => {
  stage = await stagePlacementProject("search-bnbc");
  staged = await stageArtifactIngest(stage, await bnbcArtifact(), "search-bnbc");
  // The first partition proposes the storeys the drawing names; nothing is pinned yet, so it
  // registers nothing.
  await runPlacementPartition(stage, staged, "search-bnbc-at-ingest");
  // One storey per label: each view that states the stack proposes it again.
  const byLabel = new Map<string, number>();
  for (const row of proposedLevelRows(stage.person.tenantId, staged.ingestId)) {
    const label = String(row["label"]);
    const ordinal = Number(row["ordinal"]);
    byLabel.set(label, Math.min(byLabel.get(label) ?? ordinal, ordinal));
  }
  const proposed = [...byLabel].map(([label, ordinal]) => ({ label, ordinal })).sort((left, right) => left.ordinal - right.ordinal);
  expect(proposed.length, "the partition proposed BNBC's storeys").toBeGreaterThan(1);

  // The pin FIRST, then the stack, then the partition again: its placement rows are rewritten after
  // the pin, and its register pass registers them under the pinned revision in the same job.
  setRevisionId = await pinRevisionNaming(stage, staged.drawingId);
  await stageStack(stage, proposed.map((level) => level.label), proposed[0]?.ordinal ?? 1);
  await runPlacementPartition(stage, staged, "search-bnbc-after-pin");
  placed = placementRows(stage.person.tenantId, staged.ingestId);

  const { createContext } = await import("@/server/context");
  const { spineRouter } = await import("@/server/routers/spine");
  const request = new Request("http://127.0.0.1/api/trpc/spine.search", { headers: { cookie: stage.person.cookie } });
  const caller = spineRouter.createCaller(await createContext({ req: request })) as unknown as { search: Search };
  answer = await caller.search({ tenantId: stage.person.tenantId, projectId: stage.projectId, query: MARK });
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("SRCH-1b: ⌘K 'C2' on the staged BNBC project answers the member with its drawing, its sheet and its selection", () => {
  test("the register holds C2 under the pinned revision, placed after the pin — the case the suspicion names", () => {
    const members = placed.filter((row) => dotlessUpper(String(row["mark"])) === MARK);
    expect(members.length, "the partition placed BNBC's C2 columns").toBeGreaterThan(0);
    const keys = new Set(members.map((row) => said(row, "placementKey", "placement_key")));
    const registered = registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => keys.has(said(row, "placementKey", "placement_key")));
    expect(registered.length, "every C2 placement is registered under the revision pinned before it was written").toBeGreaterThanOrEqual(keys.size);
  });

  test("each mark find names the drawing, a numbered sheet and the members' outlines and marks standing on it; together they carry every C2 row", () => {
    expect(answer.refusal ?? null, "the principal is refused nothing").toBeNull();
    const marks = answer.hits.filter((hit) => hit.kind === "mark");
    expect(marks.length, `C2 is found as a mark: ${JSON.stringify(answer.hits.map((hit) => [hit.kind, hit.label]))}`).toBeGreaterThan(0);

    const members = placed.filter((row) => dotlessUpper(String(row["mark"])) === MARK);
    const drawn = new Set(members.flatMap((row) => [said(row, "outlineKey", "outline_key"), said(row, "markKey", "mark_key")]));
    const placementKeys = new Set(members.map((row) => said(row, "placementKey", "placement_key")));
    const rows = registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => placementKeys.has(said(row, "placementKey", "placement_key")));

    const selected = new Set<string>();
    for (const mark of marks) {
      expect(mark.label, "the mark as the register holds it").toBe(MARK);
      expect(mark.drawingId, "on the drawing the campaign pinned — never unresolved, which sent the click to the register").toBe(staged.drawingId);
      expect(mark.layoutName ?? "", "on a sheet").not.toBe("");
      expect(mark.sheetLabel ?? "", `named by its number: ${JSON.stringify(mark)}`).not.toBe("");
      expect(mark.selection?.length ?? 0, "selecting what the member was read off").toBeGreaterThan(0);
      for (const key of mark.selection ?? []) {
        expect(drawn.has(key), `${key} is a C2 member's outline or mark`).toBe(true);
        selected.add(key);
      }
    }
    expect([...selected].sort(), "every C2 member's outline and mark is selected by a find").toEqual([...drawn].sort());
    // The sheet the members stand on is the sheet the sheet-text reader stands their painted marks
    // on — two readers of the record agreeing, over the stored keys (the text find of a selected mark).
    for (const mark of marks) {
      const labels = answer.hits.filter((hit) => hit.kind === "text" && (mark.selection ?? []).includes(hit.sourceKey ?? ""));
      expect(labels.length, `the members' own C2 labels are found as text too: ${JSON.stringify(mark)}`).toBeGreaterThan(0);
      for (const label of labels) expect([label.layoutName, label.sheetLabel], "on the same sheet, named by the same number").toEqual([mark.layoutName, mark.sheetLabel]);
    }
    expect(
      marks.reduce((sum, mark) => sum + (mark.count ?? 0), 0),
      "and the finds count every C2 row the register holds under the pinned revision",
    ).toBe(rows.length);
  });

  test("a text find of C2 opens a sheet of the same drawing, on the text itself", () => {
    const texts = answer.hits.filter((hit) => hit.kind === "text");
    expect(texts.length, "the plan's C2 labels are sheet text").toBeGreaterThan(0);
    for (const text of texts) {
      expect(text.drawingId).toBe(staged.drawingId);
      expect(text.layoutName ?? "", "on a sheet").not.toBe("");
      expect(text.selection, "selecting the text alone").toEqual([text.sourceKey]);
    }
  });
});
