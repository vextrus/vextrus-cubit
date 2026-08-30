/**
 * Acceptance support for the Quantity Register's identity grammar and register core
 * (L-REG-01..L-REG-05): the module homes this increment declares, the loader every case reaches
 * them through, and the shape-tolerant readers the cases share.
 *
 * Product modules are loaded by absolute path, exactly as `src/core/catalogue/__tests__/support/
 * wire.ts` and `tests/server/support/wire.ts` load theirs: a module the Builder has not written yet
 * must fail as an assertion naming the file, never as an unreadable resolution error that kills
 * collection.
 *
 * NOTE FOR THE BUILDER: because the load is by absolute path, the `@/*` tsconfig alias is never
 * resolved inside these modules — keep imports between `src/` files relative, as `src/core/db.ts`
 * does.
 *
 * Nothing here transcribes an answer (B-19). Every expected ordering is re-derived from the tree's
 * own `contentSignature` and `compareCanonical`; every expected key is re-composed from the tree's
 * own key builders. The readers below deliberately do not dictate the shape of what
 * `assignOrdinals` or `reconcileRows` answers with — a Map, a plain record and a list of entries
 * are all read the same way, so the Builder keeps that choice.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout this suite judges. */
export const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

/* ------------------------------------------------------------------ the declared homes */

export const IDENTITY_MODULE = "src/core/identity/index.ts";
export const REGISTER_MODULE = "src/modules/takeoff/register/index.ts";

/** The one refusal this increment registers, spelled where the spec spells it (B-12). */
export const DUPLICATE_IDENTITY = "DUPLICATE_IDENTITY";

/** The prefix an unauthored level slot renders with (L-REG-04's one-hop carry). */
export const UNREGISTERED_PREFIX = "@unregistered:";

/** The two dispositions reconciliation tags an entry with (L-REG-04). */
export const CARRIED = "carried";
export const RE_PRESENTS = "re-presents";

/** The quantisation step world coordinates are reduced to before they key (L-REG-04). */
export const QUANTUM = 0.1;

/* ------------------------------------------------------------------------- the loader */

/**
 * A product module, asserted to exist before it is imported. The specifier is held in a variable so
 * the transform cannot resolve it at build time — an absent module is this assertion, not a crash.
 */
export async function productModule<T>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------- the shapes the test contract declares */

/** The authored inputs a mark family's content signature is taken over (L-REG-05). */
export type Authored = { mark: string; length: string; breadth: string; count: string };

/** The two lawful-null level slots, named by lowercase keys (Q-07 keeps SCREAMING_SNAKE out of src). */
export type LevelSlots = { foundation: string; unresolved: string };

export interface IdentityModule {
  compareCanonical(a: string, b: string): number;
  canonicalSemantic(value: unknown): string;
  contentSignature(authored: Authored): string;
  viewKey(input: { viewClass: string; captionAnchorSourceKey: string }): string;
  placementKey(input: { viewKey: string; mark: string; x: number; y: number }): string;
  instanceRowKey(input: { placementKey: string; levelSlot: string }): string;
  barRowKey(input: { memberKey: string; role: string; diameter: number; sequence: number }): string;
  unregisteredLevelSlot(label: string): string;
  levelSlot: LevelSlots;
}

/** One measured sighting, exactly as the increment's interfaces spell it. */
export interface Sighting {
  setRevisionKey: string;
  discipline: string;
  elementType: string;
  mark: string;
  viewClass: string;
  captionAnchorSourceKey: string;
  x: number;
  y: number;
  levelSlot: string;
  authored: { length: string; breadth: string; count: string };
  attributes: Record<string, string>;
  evidence: string[];
}

/** What a derived row carries. */
export interface RegisterRow {
  rowKey: string;
  mark: string;
  semantic: string;
  sighting: Sighting;
}

export type Scope = { tenantId: string; projectId: string };

export interface RegisterModule {
  deriveRegisterRows(sightings: Sighting[]): RegisterRow[];
  assignOrdinals(rows: RegisterRow[], frozen?: unknown): unknown;
  reconcileRows(prior: RegisterRow[], next: RegisterRow[]): unknown;
  admitSighting(scope: Scope, sighting: Sighting): unknown;
  carryLevel(scope: Scope, input: { setRevisionKey: string; label: string; levelId: string }): unknown;
}

/* ---------------------------------------------------------------- memoised module loads */

const memo = new Map<string, Promise<unknown>>();

function once<T>(relative: string, check: (loaded: T) => void): Promise<T> {
  const pending =
    memo.get(relative) ??
    (async (): Promise<T> => {
      const loaded = await productModule<T>(relative);
      check(loaded);
      return loaded;
    })();
  memo.set(relative, pending);
  return pending as Promise<T>;
}

/** A named export that has to be callable, or a failure naming the export the contract owes. */
export function exported<T>(module: object, name: string, home: string): T {
  const value = (module as Record<string, unknown>)[name];
  expect(typeof value, `${home} must export ${name} — the increment's interfaces name it`).not.toBe("undefined");
  return value as T;
}

export const loadIdentity = (): Promise<IdentityModule> =>
  once<IdentityModule>(IDENTITY_MODULE, (m) => {
    for (const name of ["compareCanonical", "canonicalSemantic", "contentSignature", "viewKey", "placementKey", "instanceRowKey", "barRowKey", "unregisteredLevelSlot"]) {
      expect(typeof (m as unknown as Record<string, unknown>)[name], `${IDENTITY_MODULE} must export ${name}() — the increment's interfaces name it`).toBe("function");
    }
    expect(m.levelSlot, `${IDENTITY_MODULE} must export levelSlot, the lawful-null slot pair`).toBeTypeOf("object");
  });

