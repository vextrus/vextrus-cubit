/**
 * The mechanics the register's identity core and its door are graded on (L-REG-01..05, R-TO-051,
 * V-DB, inc-208).
 *
 * Mechanics only — nothing here judges the product. The database, the storage root, the accounts,
 * the projects, the drawing lineages and the pinned set revisions all come from the stages the
 * sheet index and the drawing sets already run on (`../../support/sheets-stage`,
 * `../../sets/support/sets-stage`): one invariant, one home (B-17, ARCH-02). What this file adds is
 * what a REGISTER needs beyond a pinned set revision — the sightings the key grammars are computed
 * over, the mark families ordinals are frozen across, and the reads a criterion checks the store
 * with.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import { sql, type Person } from "../../../spine/uploads/support/upload-stage";
import { actsSeam, pinning, setRevisionRows, setsSeam, stageLineage } from "../../sets/support/sets-stage";
import { ERRORS_MODULE, PRINCIPAL, REPO_ROOT, actRows, actorOf, closeStage, grantRole, openSheetsStage, productModule, stagePerson, unique, type ErrorsSeam, type RefusalEntryShape } from "../../support/sheets-stage";

export { ERRORS_MODULE, PRINCIPAL, REPO_ROOT, actRows, actorOf, closeStage, grantRole, openSheetsStage, productModule, sql, stagePerson, unique };
export type { ErrorsSeam, Person, RefusalEntryShape };

/* ------------------------------------------------------------------ the homes the spec names */

/**
 * The identity core the increment's interfaces publish. Its two named files are read first and the
 * area's barrel after, so a Builder who lays the grammar out in either shape is graded on the same
 * thing: what `src/core/identity` publishes, never which file it spelled it in.
 */
export const IDENTITY_DIR = "src/core/identity";
export const IDENTITY_HOMES: readonly string[] = [`${IDENTITY_DIR}/index.ts`, `${IDENTITY_DIR}/compare-canonical.ts`, `${IDENTITY_DIR}/keys.ts`];

/** The takeoff module's door onto the register (goal: `src/modules/takeoff/register`). */
export const REGISTER_MODULE = "src/modules/takeoff/register/index.ts";

/** The one home of the unit canon a reading is carried through (inc-207, B-17). */
export const UNITS_MODULE = "src/core/units/canon.ts";

/** The one home of the takeoff module tree the eslint stage is graded over (AC-3). */
export const REGISTER_DIR = "src/modules/takeoff/register";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The refusal the door answers a second measured sighting with (L-REG-03, test contract). */
export const DUPLICATE_IDENTITY = "DUPLICATE_IDENTITY";

/** The three standings an attribute is read at (test contract, R-TO-051). */
export const AGREED = "AGREED";
export const SUSPENDED = "SUSPENDED";
export const NONE = "NONE";

/** The lawful-null level slots, and the placeholder a level authored later carries (L-REG-04). */
export const FOUNDATION = "FOUNDATION";
export const UNRESOLVED = "UNRESOLVED";
export const UNREGISTERED_PREFIX = "@unregistered:";

/** The four tables this increment lands (goal, AC-6). */
export const REGISTER_OBJECTS = "register_objects";
export const REFUSED_SIGHTINGS = "refused_sightings";
export const REGISTER_ATTRIBUTES = "register_attributes";
export const REGISTER_OBSERVATIONS = "register_observations";
export const REGISTER_TABLES: readonly string[] = [REGISTER_OBJECTS, REFUSED_SIGHTINGS, REGISTER_ATTRIBUTES, REGISTER_OBSERVATIONS];

/** The ledger whose privilege set an observation's is compared against (AC-5). */
export const ACT_LOG = "acts";

/** The standing a sighting arrives with in this leaf — nothing here writes a DERIVED row (scope). */
export const MEASURED = "MEASURED";

/** How a reading says where it came from (AC-5's `basis`). */
export const TRANSCRIBED = "TRANSCRIBED";
export const ENTERED = "ENTERED";

