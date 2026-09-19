/**
 * What the REGISTER says, read off the store the gate published into (AC-1, AC-2) — mechanics only.
 *
 * A band suite's figures are only the product's figures if they are the published lines' own sums, so
 * this reads `quantity_lines` directly and sums them in the store's exact numeric arithmetic. The
 * grouping is by the register object's LEVEL IDENTITY (its level id, label or slot as the row carries
 * one) and never by a level label this file resolves: what a level is CALLED is the product's own
 * business, and an acceptance that re-derived the name would grade its own spelling instead of the
 * figures (B-17). Counting and comparing groups needs no name at all.
 *
 * Every read is scoped to the CAMPAIGNS one arm opened, because both fixtures' arms are staged in one
 * database: a reconciliation that summed the other arm's lines too would be a reading of neither.
 *
 * Read as the system with a reason recorded, through the stage every live suite of this tree reads by.
 */
import { expect } from "vitest";
import { lit } from "../../../../db/__tests__/support/live-sql";
import { sql } from "../../gate/support/gate-stage";

/** The coverage a graded figure must stand under — L-QTY-06 grades only under COMPLETE coverage. */
export const COMPLETE = "COMPLETE";

/** One group of published lines: a cell, the level identity they stand on, and their exact sum. */
export type RegisterGroup = { cell: string; levelKey: string; total: string };

/**
 * The level a line's register object stands on, as an IDENTITY rather than a name: the level id if it
 * has one, else the placeholder label, else the slot. Two lines group together exactly when the product
 * would group them together.
 */
const LEVEL_IDENTITY = `coalesce(o.level_id::text, o.level_label, o.level_slot, '')`;

/** A campaign id list as a SQL tuple — `('a','b')`, and a tuple that cannot match where there are none. */
function tuple(ids: readonly string[]): string {
  return ids.length === 0 ? "(null)" : `(${ids.map((id) => lit(id)).join(", ")})`;
}

/** Every campaign open in the staged database, newest last — how an arm learns which ones are its own. */
export function campaignIds(): string[] {
  return sql(`select campaign_id::text from campaigns order by opened_at, campaign_id;`).map((row) => row[0] ?? "");
}

/** Every COMPLETE published line of these campaigns, summed exactly per (class, kind, level identity). */
export function registerGroups(campaigns: readonly string[]): RegisterGroup[] {
  return sql(
    `select q.class || '|' || q.kind, ${LEVEL_IDENTITY}, sum(q.value)::text
       from quantity_lines q
       join register_objects o
         on o.tenant_id = q.tenant_id and o.set_revision_id = q.set_revision_id and o.object_key = q.object_key
      where q.campaign_id::text in ${tuple(campaigns)} and q.coverage = ${lit(COMPLETE)} and q.value is not null
      group by 1, 2
      order by 1, 2;`,
  ).map((row) => ({ cell: row[0] ?? "", levelKey: row[1] ?? "", total: row[2] ?? "" }));
}

/** Every kind these campaigns published a line of, whatever its coverage — what the band actually ran. */
export function publishedKinds(campaigns: readonly string[]): Set<string> {
  return new Set(sql(`select distinct kind from quantity_lines where campaign_id::text in ${tuple(campaigns)};`).map((row) => row[0] ?? ""));
}

/** Every drawing these campaigns' lines were read from. */
export function publishedDrawings(campaigns: readonly string[]): Set<string> {
  return new Set(sql(`select distinct drawing_id::text from quantity_lines where campaign_id::text in ${tuple(campaigns)};`).map((row) => row[0] ?? ""));
}

/** One ingest record as this acceptance reads it: what read a drawing, and which drawing it read. */
export type IngestRecord = { drawingId: string; toolVersion: string };

/**
 * The ingests of the drawings these campaigns measured from — the evidence a campaign was INGESTED
 * rather than authored. A drawing with no ingest simply does not appear.
 */
export function ingestsOfCampaigns(campaigns: readonly string[]): IngestRecord[] {
  return sql(
    `select distinct i.drawing_id::text, i.extractor_tool_version from ingests i
      where i.drawing_id::text in (select distinct drawing_id::text from quantity_lines where campaign_id::text in ${tuple(campaigns)})
      order by 1;`,
  ).map((row) => ({ drawingId: row[0] ?? "", toolVersion: row[1] ?? "" }));
}

/** What a cell's own lines cite: the (rule, version) pairs that produced it and the edition in force. */
export type CellCitations = { rulePairs: { ruleId: string; ruleVersion: string }[]; editionDigest: string };

/** The citations of every cell these campaigns published a COMPLETE line for. */
export function cellCitations(campaigns: readonly string[]): Map<string, CellCitations> {
  const held = new Map<string, CellCitations>();
  for (const row of sql(
    `select distinct q.class || '|' || q.kind, q.rule_id, q.rule_version, q.edition_digest
       from quantity_lines q
      where q.campaign_id::text in ${tuple(campaigns)} and q.coverage = ${lit(COMPLETE)}
      order by 1, 2, 3;`,
  )) {
    const cell = row[0] ?? "";
    const standing = held.get(cell) ?? { rulePairs: [], editionDigest: row[3] ?? "" };
    standing.rulePairs.push({ ruleId: row[1] ?? "", ruleVersion: row[2] ?? "" });
    held.set(cell, standing);
  }
  return held;
}

/** The workspace and project of the first of these campaigns — the scope this arm's ledger is read at. */
export function campaignScope(campaigns: readonly string[]): { tenantId: string; projectId: string } {
  const row = sql(`select tenant_id::text, project_id::text from campaigns where campaign_id::text in ${tuple(campaigns)} order by opened_at, campaign_id limit 1;`)[0];
  expect(row?.[0], "the arm opened a campaign — a band over no campaign publishes nothing to grade (AC-1)").toBeTruthy();
  return { tenantId: row?.[0] ?? "", projectId: row?.[1] ?? "" };
}

/**
 * The rule-set edition one of these campaigns cites, as `name@version`. The ledger's column is not null
 * and not empty by law, so a store that cannot name the edition falls back to a citation this
 * acceptance can make: what is graded here is the LEDGER's round trip, not the editions store's shape.
 */
export function editionCitation(campaigns: readonly string[]): string {
  const answered = sql(
    `select coalesce(max(e.name || '@' || e.version), '') from campaigns c
       left join ruleset_editions e on e.edition_id = c.edition_id
      where c.campaign_id::text in ${tuple(campaigns)};`,
  )[0]?.[0];
  return answered !== undefined && answered.length > 0 ? answered : "unnamed-edition@0";
}
