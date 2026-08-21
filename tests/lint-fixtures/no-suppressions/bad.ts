// Q-08 fixture: a guardrail switched off in a comment instead of in the spec.
/* eslint-disable cubit/no-float-arithmetic */
export const rate = 0.05;

// @ts-expect-error the shape is wrong and this hides it
export const total: number = 'not a number';

// @ts-ignore
export const other: number = 'also not a number';
