// R-TO-004's one door (ARCH-02): the sheet index of a project, and the groups the machine offers to
// confirm a discipline through. A caller — the screen's page, its server action, the takeoff lane —
// speaks to the index through this file and never reaches past it.
//
// It composes rather than computes: the grammar, the scale state and the fidelity facts are core's
// (src/core/sheets), the pictures are the raster seam's (../thumbnails), and what this file adds is
// the join between them plus the membership a group is offered with. Nothing here re-derives a
// proposal or re-counts a counter — a second answer to either would be a second truth (B-17).
import { projectDrawingsOf, sheetStateOf, sheetsOfRecord, type Discipline, type FidelityFact, type ScaleState, type SheetConfirmation, type SheetFacts, type SheetProposal } from "../../../core/sheets";
import type { OfferedGroupKey } from "../../../core/acts";
import { forTenant } from "../../../core/db";
import { appStorage } from "../../../core/storage/app";
import { sheetRastersOf } from "../thumbnails";

export type { OfferedGroupKey } from "../../../core/acts";

/** Which project's index is being asked for, in whose workspace. */
export type SheetIndexScope = { tenantId: string; projectId: string };

/** One card of the index: one sheet of one drawing's current record, whole (R-TO-004). */
export type SheetCard = {
  readonly sheetId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  readonly layoutName: string;
  readonly kind: "model" | "paper";
  readonly format: string;
  readonly scheme: string;
  readonly thumbnail: { readonly url: string; readonly width: number; readonly height: number } | null;
  readonly proposal: SheetProposal;
  readonly confirmed: { readonly discipline: Discipline; readonly actId: string } | null;
  readonly scaleState: ScaleState;
  /**
   * How many views this sheet holds. Null until L-CAD-06's classification lands: a count nobody
   * derived is never invented, and "not classified yet" is a different answer from "none".
   */
  readonly viewCount: number | null;
  readonly facts: Readonly<Record<FidelityFact, number | boolean>>;
};

/** One group the machine offers, with its membership resolved server-side (L-ACT-02, R-UI-023). */
export type OfferedGroup = {
  readonly key: OfferedGroupKey;
  /**
   * What the group's subjects have in common, as a NAME — the drawing's stored file name. The
   * sentence a person reads is the consuming screen's, from its own string table: a module writing
   * user copy would put it where no string table reaches it.
   */
  readonly label: string;
  readonly members: readonly string[];
};

/** The tier a card's thumbnail is drawn from (R-SPINE-022: the sheet index's own size). */
const THUMB_TIER = "thumb";

/**
 * The sheet index of one project: one card per layout of every drawing's current ingest record.
 *
 * A project holding no drawings answers an empty index — an absence, never a refusal — and a drawing
 * waiting on its first ingest contributes no cards for the same reason: there is no record to read
 * sheets out of yet. The screen names which emptiness it is (R-UI-050).
 */
export async function sheetIndexOf(scope: SheetIndexScope): Promise<SheetCard[]> {
  const { drawings, confirmations } = await sheetStateOf(scope);
  const confirmed = confirmationsBySheet(confirmations);
  const storage = appStorage();
  const cards: SheetCard[] = [];

  for (const drawing of drawings) {
    if (drawing.record === null) continue;
    const sheets = await sheetsOfRecord(scope.tenantId, drawing.record, storage);
    const rasters = await sheetRastersOf({ tenantId: scope.tenantId, drawingId: drawing.drawingId });

    for (const sheet of sheets) {
      const tiers = rasters.find((rendered) => rendered.layoutName === sheet.layoutName)?.tiers;
      const thumb = tiers?.[THUMB_TIER];
      cards.push({
        ...cardFacts(sheet),
        format: drawing.format,
        thumbnail: thumb === undefined ? null : { url: thumb.url, width: thumb.width, height: thumb.height },
        confirmed: confirmed.get(sheet.sheetId) ?? null,
        viewCount: null,
      });
    }
  }
  return cards;
}

/**
 * The groups the machine offers right now (L-ACT-02: "bulk is offered, never assembled").
 *
 * Derived from current state on every read and stored nowhere: one group per (drawing, proposed
 * discipline) that still holds an unconfirmed sheet, with the membership resolved here. A group
 * whose every member has been confirmed is not offered smaller — it is not offered.
 */
export async function offeredGroupsOf(scope: SheetIndexScope): Promise<OfferedGroup[]> {
  const { drawings, confirmations } = await sheetStateOf(scope);
  const confirmed = new Set(confirmations.map((row) => row.sheetId));
  const storage = appStorage();
  const offered: OfferedGroup[] = [];

  for (const drawing of drawings) {
    if (drawing.record === null) continue;
    const sheets = await sheetsOfRecord(scope.tenantId, drawing.record, storage);
    const byDiscipline = new Map<Discipline, string[]>();

    for (const sheet of sheets) {
      if (confirmed.has(sheet.sheetId)) continue;
      const held = byDiscipline.get(sheet.proposal.discipline) ?? [];
      held.push(sheet.sheetId);
      byDiscipline.set(sheet.proposal.discipline, held);
    }

    for (const [discipline, members] of byDiscipline) {
      offered.push({
        key: { kind: "PROPOSED_DISCIPLINE", drawingId: drawing.drawingId, discipline },
        label: drawing.name,
        members,
      });
    }
  }
  return offered;
}

/**
 * How many of a project's drawings are stored but not read through yet — what tells "this project
 * holds no drawings" apart from "its drawings have not been read yet" on an empty index (R-UI-050).
 */
export async function drawingsAwaitingIngestOf(scope: SheetIndexScope): Promise<number> {
  const drawings = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => projectDrawingsOf(tx, scope));
  return drawings.filter((drawing) => drawing.record === null).length;
}

/** Every confirmation of a project, indexed by the sheet it confirms. */
function confirmationsBySheet(confirmations: readonly SheetConfirmation[]): Map<string, { discipline: Discipline; actId: string }> {
  const held = new Map<string, { discipline: Discipline; actId: string }>();
  for (const row of confirmations) {
    // Newest first, and `sheet_disciplines_once` holds one row per sheet: the first is the one.
    if (!held.has(row.sheetId)) held.set(row.sheetId, { discipline: row.discipline, actId: row.actId });
  }
  return held;
}

/** What a card carries straight off the core reading, unchanged. */
function cardFacts(sheet: SheetFacts): Pick<SheetCard, "sheetId" | "drawingId" | "ingestId" | "layoutName" | "kind" | "scheme" | "proposal" | "scaleState" | "facts"> {
  return {
    sheetId: sheet.sheetId,
    drawingId: sheet.drawingId,
    ingestId: sheet.ingestId,
    layoutName: sheet.layoutName,
    kind: sheet.kind,
    scheme: sheet.scheme,
    proposal: sheet.proposal,
    scaleState: sheet.scaleState,
    facts: sheet.facts,
  };
}
