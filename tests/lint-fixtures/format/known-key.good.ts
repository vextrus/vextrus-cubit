/**
 * Compiles: every key handed to `t()` is registered in the string table (R-SPINE-060).
 *
 * The good half of the mechanical proof that "the compiler refuses a missing key". A rule
 * that refuses everything is not a guardrail, so this file states the other side: a key the
 * table carries is an ordinary call that type-checks and needs no cast, no widening and no
 * annotation to get past `StringKey`.
 *
 * Driven by tests/lint-fixtures/string-table.test.ts through
 * `tests/lint-fixtures/format/tsconfig.good.json`, which lists this file and nothing else.
 */
import { t } from '../../../src/ui/strings';

export function appName(): string {
  return t('spine.appName');
}
