/**
 * The stage the register-JSON acceptance stands on: the door under test, the committed reading it
 * is a function of, and the committed artefacts drift is judged against.
 *
 * The door is loaded by repo-relative path rather than imported statically, so a module the Builder
 * has not written yet fails as an assertion naming the file — the red this increment is owed —
 * rather than as a collection death that reads as the suite's own defect.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import { expect } from "vitest";
import type { RegisterView } from "@/modules/takeoff/register-ui/view";

/** The checkout this lane runs at the root of. */
export const REPO_ROOT: string = process.cwd();

/** The module's one public surface (test contract: the interfaces). */
export const REGISTER_JSON_MODULE = "src/modules/takeoff/export/register-json/index.ts";

/** The hand-authored reading every assertion here is made over (declared fixture). */
export const SAMPLE_VIEW_FIXTURE = "src/modules/takeoff/export/register-json/__tests__/fixtures/register-view.sample.json";

/** The committed serialization of that reading (declared fixture). */
export const EXAMPLE_FIXTURE = "src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.example.json";

/** The committed JSON Schema the live Zod schema is held against (declared fixture). */
export const SCHEMA_FIXTURE = "src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.schema.json";

/** What a deliberate schema change owes, quoted in every drift failure. */
export const BASELINE_DUTY = "a deliberate change re-baselines it in its own `baseline:`-subject commit naming AC-2";

/* ------------------------------------------------------------------ the door */

/**
 * The surface the criteria name, typed structurally: the acceptance judges what the module ANSWERS,
 * so nothing here binds the Builder to an inner file, only to the exports the interfaces declare.
 */
export type RegisterJsonDoor = {
  readonly REGISTER_JSON_SCHEMA_VERSION: unknown;
  readonly RegisterJsonDocument: z.ZodType<unknown>;
  readonly registerJsonOf: (view: RegisterView) => unknown;
  readonly serializeRegisterJson: (document: unknown) => string;
};

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** The export door, with every export the interfaces declare present and of the shape they declare. */
export async function registerJsonDoor(): Promise<RegisterJsonDoor> {
  const loaded = await productModule<Record<string, unknown>>(REGISTER_JSON_MODULE);
  expect(typeof loaded["registerJsonOf"], `${REGISTER_JSON_MODULE} exports \`registerJsonOf\` as a function (AC-1)`).toBe("function");
  expect(typeof loaded["serializeRegisterJson"], `${REGISTER_JSON_MODULE} exports \`serializeRegisterJson\` as a function (interfaces)`).toBe("function");
  const schema = loaded["RegisterJsonDocument"] as { safeParse?: unknown } | undefined;
  expect(typeof schema?.safeParse, `${REGISTER_JSON_MODULE} exports \`RegisterJsonDocument\` as a Zod schema (AC-1)`).toBe("function");
  return loaded as unknown as RegisterJsonDoor;
}

/* ------------------------------------------------------------------ committed files */

/**
 * A committed file this increment owes, read as text; absent says so by name. The only files read
 * through here are the three declared FIXTURES under `__tests__/fixtures/` — the reading the export
 * is a function of, and the two committed artefacts drift is judged against. No product source is
 * read anywhere in this suite: the module is loaded and called, never inspected.
 */
export function readCommitted(relative: string, owed: string): string {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — ${owed}`).toBe(true);
  // white-box: AC-2 — the criterion IS a property of a committed file's content: the JSON Schema
  // fixture must deep-equal what `z.toJSONSchema(RegisterJsonDocument)` answers, so the committed
  // text is the thing under test and cannot be observed any other way. (AC-1 reads the sample
  // reading through this same door: it is the test's own input, not the product's source.)
  return readFileSync(absolute, "utf8");
}

/** A committed JSON file this increment owes, parsed. */
export function readCommittedJson(relative: string, owed: string): unknown {
  return JSON.parse(readCommitted(relative, owed)) as unknown;
}

/* ------------------------------------------------------------------ the reading */

/**
 * The committed reading, with the case it must arm proved before anything is judged over it: a
 * fixture that stopped carrying a PARTIAL_DECLARED line or a repudiated one would let a wrong export
 * pass quietly, so the arming is asserted here rather than assumed (AC-1 states the minimums).
 */
export function sampleView(): RegisterView {
  const parsed = readCommittedJson(SAMPLE_VIEW_FIXTURE, "this increment commits the reading its export is a function of (AC-1)") as RegisterView;
  expect(parsed.campaign, `${SAMPLE_VIEW_FIXTURE} is read under a campaign (AC-1)`).not.toBeNull();
  expect(parsed.objects.length, `${SAMPLE_VIEW_FIXTURE} carries at least three objects (AC-1)`).toBeGreaterThanOrEqual(3);
  expect(parsed.lines.length, `${SAMPLE_VIEW_FIXTURE} carries at least four lines (AC-1)`).toBeGreaterThanOrEqual(4);
  expect(
    parsed.lines.filter((line) => line.coverage === "PARTIAL_DECLARED" && line.value === null).length,
    `${SAMPLE_VIEW_FIXTURE} carries a line kept with no quantity — coverage PARTIAL_DECLARED, value null (AC-1)`,
  ).toBeGreaterThanOrEqual(1);
  expect(parsed.lines.filter((line) => line.repudiated).length, `${SAMPLE_VIEW_FIXTURE} carries a repudiated line (AC-1)`).toBeGreaterThanOrEqual(1);
  expect(parsed.refusals.length, `${SAMPLE_VIEW_FIXTURE} carries at least one refusal (AC-1)`).toBeGreaterThanOrEqual(1);
  expect(parsed.levelStacks.length, `${SAMPLE_VIEW_FIXTURE} carries a level stack — the affordance the document must NOT export (AC-1)`).toBeGreaterThanOrEqual(1);
  return parsed;
}

/* ------------------------------------------------------------------ reading a document */

/** One JSON object of the document, as a bag of unknowns — the document is judged, never trusted. */
export type Bag = Record<string, unknown>;

/** The document as a bag, with a message when the export answered something that is not an object. */
export function asBag(value: unknown, what: string): Bag {
  expect(value !== null && typeof value === "object" && !Array.isArray(value), `${what} is a JSON object`).toBe(true);
  return value as Bag;
}

/** A list of bags, with a message when the export answered something that is not an array. */
export function asBags(value: unknown, what: string): Bag[] {
  expect(Array.isArray(value), `${what} is a JSON array`).toBe(true);
  return (value as unknown[]).map((entry, at) => asBag(entry, `${what}[${at}]`));
}

/** Keys in code-unit order — the order canonical text is written in, and a stable way to compare sets. */
export function sortedKeys(value: object): string[] {
  return Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