/** The one correctable attribute these criteria read and write (L-REG-02's examples). */
export const STOREY_HEIGHT = "storey_height";

/** The correctable attribute a semantic carries and an identity never does (L-REG-02, AC-2). */
export const CONCRETE_GRADE = "concrete_grade";

/** The discipline the door is passed — drawing-scoped and human-confirmed elsewhere (scope). */
export const DISCIPLINE = "STRUCTURAL";

/** The element type every staged sighting is of (L-REG-02's key tuple). */
export const ELEMENT_TYPE = "COLUMN";

/* ------------------------------------------------------------------ the shapes the grammars take */

/** A view, as `viewKey` is given one (increment interfaces). */
export type ViewRef = { viewClass: string; captionAnchorSourceKey: string };

/** A level, in each of the four forms `levelSegment` renders (increment interfaces). */
export type LevelRef = { levelId: string } | { slot: string } | { unregistered: string };

/** One bar of a member (increment interfaces: `barKey`). */
export type BarRef = { role: string; diameter: string; sequence: number };

/** What a sighting says about itself beyond its identity — the semantic invalidates on it (AC-2). */
export type SightingContent = {
  evidence: readonly string[];
  attributes: Record<string, string>;
  geometry: { outline: readonly { x: number; y: number }[]; span: { length: string; breadth: string } };
  source: { sheet: string; anchor: string };
};

/** One measured sighting, as the door is given one and as the grammars are computed over one. */
export type Sighting = {
  /** This acceptance's own name for the row — never part of any key. */
  label: string;
  discipline: string;
  elementType: string;
  mark: string;
  view: ViewRef;
  x: number;
  y: number;
  level: LevelRef;
  standing: string;
  bars: readonly BarRef[];
  content: SightingContent;
};

/** One bar of one staged sighting, flattened — what `barKey` is computed over (test contract). */
export type BarSighting = { label: string; of: Sighting; role: string; diameter: string; sequence: number };

/** One row of a mark family, as `ordinalKeys` and `contentSignature` are given one (AC-3). */
export type FamilyRow = { rowId: string; mark: string; length: string; breadth: string; count: string };

/* ------------------------------------------------------------------ the fixture identities */

/**
 * The level a carried key lands on. A surrogate id and nothing else: a level's label, ordinal and
 * height never enter a key (L-REG-02), so this is the only thing about the level a key may say.
 */
export const LEVEL_GF_ID = "8f1d6c3a-0a5e-4a7b-9c2d-11111111ac01";

/** A second surrogate, for the carry that must not happen twice (AC-7). */
export const LEVEL_OTHER_ID = "8f1d6c3a-0a5e-4a7b-9c2d-22222222ac02";

/** The label the placeholder carries, and one that is not the placeholder's (AC-7). */
export const GF_LABEL = "GF";
export const OTHER_LABEL = "1F";

/** The three views the corpus is drawn across. */
export const VIEW_PLAN: ViewRef = Object.freeze({ viewClass: "PLAN", captionAnchorSourceKey: "S-101:t:12" });
export const VIEW_SECTION: ViewRef = Object.freeze({ viewClass: "SECTION", captionAnchorSourceKey: "S-102:t:4" });
export const VIEW_DETAIL: ViewRef = Object.freeze({ viewClass: "DETAIL", captionAnchorSourceKey: "S-103:t:7" });

/**
 * How far apart two placements may stand and still quantise onto the same 0.1 lattice point, and
 * the step at which they cannot (L-REG-04, AC-1). Declared once and cited wherever a criterion
 * nudges a placement — a tolerance transcribed twice is two rules that drift apart (B-19).
 */
export const QUANTISE_EPSILON = 0.04;
export const QUANTISE_STEP = 0.1;

/**
 * A placement standing ON the lattice, so a nudge of either size lands where the rule says it does:
 * within `QUANTISE_EPSILON` it is the same lattice point, at `QUANTISE_STEP` it is the next one.
 */
export const LATTICE_PROBE: { view: ViewRef; mark: string; x: number; y: number } = Object.freeze({ view: VIEW_PLAN, mark: "C1", x: 1000.0, y: 250.0 });

