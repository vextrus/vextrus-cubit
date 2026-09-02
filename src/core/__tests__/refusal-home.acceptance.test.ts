/**
 * Public acceptance for AC-3 (a) of the model/jobs debt sweep (B-17, ARCH-02, ARCH-03, B-21): the
 * marker-building `refusal()` helper has one exported home, `src/core/faults/refusal-marker.ts`,
 * and every copy under src/core calls it.
 *
 * The home is judged by behaviour — the Error it builds, the marker the one reader reads off it,
 * the detail it carries, the way it fails for a code the taxonomy lacks — and the copies are judged
 * by text, because a byte-copied helper is only observable as bytes: every non-test `.ts` under
 * src/core is read with its comments stripped (`codeOf`), and none but the home may spell the
 * marker's construction. The roster of files is walked, never listed (B-19).
 *
 * `refusal` is read off the module namespace: a named import of an export the tree lacks today
 * would be a type error in this file, and the missing export is the finding.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { refusalOf, type RefusalCode } from "../errors";
import * as marker from "../faults/refusal-marker";
import { REPO_ROOT, codeOf } from "./support/read-source";

/** The sentinel a promise that resolved is reported as, so a test can say "expected a rejection". */
const RESOLVED: unique symbol = Symbol("resolved");

/** The value a promise rejected with, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => RESOLVED,
    (reason: unknown) => reason,
  );

const HOME = "src/core/faults/refusal-marker.ts";
const CORE = "src/core";
const CONSTRUCTION = "Object.assign(new Error";
const HOME_SPECIFIER = "refusal-marker";
const CALL = /\brefusal\s*(?:<[^>]*>)?\s*\(/;

/** The files the criterion names as callers of the home, so each is asserted to import and call it. */
const CALLERS = ["src/core/jobs/probe.ts", "src/core/acts/refusals.ts", "src/core/format.ts", "src/core/model/fixture.ts"];

const REGISTERED: RefusalCode = "FIXTURE_MISSING";
const UNREGISTERED = "NOT_A_REGISTERED_CODE";

type Refusal = (code: string, message: string, detail?: object) => Error;

function home(): Refusal {
  const refusal = (marker as Record<string, unknown>)["refusal"];
  expect(typeof refusal, `${HOME} must export refusal(code, message, detail?) — the one writer of the marker (B-17)`).toBe("function");
  return refusal as Refusal;
}

/** The value a synchronous call threw, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
const thrownBy = (call: () => unknown): Promise<unknown> => rejectionOf(Promise.resolve().then(call));

/** Every non-test `.ts` under `dir`, recursively — test directories and test files skipped, declarations skipped. */
function productSources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") found.push(...productSources(abs));
    } else if (name.endsWith(".ts") && !name.endsWith(".d.ts") && !/\.(?:test|spec)\.ts$/.test(name)) {
      found.push(relative(REPO_ROOT, abs));
    }
  }
  return found;
}

describe("AC-3: the refusal marker has one writer", () => {
  test("AC-3: refusal(code, message) is an Error carrying the registered code, with any detail readable on it", async () => {
    const refusal = home();
    const built = refusal(REGISTERED, "m");
    expect(built, "refusal() answers an Error").toBeInstanceOf(Error);
    expect(built.message, "the message is the operator's detail, verbatim").toBe("m");
    expect(marker.refusalCodeOf(built), "the one reader reads the code back off it").toBe(REGISTERED);
    expect(marker.isRefusalMarked(built), "…and sees it as marked").toBe(true);

    const detailed = refusal(REGISTERED, "with detail", { requestHash: "abc123", attempt: 2 }) as Error & { requestHash?: unknown; attempt?: unknown };
    expect(detailed.requestHash, "a detail property is readable on the Error").toBe("abc123");
    expect(detailed.attempt, "…every own property of it").toBe(2);
    expect(marker.refusalCodeOf(detailed), "the code survives beside the detail").toBe(REGISTERED);

    const asHome = await thrownBy(() => refusal(UNREGISTERED, "m"));
    const asRegistry = await thrownBy(() => refusalOf(UNREGISTERED as RefusalCode));
    expect(asHome, "an unregistered code throws").not.toBe(RESOLVED);
    expect(asHome, "…as an Error").toBeInstanceOf(Error);
    expect(asRegistry, "refusalOf throws for it too").toBeInstanceOf(Error);
    expect((asHome as Error).message, "the home fails exactly as refusalOf does — the taxonomy is the registry's, not the home's").toBe((asRegistry as Error).message);
    expect(marker.refusalCodeOf(asHome), "a failure to build a refusal is not itself a refusal").toBeNull();
  });

  test("AC-3: no non-test file under src/core other than the home spells the marker's construction, and the named callers call the home", () => {
    const sources = productSources(join(REPO_ROOT, CORE));
    expect(sources, "the walk found the home").toContain(HOME);
    const copies = sources.filter((file) => file !== HOME && codeOf(file, "walked from src/core").includes(CONSTRUCTION));
    expect(copies, `these files re-spell the marker instead of calling ${HOME} (B-17, ARCH-02)`).toEqual([]);

    for (const caller of CALLERS) {
      const code = codeOf(caller, "named by AC-3 as a caller of the home");
      expect(code, `${caller} imports the home`).toContain(HOME_SPECIFIER);
      expect(CALL.test(code), `${caller} calls refusal(...)`).toBe(true);
    }
  });
});
