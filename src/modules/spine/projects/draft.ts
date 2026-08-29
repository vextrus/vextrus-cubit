// The R-SPINE-010 fields a caller presents, and the column values they become. Creation and edit
// read the same draft through the same fold, so the two doors cannot come to store one field
// differently (ARCH-02, B-17).
//
// "Stored as presented" is the settled reading for every field but one: case, spacing and length are
// the person's, and what a `text` column has no representation for is dropped through the seam's own
// `storableText` rather than answered as an outage. The exception is `buildingType`, which
// R-SPINE-010 closes over five names — the store's CHECK is the belt, and this file is the guard in
// front of it, so a value from outside the five is a mistake in the caller and never a driver error
// reaching a person as a fault id (ARCH-03).
import { BUILDING_TYPES, storableText, type BuildingType } from "../../../core/db";

export { BUILDING_TYPES, type BuildingType };

/** A project as R-SPINE-010 names it, presented for a create or an edit. Only the name is required. */
export interface ProjectDraft {
  readonly name: string;
  readonly code?: string | null;
  readonly client?: string | null;
  readonly siteAddress?: string | null;
  /** Stored text at M0: the district → zone derivation is book law, and nothing here reads it. */
  readonly district?: string | null;
  readonly buildingType?: BuildingType | null;
  readonly storeys?: number | null;
  /** Target GFA in m², carried as a decimal string so the figure stays exact end to end (B-07). */
  readonly targetGfaM2?: string | null;
}

/** An edit names the project and whatever fields it moves; a field it does not name is untouched. */
export type ProjectChanges = Partial<ProjectDraft> & { readonly notes?: string | null };

/** The whole draft, notes included — creation takes every field R-SPINE-010 names. */
export type ProjectFields = ProjectDraft & { readonly notes?: string | null };

/** Is this one of the five R-SPINE-010 admits? The door asks before it presents a chosen type. */
export function isBuildingType(value: string): value is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(value);
}

/** A figure a `numeric` column can hold: a sign, digits, and at most one plain decimal fraction. */
const DECIMAL = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/** The column values a draft names, absent for every field the draft leaves alone. */
export interface ProjectColumns {
  name?: string;
  code?: string | null;
  client?: string | null;
  siteAddress?: string | null;
  district?: string | null;
  buildingType?: BuildingType | null;
  storeys?: number | null;
  targetGfaM2?: string | null;
  notes?: string | null;
}

/** A creation's columns: every field the draft names, with the one field R-SPINE-010 requires. */
export function creationColumnsOf(fields: ProjectFields): ProjectColumns & { name: string } {
  return { ...columnsOf(fields), name: storableText(fields.name) };
}

export function columnsOf(fields: ProjectChanges): ProjectColumns {
  const columns: ProjectColumns = {};
  if (fields.name !== undefined) columns.name = storableText(fields.name);
  if (fields.code !== undefined) columns.code = storedText(fields.code);
  if (fields.client !== undefined) columns.client = storedText(fields.client);
  if (fields.siteAddress !== undefined) columns.siteAddress = storedText(fields.siteAddress);
  if (fields.district !== undefined) columns.district = storedText(fields.district);
  if (fields.notes !== undefined) columns.notes = storedText(fields.notes);
  if (fields.buildingType !== undefined) columns.buildingType = declaredBuildingType(fields.buildingType);
  if (fields.storeys !== undefined) columns.storeys = wholeCount(fields.storeys);
  if (fields.targetGfaM2 !== undefined) columns.targetGfaM2 = decimalFigure(fields.targetGfaM2);
  return columns;
}

/** A field left blank is absent, not a blank string: an unstated fact is null in the store. */
function storedText(value: string | null): string | null {
  return value === null ? null : storableText(value);
}

function declaredBuildingType(value: BuildingType | null): BuildingType | null {
  if (value === null || isBuildingType(value)) return value;
  throw new Error(`"${String(value)}" is not one of the building types R-SPINE-010 closes the field over`);
}

function wholeCount(value: number | null): number | null {
  if (value === null || Number.isInteger(value)) return value;
  throw new Error(`storeys is a count of floors, so ${String(value)} is not one (R-SPINE-010)`);
}

function decimalFigure(value: string | null): string | null {
  if (value === null || DECIMAL.test(value)) return value;
  throw new Error(`target GFA is held as a decimal in m², and ${JSON.stringify(value)} is not one (R-SPINE-010, B-07)`);
}
