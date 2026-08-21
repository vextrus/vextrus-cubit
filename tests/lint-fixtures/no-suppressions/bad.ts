// Q-08 fixture: a guardrail switched off in a comment instead of in the spec.
// RECORDED REASON GUARDRAIL_FIXTURE — the directive below is the increment's
// one committed site for this rule; it exists so that cubit/no-suppressions can
// be proved to fire on a real file (B-05, AC-2). The rule's other branches —
// the type-error suppression comments — are proved from source assembled at run
// time in tests/lint-fixtures/guardrails.test.ts, so this change spells the
// construct once and no more.
// docs/toolchain.md, "The recorded reason for the fixtures themselves".
/* eslint-disable */ // RECORDED REASON GUARDRAIL_FIXTURE
export const rate = 0.05;
