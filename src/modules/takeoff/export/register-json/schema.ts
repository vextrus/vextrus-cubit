// The published shape of the register JSON export, as one Zod schema (R-TO-070, C-TO-EXPORT: "JSON
// of the register (documented shape) for integrations").
//
// The shape mirrors the reading the register workspace is already handed — `RegisterView` — field
// for field. It is declared here and not derived from a row: a register's shape has one home
// (`register-ui/view.ts`), and a second declaration beside the rows would be a second answer to what
// a register IS (B-17). What the reading does not carry, this version does not publish: L-QTY-03's
// rule id and version, the vectoriser's identity and the per-line actor are absent from `RegisterView`
// and therefore from v1.0; they enter as an additive minor version once the reading carries them.
//
// Every level is a `z.strictObject`, so the JSON Schema this compiles to closes each level with
// `additionalProperties: false` and a field added, removed or retyped shows up in the committed
// drift fixture rather than reaching an integration unannounced.
import { z } from "zod";
import { QUANTITY_BASES } from "@/core/offers/law";

/**
 * The version of the published shape. It changes only with a breaking change to the shape; an
 * additive field bumps the minor.
 */
export const REGISTER_JSON_SCHEMA_VERSION = "1.0" as const;

/** A binding's figure in the canon's own unit (`ViewBinding.canonical`). */
const RegisterJsonCanonicalFigure = z.strictObject({
  value: z.string(),
  unit: z.string(),
});

/** What one named variable of a line's formula was read as (`ViewBinding`). */
export const RegisterJsonBinding = z.strictObject({
  value: z.string(),
  unit: z.string(),
  basis: z.string(),
  source: z.string(),
  canonical: RegisterJsonCanonicalFigure,
});

/** One reading of one attribute, as the ledger holds it (`ViewReading`, R-TO-051). */
export const RegisterJsonReading = z.strictObject({
  observationId: z.string(),
  valueAsWritten: z.string(),
  unitAsWritten: z.string(),
  basis: z.string(),
  precedence: z.number(),
  sourceKey: z.string(),
});

/**
 * One correctable attribute of one object (`ViewAttribute`): how it stands, the value that stands
 * where one does, and every reading competing for it or overruled by a higher precedence. A
 * SUSPENDED attribute carries no value at all — the disagreement is declared, never resolved
 * (L-REG-03).
 */
export const RegisterJsonAttribute = z.strictObject({
  attribute: z.string(),
  standing: z.string(),
  canonicalValue: z.string().nullable(),
  canonicalUnit: z.string().nullable(),
  competing: z.array(RegisterJsonReading),
  overruled: z.array(RegisterJsonReading),
});

/** One register object, as the reading carries it (`ViewObject`). */
export const RegisterJsonObject = z.strictObject({
  objectKey: z.string(),
  discipline: z.string(),
  level: z.string(),
  class: z.string(),
  mark: z.string(),
  basis: z.string(),
  role: z.string(),
  corroboration: z.string(),
  sourceKey: z.string(),
  attributes: z.array(RegisterJsonAttribute),
});

/**
 * One published quantity line (`ViewLine`). `value` is a decimal string at full precision and never
 * a JSON number — a float would lose the register's precision on the way out — and it is null
 * exactly where the coverage is not COMPLETE: a row kept with no quantity carries none, never a
 * zero (L-QTY-02).
 */
export const RegisterJsonLine = z.strictObject({
  lineId: z.string(),
  objectKey: z.string(),
  kind: z.string(),
  class: z.string(),
  level: z.string(),
  value: z.string().nullable(),
  unit: z.string(),
  formula: z.string(),
  variables: z.record(z.string(), RegisterJsonBinding),
  quantityBasis: z.enum(QUANTITY_BASES),
  selectionBasis: z.enum(QUANTITY_BASES),
  coverage: z.string(),
  calibrationKeys: z.array(z.string()),
  engine: z.string(),
  sourceKey: z.string(),
  repudiated: z.boolean(),
  drawingId: z.string().nullable(),
  layoutName: z.string().nullable(),
  sourceKeys: z.array(z.string()),
});

/** One sighting that produced no line (`ViewRefusal`): the refusal's code, its object and its kind. */
export const RegisterJsonRefusal = z.strictObject({
  code: z.string(),
  objectKey: z.string(),
  kind: z.string().nullable(),
});

/** The campaign the register was read under, or nothing where none stands (`ViewCampaign`, L-REG-07). */
export const RegisterJsonCampaign = z.strictObject({
  campaignId: z.string(),
  setRevisionId: z.string(),
});

/**
 * The whole document: one project's register and its published lines, under the version it was
 * written to. `levelStacks` is an offered-group affordance of the register screen and not register
 * content, so it is not exported; nothing here is minted or read from a clock, so the same reading
 * answers the same document on every machine.
 */
export const RegisterJsonDocument = z.strictObject({
  schemaVersion: z.literal(REGISTER_JSON_SCHEMA_VERSION),
  tenantId: z.string(),
  projectId: z.string(),
  campaign: RegisterJsonCampaign.nullable(),
  objects: z.array(RegisterJsonObject),
  lines: z.array(RegisterJsonLine),
  refusals: z.array(RegisterJsonRefusal),
});

export type RegisterJsonBinding = z.infer<typeof RegisterJsonBinding>;
export type RegisterJsonReading = z.infer<typeof RegisterJsonReading>;
export type RegisterJsonAttribute = z.infer<typeof RegisterJsonAttribute>;
export type RegisterJsonObject = z.infer<typeof RegisterJsonObject>;
export type RegisterJsonLine = z.infer<typeof RegisterJsonLine>;
export type RegisterJsonRefusal = z.infer<typeof RegisterJsonRefusal>;
export type RegisterJsonCampaign = z.infer<typeof RegisterJsonCampaign>;
export type RegisterJsonDocument = z.infer<typeof RegisterJsonDocument>;
