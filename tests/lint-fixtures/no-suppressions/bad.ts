/**
 * Fires: cubit/no-suppressions (Q-08).
 *
 * RECORDED REASON GUARDRAIL_FIXTURE — this is one of exactly three files in the tree that
 * spell a Q-08 construct. Q-08 forbids them "in a change without a recorded reason", and
 * a guardrail has to be proved against the real thing: the reason is stated on the line
 * itself in the machine-readable form the structural check reads, and again in
 * docs/toolchain.md. Everywhere else the constructs are assembled or named by category.
 *
 * The directive below suppresses nothing: the flat config sets noInlineConfig, so no
 * comment in this tree can turn a rule off. The comment is the defect, and the comment is
 * what the rule reports.
 */
/* eslint-disable cubit/no-conversion-literal */ // RECORDED REASON GUARDRAIL_FIXTURE

export function tonnes(kilograms: string): string {
  return kilograms;
}