/** The reading COLUMN_C1's storey height is first transcribed as, and the entry that overrules it. */
export const FIRST_VALUE = "10";
export const FIRST_UNIT = "ft";
export const SECOND_VALUE = "3";
export const SECOND_UNIT = "m";

/** The canonical unit a length is carried to — asked of `src/core/units`, never re-spelled (B-17). */
export const CANONICAL_LENGTH_UNIT = "m";

/** One content, built so every depth of it carries more than one key to permute (AC-2). */
function contentOf(o: { grade: string; evidence: readonly string[]; length: string; breadth: string; sheet: string; anchor: string }): SightingContent {
  return {
    evidence: [...o.evidence],
    attributes: { [CONCRETE_GRADE]: o.grade, rebar_spec: "B500B", finish: "FAIR_FACE" },
    geometry: { outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], span: { length: o.length, breadth: o.breadth } },
    source: { sheet: o.sheet, anchor: o.anchor },
  };
}

/** The content every staged sighting of C1 carries. */
export const COLUMN_C1_CONTENT: SightingContent = Object.freeze(
  contentOf({ grade: "C30/37", evidence: ["S-101:e:41", "S-101:e:12", "S-101:e:27"], length: "300.0", breadth: "300.0", sheet: "S-101", anchor: "S-101:t:12" }),
) as SightingContent;

/**
 * The same content with one CORRECTABLE attribute changed. A concrete grade participates in diffs
 * and never in identity (L-REG-02), so this content invalidates a disposition without making a new
 * identity (AC-2).
 */
export const COLUMN_C1_REGRADED: SightingContent = Object.freeze(
  contentOf({ grade: "C40/50", evidence: ["S-101:e:41", "S-101:e:12", "S-101:e:27"], length: "300.0", breadth: "300.0", sheet: "S-101", anchor: "S-101:t:12" }),
) as SightingContent;

/** The bars of a column: two roles, in a sequence that is part of the bar's key (L-REG-04). */
const C1_BARS: readonly BarRef[] = Object.freeze([
  Object.freeze({ role: "MAIN", diameter: "16", sequence: 1 }),
  Object.freeze({ role: "LINK", diameter: "8", sequence: 2 }),
]) as readonly BarRef[];

const ONE_BAR: readonly BarRef[] = Object.freeze([Object.freeze({ role: "MAIN", diameter: "20", sequence: 1 })]) as readonly BarRef[];

function sightingOf(o: { label: string; mark: string; view: ViewRef; x: number; y: number; level: LevelRef; bars: readonly BarRef[]; content?: SightingContent }): Sighting {
  return Object.freeze({
    label: o.label,
    discipline: DISCIPLINE,
    elementType: ELEMENT_TYPE,
    mark: o.mark,
    view: o.view,
    x: o.x,
    y: o.y,
    level: o.level,
    standing: MEASURED,
    bars: o.bars,
    content: o.content ?? COLUMN_C1_CONTENT,
  }) as Sighting;
}

/**
 * The one sighting the door is driven with (test contract: `COLUMN_C1`).
 *
 * Its placement stands off the 0.1 lattice on both axes on purpose: a grammar that carried raw
 * coordinates would answer a different key for the same column measured twice (L-REG-04).
 */
export const COLUMN_C1: Sighting = sightingOf({
  label: "c1-on-gf",
  mark: "C1",
  view: VIEW_PLAN,
  x: 1000.04,
  y: 250.96,
  level: { levelId: LEVEL_GF_ID },
  bars: C1_BARS,
});

/**
 * The corpus every key grammar is computed over (test contract: `KEY_CORPUS`).
 *
 * It carries each of the four level segments L-REG-04 names — a surrogate id, both lawful-null
 * slots, and the `@unregistered:<label>` placeholder under two different labels — so a criterion
 * about one of them is a criterion about the corpus and never about a hand-picked row. The second
 * entry is COLUMN_C1's own placement on the GF placeholder: carrying GF onto its surrogate lands it
 * exactly on the first entry's key (AC-7), which is the whole point of a one-hop carry.
 */
