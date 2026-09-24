// The condition chest (R-TO-041, docs/design/s-measure.md §2.6, I-374, I-573 … I-575): a
// project's named recipes — what a QS measures WITH — and the one home of what may be authored into
// it, how it is read back, and how a condition leaves it.
//
// Authoring a condition is not an act (I-374): it changes nothing the machine derives until a
// measurement cites it, and the measurement snapshots the recipe as applied. So it is project data,
// written behind `authorize(MEASURE)` by the chest's own doors (`src/server/routers/takeoff-conditions.ts`
// and the viewer route's `measure-actions.ts`), each of which hands its statement here. What a
// statement may say is judged HERE and nowhere else: the kinds against the class's bears (L-MEA-04)
// and against the manual roster (`MANUAL_RULES`, I-539), the rule id each kind is offered under read
// off that roster rather than taken from the caller, and the readings the paired rules take from the
// recipe — no more and no fewer, each a number in a unit of the variable's dimension.
//
// The running total a row shows is the campaign's own published lines of the measurements that cite
// the condition — COMPLETE lines only, never a PARTIAL one (L-QTY-07), never a figure this file
// computes (I-575).
import { BEARS } from "../catalogue/bears";
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { and, asc, campaigns, conditions, eq, forTenant, inArray, isNull, manualMeasurements, quantityLines, type TenantTx } from "../db";
import { violatesConstraint } from "../db/violations";
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { readsAsANumber, registerScopeIn, repudiatedObjectsIn } from "../register/store";
import { MANUAL_RULES, manualRuleOf, type ManualRule } from "../rulesets/methods/manual/rules";
import { enumerateMethods, implementationOf } from "../rulesets/methods/registry";
import { UNITS, dimensionOf, exact, isUnit, type Dimension, type Unit } from "../units/canon";
import { CONDITION_COLOURS, type ConditionColour, type ConditionHatch, type ManualGeometry, type RecipeKind, type RecipeReading } from "./law";

/* ------------------------------------------------------------------ what may be authored */

/** How long a condition's name may be: a chest row's name, never a paragraph. */
export const CONDITION_NAME_MAX = 120;

/** The digits a chest's first conditions answer to (I-374): 1 to 9, in the chest's order. */
export const CONDITION_HOTKEYS = 9;

/** One reading a paired rule takes from the recipe (`ManualSupply` `recipe`): its variable, its dimension, and the units it may be stated in. */
export type OwedReading = { readonly attribute: string; readonly dimension: Dimension; readonly units: readonly Unit[] };

/** One kind a class may be measured for by hand from one geometry, with the rule it is offered under. */
export type AuthorableKind = { readonly kind: Kind; readonly ruleId: string; readonly readings: readonly OwedReading[] };

/** One class a geometry may be measured as, with the kinds and the colour it opens at. */
export type AuthorableClass = { readonly elementClass: ElementType; readonly colour: ConditionColour; readonly kinds: readonly AuthorableKind[] };

/** What the condition form may offer (§2.6): per geometry, the classes `MANUAL_RULES` pairs with it. */
export type AuthorableCatalogue = readonly { readonly geometry: ManualGeometry; readonly classes: readonly AuthorableClass[] }[];

/**
 * The colour a class opens at (I-374: "default: the class's own"), by the element palette's own
 * names. A class the palette names no colour for opens at `generic`.
 */
export function classColourOf(elementClass: ElementType): ConditionColour {
  switch (elementClass) {
    case "beam":
    case "tie_beam":
    case "lintel":
      return "beam";
    case "column":
      return "column";
    case "slab":
    case "stair":
      return "slab";
    case "footing":
    case "pile_cap":
    case "pile":
      return "footing";
    case "brick_wall":
    case "shear_wall":
      return "wall";
    default:
      return (CONDITION_COLOURS as readonly string[]).includes(elementClass) ? (elementClass as ConditionColour) : "generic";
  }
}

/** The dimension a rule's variable is read in, off the method the registry implements it by. */
function dimensionOfVariable(ruleId: string, variable: string): Dimension {
  for (const pair of enumerateMethods()) {
    if (pair.ruleId !== ruleId) continue;
    const method = implementationOf(pair);
    if (method?.role !== "formula") continue;
    const declared = method.variables.find((entry) => entry.name === variable);
    if (declared !== undefined) return declared.dimension;
  }
  throw new Error(`${ruleId} declares no variable ${variable} in any version the registry implements, yet MANUAL_RULES says the recipe supplies it (I-539)`);
}

/** The readings one pairing takes from the recipe, in the order its supply names them. */
function owedBy(rule: ManualRule): OwedReading[] {
  return Object.entries(rule.supply)
    .filter(([, supply]) => supply.from === "recipe")
    .map(([attribute]) => {
      const dimension = dimensionOfVariable(rule.ruleId, attribute);
      return { attribute, dimension, units: UNITS.filter((unit) => dimensionOf(unit) === dimension) };
    });
}

