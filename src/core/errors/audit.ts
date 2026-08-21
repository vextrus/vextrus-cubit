/**
 * The register's verdict, as a function of four lists (Q-07).
 *
 * Q-07 is "every code exercised by name or deferred by name; no orphan codes" — two findings
 * pointing opposite ways, plus the bookkeeping error between them:
 *
 *   - `unexercised`: registered, and named by no test and no deferral. The code exists and
 *     nothing has ever shown it firing.
 *   - `orphans`: spelled in product source, and unknown to the registry. A refusal outside
 *     the closed enum (L-QTY-04) — a code with no message, no remedy, no severity, no surface.
 *   - `danglingDeferrals`: deferred by name, and registered nowhere. A promise to test a code
 *     that does not exist, which would otherwise sit there excusing nothing forever.
 *
 * Gathering the four lists means reading the tree; deciding what they mean does not. The
 * split is deliberate: this function touches neither the filesystem nor the process, so the
 * verdict can be exercised on lists nobody had to arrange on disk first.
 */

/** The four lists, however the caller came by them. Order and duplicates do not matter. */
export interface RegisterAuditInput {
  /** Every code the taxonomy declares. */
  readonly registered: readonly string[];
  /** Every code named by a test file. */
  readonly exercised: readonly string[];
  /** Every code a deferral names. */
  readonly deferred: readonly string[];
  /** Every refusal-shaped literal found in product source. */
  readonly spelledInSource: readonly string[];
}

/** The verdict. Each list is sorted and duplicate-free, so a failure reads the same twice. */
export interface RegisterAuditResult {
  /** True when all three findings are empty — and only then. */
  readonly ok: boolean;
  readonly unexercised: string[];
  readonly danglingDeferrals: string[];
  readonly orphans: string[];
}

/** A finding, as the register reports one: sorted, duplicate-free, stable. */
function finding(codes: Iterable<string>): string[] {
  return [...new Set(codes)].sort();
}

/** Judge one register. Pure: same lists in, same verdict out, and nothing else touched. */
export function auditRefusalRegister(input: RegisterAuditInput): RegisterAuditResult {
  const registered = new Set(input.registered);
  const deferred = new Set(input.deferred);
  const accountedFor = new Set([...input.exercised, ...input.deferred]);

  const unexercised = finding([...registered].filter((code) => !accountedFor.has(code)));
  const danglingDeferrals = finding([...deferred].filter((code) => !registered.has(code)));
  const orphans = finding(input.spelledInSource.filter((code) => !registered.has(code)));

  return {
    ok: unexercised.length === 0 && danglingDeferrals.length === 0 && orphans.length === 0,
    unexercised,
    danglingDeferrals,
    orphans,
  };
}