export const KEY_CORPUS: readonly Sighting[] = Object.freeze([
  COLUMN_C1,
  sightingOf({ label: "c1-on-gf-placeholder", mark: "C1", view: VIEW_PLAN, x: 1000.04, y: 250.96, level: { unregistered: GF_LABEL }, bars: C1_BARS }),
  sightingOf({ label: "c2-on-gf-placeholder", mark: "C2", view: VIEW_PLAN, x: 2000.0, y: 250.96, level: { unregistered: GF_LABEL }, bars: ONE_BAR }),
  sightingOf({ label: "c1-on-1f-placeholder", mark: "C1", view: VIEW_PLAN, x: 1000.04, y: 250.96, level: { unregistered: OTHER_LABEL }, bars: ONE_BAR }),
  sightingOf({ label: "c1-on-foundation", mark: "C1", view: VIEW_SECTION, x: -0.04, y: 12.5, level: { slot: FOUNDATION }, bars: ONE_BAR }),
  sightingOf({ label: "c3-unresolved", mark: "C3", view: VIEW_DETAIL, x: 55.55, y: -0.04, level: { slot: UNRESOLVED }, bars: C1_BARS }),
]) as readonly Sighting[];

/** Every bar of the corpus, flattened — what `barKey` is computed over (test contract). */
export const BAR_CORPUS: readonly BarSighting[] = Object.freeze(
  KEY_CORPUS.flatMap((of) => of.bars.map((bar) => Object.freeze({ label: `${of.label}/${bar.role}#${bar.sequence}`, of, role: bar.role, diameter: bar.diameter, sequence: bar.sequence }))),
) as readonly BarSighting[];

/**
 * A mark family of one: a singleton keeps its bare mark (L-REG-05).
 */
export const SINGLETON_FAMILY: readonly FamilyRow[] = Object.freeze([Object.freeze({ rowId: "r7", mark: "C1", length: "3000.0", breadth: "300.0", count: "1" })]) as readonly FamilyRow[];

/**
 * A mark family of three, staged so that the answer is decidable without knowing how the signature
 * is spelled: one row's authored length is smaller than the other two's, and those two are
 * identical in every authored input, so the family sorts by content first and by row id after
 * (L-REG-05, AC-3). The lengths are the same width as strings, so their code-unit order and their
 * numeric order agree whatever separator or field order a signature composes them in.
 *
 * The row ids disagree with both orders on purpose: `r10` stands before `r2` under `compareCanonical`
 * and after it under any numeric reading, and the row that sorts first carries neither.
 */
export const MARK_FAMILY: readonly FamilyRow[] = Object.freeze([
  Object.freeze({ rowId: "r10", mark: "C1", length: "2000.0", breadth: "300.0", count: "1" }),
  Object.freeze({ rowId: "r5", mark: "C1", length: "1000.0", breadth: "300.0", count: "1" }),
  Object.freeze({ rowId: "r2", mark: "C1", length: "2000.0", breadth: "300.0", count: "1" }),
]) as readonly FamilyRow[];

/** The keys `ordinalKeys` owes MARK_FAMILY: content first, row id where the content ties (AC-3). */
export const MARK_FAMILY_KEYS: Readonly<Record<string, string>> = Object.freeze({ r5: "C1#1", r10: "C1#2", r2: "C1#3" });

/* ------------------------------------------------------------------ loading the doors */

