// Q-08 fixture: `any` deletes the type system one parameter at a time.
// RECORDED REASON GUARDRAIL_FIXTURE — the annotations below exist so that
// @typescript-eslint/no-explicit-any can be proved to fire on them (B-05, AC-2).
// docs/toolchain.md, "The recorded reason for the fixtures themselves".
export function normalise(payload: any): any {
  return payload;
}

export const cache: Record<string, any> = {};
