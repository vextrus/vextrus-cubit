// Q-08 fixture: a guardrail switched off in a comment instead of in the spec.
// RECORDED REASON GUARDRAIL_FIXTURE — the constructs below exist so that
// cubit/no-suppressions can be proved to fire on them (B-05, AC-2).
// docs/toolchain.md, "The recorded reason for the fixtures themselves".
/* eslint-disable */
export const rate = 0.05;

// @ts-expect-error the shape is wrong and this hides it
export const total: number = 'not a number';

// @ts-ignore
export const other: number = 'also not a number';