/** Everything `src/core/identity` publishes, as this acceptance drives it (increment interfaces). */
export type IdentitySeam = {
  compareCanonical: (a: string, b: string) => number;
  sortCanonical: (values: readonly string[]) => string[];
  quantise: (n: number) => string;
  viewKey: (v: ViewRef) => string;
  placementKey: (p: { view: ViewRef; mark: string; x: number; y: number }) => string;
  instanceKey: (i: { placement: { view: ViewRef; mark: string; x: number; y: number }; level: LevelRef }) => string;
  barKey: (b: { memberKey: string; role: string; diameter: string; sequence: number }) => string;
  levelSegment: (level: LevelRef) => string;
  carryLevel: (key: string, level: { label: string; levelId: string }) => { carried: boolean; key: string };
  ordinalKeys: (family: readonly FamilyRow[]) => Map<string, string> | Record<string, string>;
  contentSignature: (row: FamilyRow) => string;
  canonicalSemantic: (content: unknown) => string;
  semanticDigest: (content: unknown) => string;
  dispositionsCarry: (prior: unknown, next: unknown) => boolean;
  LEVEL_SLOTS: readonly string[];
};

/** The names `src/core/identity` owes this acceptance (increment interfaces, test contract). */
export const IDENTITY_CALLS: readonly (keyof IdentitySeam & string)[] = [
  "compareCanonical",
  "sortCanonical",
  "quantise",
  "viewKey",
  "placementKey",
  "instanceKey",
  "barKey",
  "levelSegment",
  "carryLevel",
  "ordinalKeys",
  "contentSignature",
  "canonicalSemantic",
  "semanticDigest",
  "dispositionsCarry",
];

/** A module of the checkout, or null where the product has not written it yet. */
async function optionalModule(relative: string): Promise<Record<string, unknown> | null> {
  const absolute = join(REPO_ROOT, relative);
  if (!existsSync(absolute)) return null;
  const specifier: string = absolute;
  return (await import(specifier)) as Record<string, unknown>;
}

/**
 * The identity core, whichever of its published homes each grammar stands in.
 *
 * The area is graded, not the file: the increment's interfaces name `compare-canonical.ts` and
 * `keys.ts` and the goal names the directory, so the exports of all three homes are read together
 * and a name missing from every one of them fails as an assertion naming the directory.
 */
export async function identitySeam(): Promise<IdentitySeam> {
  const held: Record<string, unknown> = {};
  for (const home of IDENTITY_HOMES) {
    const module = await optionalModule(home);
    if (module === null) continue;
    for (const [name, value] of Object.entries(module)) held[name] ??= value;
  }
  for (const call of IDENTITY_CALLS) {
    expect(typeof held[call], `${IDENTITY_DIR} publishes \`${call}\` — a grammar this increment's interfaces name (its homes: ${IDENTITY_HOMES.join(", ")})`).toBe("function");
  }
  expect(Array.isArray(held["LEVEL_SLOTS"]), `${IDENTITY_DIR} publishes \`LEVEL_SLOTS\` — the lawful-null slots, as a list (L-REG-04)`).toBe(true);
  return held as unknown as IdentitySeam;
}

/** What one call at the door answers (test contract: `registered`, `objectKey`, `refusal`). */
export type RegisterAnswer = { registered?: boolean; objectKey?: string; refusal?: string } & Record<string, unknown>;

/** What an append answers (test contract: `appended`, `observationId`). */
export type AppendAnswer = { appended?: boolean; observationId?: string; refusal?: string } & Record<string, unknown>;

/** A row of the store, whatever the migration spelled its columns (C-05). */
export type StoreRow = Record<string, unknown>;

/** The scope every call at the register's door is made in — the guard is per SET REVISION (L-REG-03). */
export type RegisterScope = { tenantId: string; projectId: string; setRevisionId: string };

/** One observation, as `appendObservation` is given one (AC-5). */
export type ObservationInput = {
  objectKey: string;
  attribute: string;
  valueAsWritten: string;
  unitAsWritten: string;
  basis: string;
  sourceKey: string;
  precedence: number;
  actId: string | null;
};

/** The door `src/modules/takeoff/register` publishes (goal, test contract). */
export type RegisterSeam = {
  registerSighting: (scope: RegisterScope, sighting: Sighting) => Promise<RegisterAnswer>;
  registerObjectsOf: (scope: RegisterScope) => Promise<StoreRow[]>;
  refusedSightingsOf: (scope: RegisterScope) => Promise<StoreRow[]>;
  appendObservation: (scope: RegisterScope, input: ObservationInput) => Promise<AppendAnswer>;
  observationsOf: (scope: RegisterScope, objectKey: string, attribute: string) => Promise<StoreRow[]>;
  attributeStanding: (scope: RegisterScope, objectKey: string, attribute: string) => Promise<StoreRow>;
};