/** The catalogue the form offers, read off `MANUAL_RULES` — so the chest never offers a pairing the gate could not (I-539, B-17). */
export function authorableCatalogue(): AuthorableCatalogue {
  const byGeometry = new Map<ManualGeometry, Map<ElementType, AuthorableKind[]>>();
  for (const rule of MANUAL_RULES) {
    const classes = byGeometry.get(rule.geometry) ?? new Map<ElementType, AuthorableKind[]>();
    const kinds = classes.get(rule.class) ?? [];
    kinds.push({ kind: rule.kind, ruleId: rule.ruleId, readings: owedBy(rule) });
    classes.set(rule.class, kinds);
    byGeometry.set(rule.geometry, classes);
  }
  return [...byGeometry.entries()].map(([geometry, classes]) => ({
    geometry,
    classes: [...classes.entries()].map(([elementClass, kinds]) => ({ elementClass, colour: classColourOf(elementClass), kinds })),
  }));
}

/** What a person states when they author a condition: a recipe, a name and its paint. */
export type ConditionStatement = {
  readonly name: string;
  readonly geometry: ManualGeometry;
  readonly elementClass: ElementType;
  readonly kinds: readonly Kind[];
  readonly readings: readonly { readonly attribute: string; readonly valueAsWritten: string; readonly unitAsWritten: string }[];
  readonly colour: ConditionColour;
  readonly hatch: ConditionHatch;
};

/** A condition's recipe as the chest judged it: each kind with the rule the roster offers it under, each reading ENTERED. */
export type JudgedCondition = { readonly name: string; readonly kinds: readonly RecipeKind[]; readonly readings: readonly RecipeReading[] };

/**
 * Judge what a person stated (I-374, L-MEA-04, I-539). A kind the class does not bear is
 * CONDITION_KIND_NOT_BORNE; one it bears that no manual method measures from this geometry is
 * CONDITION_KIND_NOT_OFFERED. A reading the paired rules do not take, or one they take and was not
 * stated, is a statement the chest cannot read — `REQUEST_MALFORMED`, because the form states
 * exactly the readings the catalogue owes; a value that states no number is READING_NOT_NUMERIC, as
 * the act answers it (L-MEA-06). A reading a condition supplies is ENTERED: a person stated it.
 */
export function judgeCondition(statement: ConditionStatement): JudgedCondition {
  const name = statement.name.trim();
  if (name === "" || name.length > CONDITION_NAME_MAX) throw refusal(REFUSALS.REQUEST_MALFORMED.code, `a condition's name is 1 to ${CONDITION_NAME_MAX} characters`);
  if (statement.kinds.length === 0) throw refusal(REFUSALS.REQUEST_MALFORMED.code, "a condition measures at least one kind (R-TO-041)");
  if (new Set(statement.kinds).size !== statement.kinds.length) throw refusal(REFUSALS.REQUEST_MALFORMED.code, "a condition names each kind once");

  const kinds: RecipeKind[] = [];
  const owed = new Map<string, OwedReading>();
  for (const kind of statement.kinds) {
    if (!BEARS.some((row) => row.class === statement.elementClass && row.kind === kind)) {
      throw refusal(REFUSALS.CONDITION_KIND_NOT_BORNE.code, `a ${statement.elementClass} bears no ${kind} (L-MEA-04)`, { kind });
    }
    const rule = manualRuleOf(statement.geometry, statement.elementClass, kind);
    if (rule === undefined) {
      throw refusal(REFUSALS.CONDITION_KIND_NOT_OFFERED.code, `no manual method measures a ${statement.elementClass}'s ${kind} from a ${statement.geometry} (I-539)`, { kind });
    }
    kinds.push({ kind, ruleId: rule.ruleId });
    for (const reading of owedBy(rule)) owed.set(reading.attribute, reading);
  }

  const stated = new Set(statement.readings.map((reading) => reading.attribute));
  if (stated.size !== statement.readings.length) throw refusal(REFUSALS.REQUEST_MALFORMED.code, "a condition states each reading once");
  const missing = [...owed.keys()].filter((attribute) => !stated.has(attribute));
  const extra = [...stated].filter((attribute) => !owed.has(attribute));
  if (missing.length > 0 || extra.length > 0) {
    throw refusal(REFUSALS.REQUEST_MALFORMED.code, `the condition's kinds take the readings ${[...owed.keys()].join(", ") || "none"} from it; missing ${missing.join(", ") || "none"}, not taken ${extra.join(", ") || "none"}`);
  }

  // In the order the rules owe them, so the recipe reads the same whichever order a form sent it in.
  const readings: RecipeReading[] = [...owed.values()].map((reading) => {
    const said = statement.readings.find((entry) => entry.attribute === reading.attribute);
    const value = (said?.valueAsWritten ?? "").trim();
    const unit = said?.unitAsWritten ?? "";
    if (!isUnit(unit) || dimensionOf(unit) !== reading.dimension) {
      throw refusal(REFUSALS.REQUEST_MALFORMED.code, `${reading.attribute} is stated in a unit of ${reading.dimension.toLowerCase()}, and "${unit}" is not one`);
    }
    if (!readsAsANumber(value)) throw refusal(REFUSALS.READING_NOT_NUMERIC.code, `the condition's ${reading.attribute} reads "${value}", which states no number`, { attribute: reading.attribute });
    if (!exact(value).isPositive() || exact(value).isZero()) throw refusal(REFUSALS.REQUEST_MALFORMED.code, `the condition's ${reading.attribute} is a size, and a size is more than nothing`);
    return { attribute: reading.attribute, valueAsWritten: value, unitAsWritten: unit, basis: "ENTERED", sourceKey: null };
  });

  return { name, kinds, readings };
}

