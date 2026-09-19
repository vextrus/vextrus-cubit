// The VALIDATION ledger, at its door: the ONE place an observation is appended and the ONE place
// the matrix is read back (ARCH-02, R-TO-035: "validation observations recorded as data").
//
// Three calls and nothing else. There is no update and no delete here, and the runtime role holds
// neither privilege on the table: an observation is EVIDENCE — what V-GOLDEN proved, under the
// instruments that were then in force — and evidence that can be revised is no evidence at all.
// Restating a cell is another observation; a correction is another observation (L-ACT-01, L-ACT-03).
//
// What a cell's band IS stays in `./law.ts`, pure and unaware of storage: this file moves the columns
// that law names and adds no second opinion of any of them (B-17, ARCH-02).
import {
  and,
  asc,
  eq,
  forTenant,
  validationObservations,
  VALIDATION_PROVENANCES,
  VALIDATION_VERDICTS,
  type ValidationProvenance,
  type ValidationVerdict,
} from "@/core/db";
import { ENGINES, type Engine } from "@/core/offers/law";
import { refusal } from "@/core/faults/refusal-marker";
import { z } from "zod";
import type { GradedLevel } from "./law";

// The band's arithmetic and the two closed rosters are handed out from here, because this is the
// door a suite and a reader meet the ledger at — re-exported, never re-spelled (B-17, ARCH-02).
export { gradeCell, methodHashOf, UNDER_TOLERANCE } from "./law";
export type { GradedLevel, LevelReading } from "./law";
export { VALIDATION_PROVENANCES, VALIDATION_VERDICTS };
export type { ValidationProvenance, ValidationVerdict };

/** One project's validation ledger, in the workspace whose ledger it is. */
export type ValidationScope = {
  readonly tenantId: string;
  readonly projectId: string;
};

/** The key an observation is filed under: which engine measured which (class, kind). */
export type ValidationCell = {
  readonly engine: Engine;
  readonly class: string;
  readonly kind: string;
};

/** Everything one appended observation states. */
export type ObservationInput = ValidationCell & {
  readonly fixtureId: string;
  readonly verdict: ValidationVerdict;
  /** The edition in force, as `${name}@${version}`. */
  readonly rulesetEdition: string;
  readonly editionDigest: string;
  readonly methodHash: string;
  readonly converterVersion: string;
  readonly provenance: ValidationProvenance;
  readonly levels: readonly GradedLevel[];
};

/** One appended observation, whole, as the ledger holds it. */
export type ObservationRow = typeof validationObservations.$inferSelect;

/** The three instruments a PASS is only evidence UNDER (R-TO-035). */
export type InstrumentsInForce = {
  readonly editionDigest: string;
  readonly methodHash: string;
  readonly converterVersion: string;
};

/**
 * A citation the ledger can read back: never blank, never whitespace.
 *
 * An empty citation is a row that claims a proof and names no instrument — a malformed statement,
 * which is a refusal and never a stored hole (REQUEST_MALFORMED, the one code a door answers a
 * statement it could not read with).
 */
const Citation = z.string().trim().min(1);

/** One graded level, as the ledger stores it — the reading and the verdict it earned. */
const Level = z.strictObject({
  level: Citation,
  golden: Citation,
  measured: Citation,
  verdict: z.enum(VALIDATION_VERDICTS),
});

/**
 * What an observation must be before a row is written. The provenance is checked SEPARATELY and
 * first (below), because L-QTY-06 gives that one failure its own registered answer: where the
 * yardstick came from is the standing of the whole row, so "not one of these three" is a refusal a
 * person can act on rather than a field that failed to parse.
 */
const Observation = z.strictObject({
  fixtureId: Citation,
  engine: z.enum(ENGINES),
  class: Citation,
  kind: Citation,
  verdict: z.enum(VALIDATION_VERDICTS),
  rulesetEdition: Citation,
  editionDigest: Citation,
  methodHash: Citation,
  converterVersion: Citation,
  provenance: z.enum(VALIDATION_PROVENANCES),
  levels: z.array(Level),
});

/**
 * Append one observation, and hand back the row's own identity and the instant it was recorded.
 *
 * It appends and never updates: no `onConflict`, no upsert, no read-then-write. Two observations of
 * one cell are two rows, in the order they were made, and which of them is current is a question the
 * reader answers from `recorded_at` — never one the store answers by overwriting (L-ACT-01).
 */
