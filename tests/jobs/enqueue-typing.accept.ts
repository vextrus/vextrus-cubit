/**
 * AC-1, the compile-time half: SEAM-JOBS' payloads are typed *per kind*, so a payload that is not
 * assignable to `JobPayloads["probe"]` is a type error at the `enqueue` call.
 *
 * This file is graded by `tsc --noEmit` (the `types` lane), not by vitest — it is plain `.ts`, it
 * is inside `tsconfig.json`'s `tests/**` include, and it asserts by *being compilable*. A negative
 * case cannot be written as an error-suppression comment here: Q-08 bans every suppression
 * directive in this tree (`cubit/no-suppressions`), so "this would not compile" is expressed as a
 * conditional type over the very parameter the call site takes, which fails the build when the
 * type is too loose.
 *
 * Nothing below spells the payload's rules twice: `ProbePayloadAtTheCall` is inferred out of
 * `enqueue`'s own signature, and the refusal vocabulary is read off `REFUSALS`.
 */
import { enqueue, JOB_KINDS, type JobKind, type JobPayloads } from "../../src/core/jobs/index";
import { REFUSALS } from "../../src/core/errors";

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
export type ProbePayloadAtTheCall = typeof enqueue extends (kind: "probe", payload: infer P, ...rest: never[]) => unknown ? P : never;

/** The call site's payload for a kind is that kind's declared payload, exactly. */
export type ProbeCallTakesTheProbePayload = Expect<Exactly<ProbePayloadAtTheCall, JobPayloads["probe"]>>;

/** The kind vocabulary, the exported policy table and the payload map are one roster, not three. */
export type KindsAreThePolicyTablesKeys = Expect<Exactly<JobKind, keyof typeof JOB_KINDS>>;
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
export type ARegisteredCodeIsAcceptedAsARefusal = Expect<Assignable<{ steps: string[]; refuseWith: keyof typeof REFUSALS }, ProbePayloadAtTheCall>>;
export type AnUnregisteredRefusalIsRefused = Expect<Not<Assignable<{ steps: string[]; refuseWith: string }, ProbePayloadAtTheCall>>>;

/** What the seam answers an enqueuer: the job, and whether this call was the duplicate. */
export type TheAnswerNamesTheJobAndTheDeduplication = Expect<Assignable<Awaited<ReturnType<typeof enqueue>>, { jobId: string; deduplicated: boolean }>>;

/**
 * The assertion as a real call, so "a type error at the enqueue call" is judged at a call and not
 * only in the type space. The annotation is the contract's answer shape; the argument is the
 * contract's payload.
 */
export const enqueueATypedProbe = async (): Promise<{ jobId: string; deduplicated: boolean }> =>
  await enqueue("probe", { steps: ["survey", "settle"], stepDelayMs: 5, failAtStep: "settle" }, { key: "typed-acceptance" });