export const loadRegister = (): Promise<RegisterModule> =>
  once<RegisterModule>(REGISTER_MODULE, (m) => {
    for (const name of ["deriveRegisterRows", "assignOrdinals", "reconcileRows", "admitSighting", "carryLevel"]) {
      expect(typeof (m as unknown as Record<string, unknown>)[name], `${REGISTER_MODULE} must export ${name}() — the increment's interfaces name it`).toBe("function");
    }
  });

/* --------------------------------------------------------------------- shared mechanics */

/** UTF-16 code-unit order, written out here so `compareCanonical` is judged against the rule. */
export function codeUnitCompare(a: string, b: string): number {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    const left = a.charCodeAt(index);
    const right = b.charCodeAt(index);
    if (left !== right) return left - right;
  }
  return a.length - b.length;
}

/** A comparison read as its sign alone — a comparator may answer any magnitude it likes. */
export const sign = (value: number): number => (value < 0 ? -1 : value > 0 ? 1 : 0);

/**
 * A `rowKey → ordinal key` answer, read past its container. A Map, a plain record and a list of
 * pairs or of entry objects all say the same thing, so the container stays the Builder's choice
 * and no case here fails over one.
 */
export function asLookup(answer: unknown, what: string): Map<string, string> {
  const found = new Map<string, string>();
  if (answer instanceof Map) {
    for (const [key, value] of answer) found.set(String(key), String(value));
    return found;
  }
  if (Array.isArray(answer)) {
    for (const entry of answer) {
      if (Array.isArray(entry) && entry.length >= 2) {
        found.set(String(entry[0]), String(entry[1]));
        continue;
      }
      const record = entry as Record<string, unknown> | null;
      const key = record?.["rowKey"];
      const ordinal = record?.["ordinalKey"] ?? record?.["ordinal"];
      if (typeof key === "string" && typeof ordinal === "string") found.set(key, ordinal);
    }
    if (found.size > 0) return found;
  }
  if (typeof answer === "object" && answer !== null) {
    for (const [key, value] of Object.entries(answer as Record<string, unknown>)) {
      if (typeof value === "string") found.set(key, value);
    }
    if (found.size > 0) return found;
  }
  expect.fail(`${what} must answer a rowKey → ordinal key mapping; got ${Object.prototype.toString.call(answer)}`);
}

/** Every string reachable inside a value — how a shape-tolerant reader looks for a known name. */
export function stringsIn(value: unknown, depth = 0): string[] {
  if (typeof value === "string") return [value];
  if (depth > 6 || value === null || typeof value !== "object") return [];
  const parts = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return parts.flatMap((part) => stringsIn(part, depth + 1));
}

/** The tag a reconciliation entry wears, found by value rather than by a field name. */
export function tagOf(entry: unknown, what: string): string {
  const carried = stringsIn(entry).filter((text) => text === CARRIED || text === RE_PRESENTS);
  expect(carried.length, `${what} must be tagged "${CARRIED}" or "${RE_PRESENTS}" (L-REG-04); entry reads ${JSON.stringify(entry)}`).toBeGreaterThan(0);
  const unique = new Set(carried);
  expect(unique.size, `${what} wears two different dispositions at once: ${[...unique].join(", ")}`).toBe(1);
  return carried[0] ?? "";
}

/** The row key a reconciliation entry names, matched against the keys actually in play. */
export function keyOf(entry: unknown, known: ReadonlySet<string>, what: string): string {
  const named = stringsIn(entry).filter((text) => known.has(text));
  expect(named.length, `${what} must name the row key it reconciles; entry reads ${JSON.stringify(entry)}`).toBeGreaterThan(0);
  return named[0] ?? "";
}

/** A list of reconciliation entries, however the answer wraps them. */
export function entriesOf(answer: unknown, what: string): unknown[] {
  if (Array.isArray(answer)) return answer;
  if (answer instanceof Map) return [...answer.values()];
  if (typeof answer === "object" && answer !== null) {
    const values = Object.values(answer as Record<string, unknown>);
    if (values.every((value) => Array.isArray(value))) return values.flat();
    return values;
  }
  expect.fail(`${what} must answer a list of reconciliation entries; got ${Object.prototype.toString.call(answer)}`);
}

/* ------------------------------------------------------------------ scenario mechanics */

/** A sighting with everything the contract requires, and only what a case overrides changed. */
export function sightingOf(overrides: Partial<Sighting> = {}): Sighting {
  return {
    setRevisionKey: "set-rev-a",
    discipline: "structural",
    elementType: "column",
    mark: "C1",
    viewClass: "plan",
    captionAnchorSourceKey: "sheet-s101#caption-1",
    x: 1.21,
    y: 4.02,
    levelSlot: "level-surrogate-1",
    authored: { length: "3.000", breadth: "0.300", count: "1" },
    attributes: { concreteGrade: "C30" },
    evidence: ["sheet-s101#dim-12"],
    ...overrides,
  };
}

/** The key `deriveRegisterRows` owes this sighting, re-composed from the tree's own builders. */
export function composedRowKey(identity: IdentityModule, sighting: Sighting): string {
  const view = identity.viewKey({ viewClass: sighting.viewClass, captionAnchorSourceKey: sighting.captionAnchorSourceKey });
  const placement = identity.placementKey({ viewKey: view, mark: sighting.mark, x: sighting.x, y: sighting.y });
  return identity.instanceRowKey({ placementKey: placement, levelSlot: sighting.levelSlot });
}

/** A multiset of keys, compared as a sorted list so a repeated key is not silently collapsed. */
export const multiset = (keys: readonly string[]): string[] => [...keys].sort(codeUnitCompare);

/** Wait long enough that the wall clock has certainly moved on between two derivations. */
export const laterMoment = (): Promise<void> => new Promise((done) => setTimeout(done, 5));