/** The names the door owes this acceptance (test contract: procedures). */
export const REGISTER_CALLS: readonly (keyof RegisterSeam & string)[] = ["registerSighting", "registerObjectsOf", "refusedSightingsOf", "appendObservation", "observationsOf", "attributeStanding"];

/** The takeoff module's door onto the register, with every call this stage makes asserted by name. */
export async function registerSeam(): Promise<RegisterSeam> {
  const door = await productModule<Record<string, unknown>>(REGISTER_MODULE);
  for (const call of REGISTER_CALLS) {
    expect(typeof door[call], `${REGISTER_MODULE} publishes \`${call}\` — a door this increment's interfaces name`).toBe("function");
  }
  return door as unknown as RegisterSeam;
}

/** The unit canon a reading is carried through — the one home, never re-spelled here (B-17). */
export type UnitsSeam = { convert: (value: string, from: string, to: string) => { ok: boolean; value?: string; code?: string } };

/** What the product's own canon says one as-written reading is, in its canonical unit. */
export async function canonicalOf(value: string, unit: string): Promise<string> {
  const canon = await productModule<UnitsSeam>(UNITS_MODULE);
  const answer = canon.convert(value, unit, CANONICAL_LENGTH_UNIT);
  expect(answer.ok, `${UNITS_MODULE} converts ${value} ${unit} to ${CANONICAL_LENGTH_UNIT}: ${JSON.stringify(answer)}`).toBe(true);
  return String(answer.value);
}

/** The refusal register, read from its one home so nothing re-spells a code (ARCH-02, Q-07). */
export async function refusals(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<ErrorsSeam>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/* ------------------------------------------------------------------ computing the grammars */

/** One sighting's placement, as `placementKey` is given one. */
export function placementOf(sighting: Sighting): { view: ViewRef; mark: string; x: number; y: number } {
  return { view: sighting.view, mark: sighting.mark, x: sighting.x, y: sighting.y };
}

/** One sighting's instance key. */
export function instanceKeyOf(identity: IdentitySeam, sighting: Sighting): string {
  return identity.instanceKey({ placement: placementOf(sighting), level: sighting.level });
}

/**
 * Every key one sighting derives: its view, its placement, its instance row and each of its bars.
 * Derived here once so a criterion that re-derives them re-derives all four the same way (B-19).
 */
export function keysOfSighting(identity: IdentitySeam, sighting: Sighting): string[] {
  const memberKey = instanceKeyOf(identity, sighting);
  return [
    identity.viewKey(sighting.view),
    identity.placementKey(placementOf(sighting)),
    memberKey,
    ...sighting.bars.map((bar) => identity.barKey({ memberKey, role: bar.role, diameter: bar.diameter, sequence: bar.sequence })),
  ];
}

/** Every key the whole corpus derives, in the one code-unit order (AC-1). */
export function corpusKeys(identity: IdentitySeam, corpus: readonly Sighting[] = KEY_CORPUS): string[] {
  return identity.sortCanonical(corpus.flatMap((sighting) => keysOfSighting(identity, sighting)));
}

/** The map `ordinalKeys` answered, whichever carrier it answered in (C-05: shapes are free). */
export function ordinalMapOf(answer: Map<string, string> | Record<string, string> | unknown): Record<string, string> {
  if (answer instanceof Map) return Object.fromEntries([...answer.entries()].map(([rowId, key]) => [String(rowId), String(key)]));
  expect(answer !== null && typeof answer === "object", "`ordinalKeys` answers a map from row id to ordinal key (L-REG-05)").toBe(true);
  return Object.fromEntries(Object.entries(answer as Record<string, unknown>).map(([rowId, key]) => [rowId, String(key)]));
}

/** Every ordering of a family — what "the same map for every permutation" is judged over (AC-3). */
export function permutationsOf<T>(rows: readonly T[]): T[][] {
  if (rows.length <= 1) return [[...rows]];
  const out: T[][] = [];
  for (let at = 0; at < rows.length; at += 1) {
    const rest = [...rows.slice(0, at), ...rows.slice(at + 1)];
    for (const tail of permutationsOf(rest)) out.push([rows[at] as T, ...tail]);
  }
  return out;
}

/* ------------------------------------------------------------------ reading an answer */

/** A field under either the door's spelling or the column's (C-05: response shapes are free). */
export function field(row: Record<string, unknown> | undefined, camel: string, snake: string): unknown {
  if (row === undefined) return undefined;
  return row[camel] ?? row[snake];
}

/** Every string a row carries, arrays and nesting flattened — what the row says, however it spells it. */
export function saidBy(row: unknown): string[] {
  const said: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") said.push(value);
    else if (typeof value === "number" || typeof value === "boolean") said.push(String(value));
    else if (Array.isArray(value)) for (const entry of value) walk(entry);
    else if (value !== null && typeof value === "object") for (const entry of Object.values(value)) walk(entry);
  };
  walk(row);
  return said;
}

