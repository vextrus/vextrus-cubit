/**
 * The validation ledger's acceptance mechanics (AC-3) — nothing judged here.
 *
 * Every module this increment lands is loaded BY PATH when a case asks for it, so a file the Builder
 * has not written yet fails that case as an assertion naming it rather than killing the collection.
 * Nothing here reads product source: what a case asks of the ledger, it asks through the module door
 * and through the migrated database itself.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/** tests/takeoff/validation/support/ → the checkout. */
export const REPO_ROOT: string = join(import.meta.dirname, "..", "..", "..", "..");

/** The homes this increment lands (interfaces). */
export const VALIDATION_MODULE = "src/modules/takeoff/validation/index.ts";
export const VALIDATION_LAW = "src/modules/takeoff/validation/law.ts";
export const SCHEMA_VALIDATION_MODULE = "src/core/db/schema-validation.ts";
export const DB_SCHEMA_VALIDATION_MODULE = "db/schema/validation.ts";
export const ERRORS_VALIDATION_MODULE = "src/core/errors/validation.ts";

/** The homes already in the tree it is enumerated into, and the taxonomy a refusal is read through. */
export const DB_ROSTER_MODULE = "src/core/db.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/** The ledger's table, and the refusal an unadmitted provenance earns (interfaces). */
export const VALIDATION_OBSERVATIONS = "validation_observations";
export const VALIDATION_PROVENANCE_UNKNOWN = "VALIDATION_PROVENANCE_UNKNOWN";

/** The engine every observation of this increment is keyed to (L-QTY-03's roster). */
export const VECTOR = "VECTOR";

/** Import a module of this checkout by repo-relative path, asserting it stands first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — this increment does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** Whose project a ledger read or write is about. */
export type Scope = { tenantId: string; projectId: string };

/** One cell of the band matrix: what read the drawing, and the (class, kind) pair it published. */
export type Cell = { engine: string; class: string; kind: string };

/** One level as the ledger records it (interfaces: `GradedLevel`). */
export type GradedLevel = { level: string; golden: string; measured: string; verdict: string };

/** What one observation cites (interfaces: `ObservationInput`). */
export type ObservationInput = Cell & {
  fixtureId: string;
  verdict: string;
  rulesetEdition: string;
  editionDigest: string;
  methodHash: string;
  converterVersion: string;
  provenance: string;
  levels: readonly GradedLevel[];
};

/** The three citations a validated cell's PASS row must still be standing on (interfaces). */
export type InstrumentsInForce = { editionDigest: string; methodHash: string; converterVersion: string };

/** The ledger's one door, seen through the surface the criteria name (interfaces). */
export type ValidationDoor = {
  recordObservation: (scope: Scope, input: ObservationInput) => Promise<{ observationId: string; recordedAt: Date }>;
  observationsOf: (scope: Scope, cell?: Partial<Cell>) => Promise<readonly Record<string, unknown>[]>;
  validatedCells: (scope: Scope, inForce: InstrumentsInForce) => Promise<readonly Cell[]>;
};

/** The module door, with the three calls the criteria drive proved to be there. */
export async function validationDoor(): Promise<ValidationDoor> {
  const door = await productModule<Record<string, unknown>>("src/modules/takeoff/validation/index.ts");
  for (const call of ["recordObservation", "observationsOf", "validatedCells"]) {
    expect(typeof door[call], `${VALIDATION_MODULE} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  return door as unknown as ValidationDoor;
}

/** The pure law beside it: the closed rosters, the tolerance and the two pure functions (interfaces). */
export type ValidationLaw = {
  VALIDATION_PROVENANCES: readonly string[];
  VALIDATION_VERDICTS: readonly string[];
  UNDER_TOLERANCE: string;
  gradeCell: (levels: readonly { level: string; golden: string; measured: string }[]) => { verdict: string; levels: readonly GradedLevel[] };
  methodHashOf: (lines: readonly { ruleId: string; ruleVersion: string }[]) => string;
};

/** The pure law, with the rosters and calls the criteria name proved to be there. */
export async function validationLaw(): Promise<ValidationLaw> {
  const law = await productModule<Record<string, unknown>>("src/modules/takeoff/validation/law.ts");
  for (const roster of ["VALIDATION_PROVENANCES", "VALIDATION_VERDICTS"]) {
    expect(Array.isArray(law[roster]), `${VALIDATION_LAW} publishes \`${roster}\` as a closed list (L-QTY-04)`).toBe(true);
  }
  for (const call of ["gradeCell", "methodHashOf"]) {
    expect(typeof law[call], `${VALIDATION_LAW} publishes \`${call}\` (interfaces)`).toBe("function");
  }
  expect(typeof law["UNDER_TOLERANCE"], `${VALIDATION_LAW} publishes \`UNDER_TOLERANCE\` — the under arm's factor, in one place (L-QTY-06)`).toBe("string");
  return law as unknown as ValidationLaw;
}

/** One entry of the refusal register, as the area file declares it and the barrel enumerates it. */
export type RefusalEntryShape = { message?: string; remedy?: string; severity?: string; surface?: string };

/**
 * The entry the AREA's own register file declares for a code — found by looking through that module's
 * exported records for one that carries the code, so the group's export name is the area's business
 * and not this acceptance's. The barrel enumerates areas and re-declares nothing (AM-11), so the
 * entry the barrel answers must be this very one.
 */
export async function areaRefusalEntry(relative: string, code: string): Promise<RefusalEntryShape> {
  const area = await productModule<Record<string, unknown>>(relative);
  const groups = Object.values(area).filter((held): held is Record<string, unknown> => typeof held === "object" && held !== null);
  const carrying = groups.filter((group) => Object.prototype.hasOwnProperty.call(group, code));
  expect(
    carrying.length,
    `${relative} publishes a refusal group carrying \`${code}\` — the area file DECLARES its refusals and the barrel only enumerates them, so a code declared in the barrel or in another area's group is a second home for one register (AM-11, Q-07). Its exports: ${JSON.stringify(Object.keys(area))}`,
  ).toBeGreaterThan(0);
  return (carrying[0] as Record<string, unknown>)[code] as RefusalEntryShape;
}

/**
 * The registered code a call refused with — asserted to have refused at all. A refusal is read as a
 * CODE off the shipped marker, never matched as prose (L-QTY-04).
 */
export async function refusalCodeOf(call: () => unknown, where: string): Promise<string | null> {
  const marker = await productModule<{ refusalCodeOf: (failure: unknown) => string | null }>("src/core/faults/refusal-marker.ts");
  let answered: unknown;
  try {
    answered = await call();
  } catch (failure) {
    const direct = marker.refusalCodeOf(failure);
    if (direct !== null) return direct;
    const cause = (failure as { cause?: unknown } | null)?.cause;
    return cause === undefined ? null : marker.refusalCodeOf(cause);
  }
  expect.fail(`${where} was expected to refuse, and answered ${JSON.stringify(answered)}`);
}

/** One field of a row the store answered, in whichever of the two spellings it came back in. */
export function said(row: Record<string, unknown>, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

/** The same, as the string the ledger holds. */
export function saidText(row: Record<string, unknown>, camel: string, snake: string): string {
  const held = said(row, camel, snake);
  return held === null || held === undefined ? "" : String(held);
}

/** When a row was recorded, in milliseconds — however the driver hands the timestamp back. */
export function recordedAtMs(row: Record<string, unknown>): number {
  const held = said(row, "recordedAt", "recorded_at");
  return held instanceof Date ? held.getTime() : new Date(String(held)).getTime();
}
