/**
 * AC-1, the compile-time half: SEAM-JOBS' payloads are typed *per kind*, so a payload that is not
 * assignable to `JobPayloads["probe"]` is a type error at the `enqueue` call.
 *
 * Most of this file is graded by `tsc --noEmit` (the `types` lane) rather than by an expectation:
 * it is plain `.ts`, it sits inside `tsconfig.json`'s `tests/**` include, and it asserts by *being
 * compilable*. A negative case cannot be written as an error-suppression comment here: Q-08 bans
 * every suppression directive in this tree (`cubit/no-suppressions`), so "this would not compile"
 * is expressed as a conditional type over the very parameter the call site takes, which fails the
 * build when the type is too loose.
 *
 * The seam is named in *type position* (`typeof import(…)`) and loaded at runtime through
 * `productModule`, the idiom `src/core/acts/__tests__/act-map.acceptance.test.ts` already uses: a
 * type-position specifier is erased by the test transform and resolved by tsc, which is what lets
 * one file be both a vitest suite and a tsc assertion. A module the Builder has not written yet
 * then fails as an assertion naming the file, never as a resolution error that kills collection.
 *
 * Nothing below spells the payload's rules twice: `ProbePayloadAtTheCall` is inferred out of
 * `enqueue`'s own signature, and the refusal vocabulary is read off `REFUSALS`.
 */
import { describe, expect, test } from "vitest";
import { JOBS_MODULE, productModule, type JobsModule } from "./support/jobs-acceptance";

/** The seam and the refusal registry as tsc reads them — erased before the test transform looks. */
type JobsSeam = typeof import("../../src/core/jobs/index");
type Errors = typeof import("../../src/core/errors");

type JobKind = import("../../src/core/jobs/index").JobKind;
type JobPayloads = import("../../src/core/jobs/index").JobPayloads;

/** The kind the spec builds in so every path can be driven end to end. */
const PROBE = "probe";

/* ------------------------------------------------------------------ *
 * The compile-time half of AC-1.
 * ------------------------------------------------------------------ */

/** A compile-time assertion: the alias only resolves when the fact it names is `true`. */
export type Expect<T extends true> = T;

/** Would a value of `A` be accepted where `B` is wanted? Tupled, so a union is judged whole. */
export type Assignable<A, B> = [A] extends [B] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;

/** Exact identity, both directions — `extends` alone calls `Record<string, X>` a match (B-19). */
export type Exactly<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * The payload the *call site* demands when the kind is "probe". Read out of `enqueue` itself, so a
 * signature that takes one union of payloads for every kind (and would therefore accept an ingest
 * payload for a probe) cannot satisfy the assertions below.
 */
export type ProbePayloadAtTheCall = JobsSeam["enqueue"] extends (kind: "probe", payload: infer P, ...rest: never[]) => unknown ? P : never;

/** The call site's payload for a kind is that kind's declared payload, exactly. */
export type ProbeCallTakesTheProbePayload = Expect<Exactly<ProbePayloadAtTheCall, JobPayloads["probe"]>>;

/** The kind vocabulary, the exported policy table and the payload map are one roster, not three. */
export type KindsAreThePolicyTablesKeys = Expect<Exactly<JobKind, keyof JobsSeam["JOB_KINDS"]>>;
export type EveryKindHasAPayload = Expect<Exactly<JobKind, keyof JobPayloads>>;
export type AnUnregisteredKindIsNotAKind = Expect<Not<Assignable<"not-a-registered-kind", JobKind>>>;

/** The declared probe payload compiles; its optional fields stay optional. */
export type TheDeclaredProbePayloadIsAccepted = Expect<Assignable<{ steps: string[]; stepDelayMs: number; failAtStep: string }, ProbePayloadAtTheCall>>;
export type StepsAloneIsEnough = Expect<Assignable<{ steps: string[] }, ProbePayloadAtTheCall>>;

/** …and the shapes that are not the probe's payload are refused where the call is written. */
export type StepsMustBeStrings = Expect<Not<Assignable<{ steps: number[] }, ProbePayloadAtTheCall>>>;
export type StepsAreRequired = Expect<Not<Assignable<{ stepDelayMs: number }, ProbePayloadAtTheCall>>>;
export type ANumberIsNotAPayload = Expect<Not<Assignable<number, ProbePayloadAtTheCall>>>;

/** `refuseWith` is a key of the refusal registry (`src/core/errors.ts`), never a free string. */
export type ARegisteredCodeIsAcceptedAsARefusal = Expect<Assignable<{ steps: string[]; refuseWith: keyof Errors["REFUSALS"] }, ProbePayloadAtTheCall>>;
export type AnUnregisteredRefusalIsRefused = Expect<Not<Assignable<{ steps: string[]; refuseWith: string }, ProbePayloadAtTheCall>>>;

/** What the seam answers an enqueuer: the job, and whether this call was the duplicate. */
export type TheAnswerNamesTheJobAndTheDeduplication = Expect<Assignable<Awaited<ReturnType<JobsSeam["enqueue"]>>, { jobId: string; deduplicated: boolean }>>;

/**
 * The assertion as a real call, so "a type error at the enqueue call" is judged at a call and not
 * only in the type space. The annotation is the contract's answer shape; the argument is the
 * contract's payload. The seam arrives as a parameter because this file names it in type position
 * only — tsc grades the call, and nothing here has to run it.
 */
export const enqueueATypedProbe = async (jobs: JobsSeam): Promise<{ jobId: string; deduplicated: boolean }> =>
  await jobs.enqueue("probe", { steps: ["survey", "settle"], stepDelayMs: 5, failAtStep: "settle" }, { key: "typed-acceptance" });

/* ------------------------------------------------------------------ *
 * The runtime anchor: the call site the assertions above are written against exists.
 * ------------------------------------------------------------------ */

describe("AC-1: typed enqueue", () => {
  test("AC-1: the seam exports the enqueue call site the type assertions are written against", async () => {
    const jobs = await productModule<JobsModule>(JOBS_MODULE);

    expect(typeof jobs.enqueue, `${JOBS_MODULE} must export enqueue — the call the payload types are read off`).toBe("function");

    // The runtime shadow of `KindsAreThePolicyTablesKeys`: the kind this file types a payload for
    // is a kind the exported policy table knows. Containment, not a frozen roster — the table is
    // the denominator, so a kind joining it is not a failure (B-19).
    expect(Object.keys(jobs.JOB_KINDS)).toContain(PROBE);
  });
});