/** The rows of an answer that name this key — whatever column the store spelled it in. */
export function rowsSaying(rows: readonly StoreRow[], said: string): StoreRow[] {
  return rows.filter((row) => saidBy(row).includes(said));
}

/** The observation id one appended reading carries. */
export function observationIdOf(answer: AppendAnswer): string {
  const held = field(answer, "observationId", "observation_id");
  expect(typeof held === "string" && held.length > 0, `an appended observation answers its \`observationId\`: ${JSON.stringify(answer)}`).toBe(true);
  return String(held);
}

/** One observation, as the door is given one (test contract: `observation`). */
export function observation(o: {
  objectKey: string;
  attribute?: string;
  valueAsWritten: string;
  unitAsWritten: string;
  basis?: string;
  sourceKey?: string;
  precedence: number;
  actId?: string | null;
}): ObservationInput {
  return {
    objectKey: o.objectKey,
    attribute: o.attribute ?? STOREY_HEIGHT,
    valueAsWritten: o.valueAsWritten,
    unitAsWritten: o.unitAsWritten,
    basis: o.basis ?? TRANSCRIBED,
    sourceKey: o.sourceKey ?? "S-101:t:12",
    precedence: o.precedence,
    actId: o.actId ?? null,
  };
}

/* ------------------------------------------------------------------ reading the store directly */

/** The privileges a role holds on a table, as the catalogue reports them (AC-5, AC-6). */
export function privilegesOf(table: string, role: string): string[] {
  return sql(
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)}
      order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

/** How many foreign keys point AT a table — the join nothing may make (L-REG-03, AC-4). */
export function inboundForeignKeys(table: string): string[] {
  return sql(
    `select pg_get_constraintdef(oid) from pg_constraint
      where contype = 'f' and confrelid = ${lit(`public.${table}`)}::regclass order by conname;`,
  ).map((row) => row[0] ?? "");
}

/** The foreign keys a table itself declares. */
export function outboundForeignKeys(table: string): string[] {
  return sql(
    `select pg_get_constraintdef(oid) from pg_constraint
      where contype = 'f' and conrelid = ${lit(`public.${table}`)}::regclass order by conname;`,
  ).map((row) => row[0] ?? "");
}

/** Every row of one table in one workspace, whole — the acceptance's own audit read. */
export function rowsOf(table: string, tenantId: string): StoreRow[] {
  return sql(
    `select encode(convert_to(row_to_json(t)::text, 'UTF8'), 'hex') from ${ident(table)} t
      where t.${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid;`,
  ).map((row) => JSON.parse(Buffer.from(row[0] ?? "", "hex").toString("utf8")) as StoreRow);
}

/* ------------------------------------------------------------------ staging a set revision */

