/**
 * The `cubit` plugin's published surface, in types — so the guardrail registry can be
 * named in TypeScript (and so tsc has an input before src/ exists, risk note 3).
 */

/** Every rule id the plugin publishes. One per NEVER the Bible states (C-06). */
export type CubitRuleId =
  | 'cubit/db-seam-only'
  | 'cubit/format-seam-only'
  | 'cubit/model-seam-only'
  | 'cubit/no-colour-literal'
  | 'cubit/no-conversion-literal'
  | 'cubit/no-float-arithmetic'
  | 'cubit/no-jsx-string-literal'
  | 'cubit/no-skip-only'
  | 'cubit/no-suppressions';

/** The one registry row the guardrail borrows from typescript-eslint rather than writing. */
export type BorrowedRuleId = '@typescript-eslint/no-explicit-any';

/** A row of the guardrail registry: a fixture directory, a rule, the clause it enforces. */
export interface GuardrailRow {
  readonly dir: string;
  readonly ruleId: CubitRuleId | BorrowedRuleId;
  readonly ext: 'ts' | 'tsx';
  readonly bible: string;
}

export interface CubitPlugin {
  readonly meta: { readonly name: 'cubit'; readonly version: string };
  readonly rules: Readonly<Record<string, unknown>>;
}

declare const plugin: CubitPlugin;
export default plugin;