/* ------------------------------------------------------------------ the chest, read */

/** One kind's running total in the campaign: the sum of the COMPLETE lines published for it. */
export type ConditionTotal = { readonly kind: Kind; readonly unit: Unit; readonly value: string };

/** One condition as the chest lists it. */
export type ChestCondition = {
  readonly conditionId: string;
  readonly name: string;
  readonly geometry: ManualGeometry;
  readonly elementClass: ElementType;
  readonly kinds: readonly RecipeKind[];
  readonly readings: readonly RecipeReading[];
  readonly colour: ConditionColour;
  readonly hatch: ConditionHatch;
  /** The digit that picks it — its place in the chest, 1 to 9 — or null past the ninth (I-573). */
  readonly hotkey: number | null;
  /** Standing hand measurements that cite it in the campaign open now. */
  readonly measured: number;
  /** How many of those every kind of the recipe has a COMPLETE line for. */
  readonly billed: number;
  /** Per kind, the COMPLETE lines' sum — a kind with no complete line is absent, never zero. */
  readonly totals: readonly ConditionTotal[];
};

/** A project's scope, as the chest is read and written in. */
export type ChestScope = { readonly tenantId: string; readonly projectId: string };

/** The standing conditions of one project, in the order they were authored. */
async function standingIn(tx: TenantTx, scope: ChestScope) {
  return tx
    .select()
    .from(conditions)
    .where(and(eq(conditions.tenantId, scope.tenantId), eq(conditions.projectId, scope.projectId), isNull(conditions.retiredAt)))
    .orderBy(asc(conditions.authoredAt), asc(conditions.conditionId));
}

type Tally = { measured: number; billed: number; totals: Map<string, { kind: Kind; unit: Unit; value: ReturnType<typeof exact> }> };

/**
 * What the campaign open now holds of each condition: its standing hand measurements, and the lines
 * the gate published of them. A project with no campaign holds nothing of any.
 */
async function talliesIn(tx: TenantTx, scope: ChestScope, conditionIds: readonly string[]): Promise<Map<string, Tally>> {
  const tallies = new Map<string, Tally>(conditionIds.map((id) => [id, { measured: 0, billed: 0, totals: new Map() }]));
  if (conditionIds.length === 0) return tallies;
  const register = await registerScopeIn(tx, scope.tenantId, scope.projectId);
  if (register === null) return tallies;
  const campaign = await tx
    .select({ campaignId: campaigns.campaignId })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, scope.tenantId), eq(campaigns.setRevisionId, register.setRevisionId)))
    .limit(1);
  const campaignId = campaign[0]?.campaignId;

  const struck = new Set((await repudiatedObjectsIn(tx, register)).map((row) => row.objectKey));
  const measurements = (
    await tx
      .select({ objectKey: manualMeasurements.objectKey, conditionId: manualMeasurements.conditionId, kinds: manualMeasurements.kinds })
      .from(manualMeasurements)
      .where(and(eq(manualMeasurements.tenantId, scope.tenantId), eq(manualMeasurements.setRevisionId, register.setRevisionId), inArray(manualMeasurements.conditionId, [...conditionIds])))
  ).filter((row) => !struck.has(row.objectKey));
  if (measurements.length === 0) return tallies;

  const lines =
    campaignId === undefined
      ? []
      : await tx
          .select({ objectKey: quantityLines.objectKey, kind: quantityLines.kind, unit: quantityLines.unit, value: quantityLines.value, coverage: quantityLines.coverage })
          .from(quantityLines)
          .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.campaignId, campaignId), inArray(quantityLines.objectKey, measurements.map((row) => row.objectKey))));

  for (const measurement of measurements) {
    const tally = tallies.get(measurement.conditionId ?? "");
    if (tally === undefined) continue;
    tally.measured += 1;
    const complete = lines.filter((line) => line.objectKey === measurement.objectKey && line.coverage === "COMPLETE" && line.value !== null);
    const kinds = (measurement.kinds as readonly RecipeKind[]).map((entry) => entry.kind);
    if (kinds.every((kind) => complete.some((line) => line.kind === kind))) tally.billed += 1;
    for (const line of complete) {
      const key = `${line.kind}|${line.unit}`;
      const held = tally.totals.get(key);
      tally.totals.set(key, { kind: line.kind, unit: line.unit, value: (held?.value ?? exact(0)).plus(line.value as string) });
    }
  }
  return tallies;
}