/** A pinned set revision, and everything a register call made against it needs (test contract). */
export type StagedRevision = {
  person: Person;
  projectId: string;
  setId: string;
  setRevisionId: string;
  scope: RegisterScope;
  /** Drawings of the project not yet in the set — what a further pin is made of. */
  spare: string[];
};

/** The revision ids one set holds today. */
function revisionIdsOf(tenantId: string, setId: string): string[] {
  return setRevisionRows(tenantId, setId).map((row) => row.setRevisionId);
}

/** Pin the set as it stands, and answer the revision id that pin added. */
async function pinOnce(person: Person, projectId: string, setId: string): Promise<string> {
  const acts = await actsSeam();
  const before = new Set(revisionIdsOf(person.tenantId, setId));
  const input = pinning(projectId, setId);
  const consequence = await acts.preview(actorOf(person), input);
  await acts.commit(actorOf(person), input, acts.consequenceDigest(consequence));
  const added = revisionIdsOf(person.tenantId, setId).filter((id) => !before.has(id));
  expect(added.length, "pinning the set added exactly one revision to the ledger (L-REG-06)").toBe(1);
  return added[0] as string;
}

/**
 * A pinned drawing-set revision of a fresh project (test contract: `stageSetRevision`).
 *
 * Driven through the shipped path and never around it: three lineages are recorded, two of them are
 * toggled into a set and the set is pinned through the one act seam — so the revision a register
 * call is scoped to is a real `drawing_set_revisions` row the product itself wrote (B-17). The
 * third lineage stays outside the set, so `anotherSetRevision` has a change to pin.
 */
export async function stageSetRevision(label: string): Promise<StagedRevision> {
  await openSheetsStage();
  const { person, projectId } = await stagePerson(`register-${label}`);
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
  const sets = await setsSeam();
  const setScope = { tenantId: person.tenantId, projectId };

  const names = [unique(`${label}-a.dxf`), unique(`${label}-b.dxf`), unique(`${label}-c.dxf`)];
  for (const name of names) await stageLineage(person, projectId, name, [`${name}-1`]);
  const lineages = (await sets.drawingLineagesOf(setScope)).filter((lineage) => names.includes(lineage.name));
  expect(lineages.length, `the three lineages staged for ${label} stand in the module's answer`).toBe(3);

  const created = await sets.createSet(setScope, { userId: person.userId }, unique(`${label} set`));
  expect(created.created, `the set for ${label} was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  for (const member of lineages.slice(0, 2)) {
    const toggled = await sets.toggleMember(setScope, setId, member.drawingId);
    expect(toggled.toggled, `${member.name} was toggled into the set: ${JSON.stringify(toggled)}`).toBe(true);
  }

  const setRevisionId = await pinOnce(person, projectId, setId);
  return {
    person,
    projectId,
    setId,
    setRevisionId,
    scope: { tenantId: person.tenantId, projectId, setRevisionId },
    spare: lineages.slice(2).map((lineage) => lineage.drawingId),
  };
}

/**
 * A SECOND pinned revision of the same set in the same project — the scope the double-count guard
 * does not reach across (L-REG-03: "inside one drawing-set revision", AC-4).
 */
export async function anotherSetRevision(staged: StagedRevision): Promise<StagedRevision> {
  const sets = await setsSeam();
  const setScope = { tenantId: staged.person.tenantId, projectId: staged.projectId };
  const drawingId = staged.spare[0];
  expect(typeof drawingId, "a drawing of the project stands outside the set, so a further pin has something to change").toBe("string");
  const toggled = await sets.toggleMember(setScope, staged.setId, drawingId as string);
  expect(toggled.toggled, `the spare drawing was toggled into the set: ${JSON.stringify(toggled)}`).toBe(true);

  const setRevisionId = await pinOnce(staged.person, staged.projectId, staged.setId);
  expect(setRevisionId, "the second pin is a different revision of the same set").not.toBe(staged.setRevisionId);
  return { ...staged, setRevisionId, scope: { ...staged.scope, setRevisionId }, spare: staged.spare.slice(1) };
}
