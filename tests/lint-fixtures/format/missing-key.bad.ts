/**
 * Does not compile, on purpose: the key below is registered in no module table
 * (R-SPINE-060 — "the compiler refuses a missing key").
 *
 * The compile error IS the proof. Nothing here is suppressed and nothing is silenced: the
 * file is type-broken, which is why it needs no recorded reason and carries no forbidden
 * construct. It is excluded from the root `tsc --noEmit` (tsconfig.json excludes
 * `tests/lint-fixtures/*` one level down) and ignored by `eslint .`, so it is broken only
 * where it is deliberately compiled — through
 * `tests/lint-fixtures/format/tsconfig.bad.json`, from tests/lint-fixtures/string-table.test.ts.
 *
 * If this file ever compiles clean, `t()` takes a bare string and R-SPINE-060's compiler
 * refusal has quietly become a runtime lookup that returns undefined.
 */
import { t } from '../../../src/ui/strings';

export function missingKey(): string {
  return t('spine.thisKeyIsRegisteredNowhere');
}
