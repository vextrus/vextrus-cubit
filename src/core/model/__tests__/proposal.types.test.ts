/**
 * Compile-time acceptance for AC-6 of the proposal contract (L-AI-02), with the AC-1 half that only
 * a type can prove. `tsc --noEmit` is the runner for the conditional types; the aliases are gathered
 * into one exported type so nothing here is an unused local, and every product type is named in
 * TYPE POSITION only, so the one runtime test below fails as an assertion naming the barrel rather
 * than dying at import resolution.
 *
 * What is proved: a `Proposal<T>` is assignable to nothing the schema, the ledger, a request or a
 * JSON payload accepts — because `kind` is a unique-symbol VALUE, never a string brand — and its
 * `sources` is a non-empty tuple of well-formed keys, never a plain array or a bare handle.
 */
import { expect, test } from "vitest";
import { barrel } from "./support/seam";

/** The barrel's proposal surface as this anchor reads it — optional, so absence is a finding. */
type ProposalBarrel = { propose?: unknown };

/* ------------------------------------------------------------------ *
 * The helper aliases, as src/core/model-ledger.types.test.ts spells them.
 * ------------------------------------------------------------------ */

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Assignable<From, To> = [From] extends [To] ? true : false;

/* ------------------------------------------------------------------ *
 * The product's types, reached in type position only.
 * ------------------------------------------------------------------ */

type ProposalModule = typeof import("../proposal");
type Proposal<T> = import("../proposal").Proposal<T>;
type SourceKey = import("../sources").SourceKey;
type JsonValue = import("../types").JsonValue;
type ModelLedgerRow = import("../types").ModelLedgerRow;
type ModelRequest = import("../types").ModelRequest;
type RefusalCode = import("../../errors").RefusalCode;

/** Every table db/schema exports, by its insert type — derived by reflection, never transcribed. */
type Schema = typeof import("../../../../db/schema");
type InsertOf<T> = T extends { $inferInsert: infer I } ? I : never;
type AnySchemaInsert = { [K in keyof Schema]: InsertOf<Schema[K]> }[keyof Schema];

/** What one entry of a request's params may be. */
type ParamValue = NonNullable<ModelRequest["params"]>[string];

/* ------------------------------------------------------------------ *
 * AC-6: a Proposal is assignable to nothing that carries data.
 * ------------------------------------------------------------------ */

/** Not a JSON payload: a symbol-valued `kind` is nothing JSON can spell. */
type NotAJsonPayload = Expect<Not<Assignable<Proposal<JsonValue>, JsonValue>>>;
/** Not a ledger row. */
type NotALedgerRow = Expect<Not<Assignable<Proposal<JsonValue>, ModelLedgerRow>>>;
/** Not a request param. */
type NotARequestParam = Expect<Not<Assignable<Proposal<JsonValue>, ParamValue>>>;
/** Not an insert into any table the schema exports (L-AI-02: nothing in the schema accepts a Proposal). */
type NotASchemaInsert = Expect<Not<Assignable<Proposal<JsonValue>, AnySchemaInsert>>>;
/** The schema reflection is real: at least one exported table yields an insert type. */
type SchemaHasTables = Expect<Not<Assignable<AnySchemaInsert, never>>>;

/** `sources` is a non-empty tuple, so a plain array — which may be empty — is not one. */
type SourcesAreNotAnArray = Expect<Not<Assignable<SourceKey[], Proposal<unknown>["sources"]>>>;
/** A bare handle is not a source key: the scheme rides per key (L-CAD-02). */
type BareHandleIsNotAKey = Expect<Not<Assignable<"1F", SourceKey>>>;
/** A scheme outside the closed set is not a source key. */
type ForeignSchemeIsNotAKey = Expect<Not<Assignable<"HANDLE:1F", SourceKey>>>;
/** And one well-formed key is a `sources`. */
type OneKeyIsSources = Expect<Assignable<["DXF_HANDLE:1F"], Proposal<unknown>["sources"]>>;

/** `kind` is the barrel's unique symbol itself — not any symbol. */
type KindIsThePinnedSymbol = Expect<Assignable<ProposalModule["PROPOSAL_KIND"], Proposal<unknown>["kind"]>>;
type KindIsNotAnySymbol = Expect<Not<Assignable<symbol, Proposal<unknown>["kind"]>>>;

/* ------------------------------------------------------------------ *
 * AC-1: the RefusalCode union includes the three codes.
 * ------------------------------------------------------------------ */

type ResolutionCodesAreRegistered = Expect<Assignable<"UNSOURCED" | "SOURCE_UNRESOLVED" | "MALFORMED", RefusalCode>>;

export type CompileTimeAcceptance = [
  NotAJsonPayload,
  NotALedgerRow,
  NotARequestParam,
  NotASchemaInsert,
  SchemaHasTables,
  SourcesAreNotAnArray,
  BareHandleIsNotAKey,
  ForeignSchemeIsNotAKey,
  OneKeyIsSources,
  KindIsThePinnedSymbol,
  KindIsNotAnySymbol,
  ResolutionCodesAreRegistered,
];

/* ------------------------------------------------------------------ *
 * The runtime anchor: a collected file with zero tests fails as "no test suite".
 * ------------------------------------------------------------------ */

test("AC-6: the barrel's propose is a function (runtime anchor for the compile-time proofs above)", async () => {
  const loaded = (await barrel()) as unknown as ProposalBarrel;
  expect(typeof loaded.propose, "src/core/model/index.ts exports propose(ctx, request, contract) (L-AI-02)").toBe("function");
});
