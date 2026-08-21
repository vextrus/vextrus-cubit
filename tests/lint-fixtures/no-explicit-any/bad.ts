// Q-08 fixture: `any` deletes the type system one parameter at a time.
// RECORDED REASON GUARDRAIL_FIXTURE — the annotation below exists so that
// @typescript-eslint/no-explicit-any can be proved to fire on it (B-05, AC-2).
// One site, because one is what the proof costs: the rule is upstream and the
// fixture's job is to show it bound at severity error over this directory.
// docs/toolchain.md, "The recorded reason for the fixtures themselves".
export function normalise(payload: any): any {
  return payload;
}