export async function recordObservation(scope: ValidationScope, input: ObservationInput): Promise<{ observationId: string; recordedAt: Date }> {
  if (!(VALIDATION_PROVENANCES as readonly string[]).includes(input.provenance)) {
    throw refusal("VALIDATION_PROVENANCE_UNKNOWN", `the observation cites the provenance "${String(input.provenance)}", which the ledger does not admit`, {
      provenance: String(input.provenance),
    });
  }
  const parsed = Observation.safeParse(input);
  if (!parsed.success) {
    throw refusal("REQUEST_MALFORMED", `the observation is not one the validation ledger can read back: ${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
  }
  const statement = parsed.data;
  const [row] = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .insert(validationObservations)
      .values({
        tenantId: scope.tenantId,
        projectId: scope.projectId,
        fixtureId: statement.fixtureId,
        engine: statement.engine,
        class: statement.class,
        kind: statement.kind,
        verdict: statement.verdict,
        rulesetEdition: statement.rulesetEdition,
        editionDigest: statement.editionDigest,
        methodHash: statement.methodHash,
        converterVersion: statement.converterVersion,
        provenance: statement.provenance,
        levels: statement.levels,
      })
      .returning({ observationId: validationObservations.observationId, recordedAt: validationObservations.recordedAt }),
  );
  if (row === undefined) throw new Error("the validation ledger's insert returned no row, which the append-only store never does");
  return row;
}

/**
 * Every row ever recorded for a scope, oldest first — narrowed to a cell where one is named, and
 * filtered by nothing else.
 *
 * Nothing is hidden here, and that is the clause: an observation whose instruments have since left
 * force is OUTLIVED, not deleted, and a reader asking what was ever proved must still see it
 * (R-TO-035, "readable forever"). The tie-break is the row's own id, so two rows the clock cannot
 * separate still have ONE order and every reader reads them the same way (L-REG-05).
 */
export async function observationsOf(scope: ValidationScope, cell?: Partial<ValidationCell>): Promise<ObservationRow[]> {
  const where = [eq(validationObservations.tenantId, scope.tenantId), eq(validationObservations.projectId, scope.projectId)];
  if (cell?.engine !== undefined) where.push(eq(validationObservations.engine, cell.engine));
  if (cell?.class !== undefined) where.push(eq(validationObservations.class, cell.class));
  if (cell?.kind !== undefined) where.push(eq(validationObservations.kind, cell.kind));
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(validationObservations)
      .where(and(...where))
      .orderBy(asc(validationObservations.recordedAt), asc(validationObservations.observationId)),
  );
}

/**
 * The cells that are VALIDATED right now: those holding at least one PASS whose three citations are
 * the instruments in force.
 *
 * "A cell is validated only on a live PASS whose citations are the instruments in force" — so a PASS
 * proved under an edition, a method set or a converter that has since moved does not count here. It
 * is not deleted and not rewritten: `observationsOf` still returns it, and this answer simply no
 * longer contains its cell. That is what makes the certificate's UNVALIDATED statement true by
 * construction rather than by somebody remembering to clear a flag (L-QTY-07, R-TO-035).
 */
export async function validatedCells(scope: ValidationScope, inForce: InstrumentsInForce): Promise<ValidationCell[]> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ engine: validationObservations.engine, class: validationObservations.class, kind: validationObservations.kind })
      .from(validationObservations)
      .where(
        and(
          eq(validationObservations.tenantId, scope.tenantId),
          eq(validationObservations.projectId, scope.projectId),
          eq(validationObservations.verdict, "PASS"),
          eq(validationObservations.editionDigest, inForce.editionDigest),
          eq(validationObservations.methodHash, inForce.methodHash),
          eq(validationObservations.converterVersion, inForce.converterVersion),
        ),
      )
      .orderBy(asc(validationObservations.engine), asc(validationObservations.class), asc(validationObservations.kind)),
  );
  // One entry per cell: a cell proved twice under the same instruments is still one validated cell.
  const seen = new Map<string, ValidationCell>();
  for (const row of rows) seen.set(`${row.engine}|${row.class}|${row.kind}`, { engine: row.engine, class: row.class, kind: row.kind });
  return [...seen.values()];
}