/** The chest of one project: its standing conditions in authored order, each with its hotkey and its running totals (§2.6). */
export async function chestOf(scope: ChestScope): Promise<ChestCondition[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const rows = await standingIn(tx, scope);
    const tallies = await talliesIn(tx, scope, rows.map((row) => row.conditionId));
    return rows.map((row, index) => {
      const tally = tallies.get(row.conditionId);
      return {
        conditionId: row.conditionId,
        name: row.name,
        geometry: row.geometry,
        elementClass: row.elementClass,
        kinds: row.kinds as readonly RecipeKind[],
        readings: row.readings as readonly RecipeReading[],
        colour: row.colour,
        hatch: row.hatch,
        hotkey: index < CONDITION_HOTKEYS ? index + 1 : null,
        measured: tally?.measured ?? 0,
        billed: tally?.billed ?? 0,
        totals: [...(tally?.totals.values() ?? [])].map((total) => ({ kind: total.kind, unit: total.unit, value: total.value.toFixed() })),
      };
    });
  });
}

/* ------------------------------------------------------------------ the chest, written */

/** The one index a second standing condition of one name collides with (schema-manual.ts). */
const NAME_ONCE = "conditions_standing_name_once";

/**
 * Put a condition in the chest: judged first, then written as the person who stated it. A name a
 * standing condition already holds is CONDITION_NAME_TAKEN — asked before the write, and read off the
 * store's own index where two people raced to it, so the second is told, never faulted.
 */
export async function authorCondition(scope: ChestScope, authoredBy: string, statement: ConditionStatement): Promise<{ readonly conditionId: string }> {
  const judged = judgeCondition(statement);
  const taken = (): Error => refusal(REFUSALS.CONDITION_NAME_TAKEN.code, `the chest already holds a standing condition named "${judged.name}"`, { name: judged.name });
  try {
    return await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
      const holding = await tx
        .select({ conditionId: conditions.conditionId })
        .from(conditions)
        .where(and(eq(conditions.tenantId, scope.tenantId), eq(conditions.projectId, scope.projectId), eq(conditions.name, judged.name), isNull(conditions.retiredAt)))
        .limit(1);
      if (holding.length > 0) throw taken();
      const written = await tx
        .insert(conditions)
        .values({
          tenantId: scope.tenantId,
          projectId: scope.projectId,
          name: judged.name,
          geometry: statement.geometry,
          elementClass: statement.elementClass,
          kinds: judged.kinds,
          readings: judged.readings,
          colour: statement.colour,
          hatch: statement.hatch,
          authoredBy,
        })
        .returning({ conditionId: conditions.conditionId });
      const conditionId = written[0]?.conditionId;
      if (conditionId === undefined) throw new Error("the chest's insert returned no row");
      return { conditionId };
    });
  } catch (failure) {
    if (violatesConstraint(failure, NAME_ONCE)) throw taken();
    throw failure;
  }
}

/**
 * Take a condition out of the chest by retiring it (I-374): never a delete, because a measurement
 * cites the condition it was applied from and that citation stays readable by its snapshot. One the
 * chest does not hold standing — retired already, another project's, another workspace's — is
 * CONDITION_NOT_IN_CHEST.
 */
export async function retireCondition(scope: ChestScope, retiredBy: string, conditionId: string): Promise<void> {
  await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    const retired = await tx
      .update(conditions)
      .set({ retiredAt: new Date(), retiredBy })
      .where(and(eq(conditions.tenantId, scope.tenantId), eq(conditions.projectId, scope.projectId), eq(conditions.conditionId, conditionId), isNull(conditions.retiredAt)))
      .returning({ conditionId: conditions.conditionId });
    if (retired.length === 0) throw refusal(REFUSALS.CONDITION_NOT_IN_CHEST.code, `the chest holds no standing condition ${conditionId}`, { conditionId });
  });
}
