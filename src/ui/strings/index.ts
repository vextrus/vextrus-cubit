/**
 * R-SPINE-060 — every user-facing string lives in one typed table per module,
 * keyed by id with English values. This is not a translation system; it is a
 * readiness rule: the compiler refuses a key that is not in the table, and
 * cubit/no-jsx-string-literals refuses prose that never reached one.
 */
export type StringTable = Readonly<Record<string, string>>;

/**
 * Declares a table. The returned type is the literal object, so `strings.typo`
 * is a compile error rather than `undefined` on screen.
 */
export function table<const T extends StringTable>(entries: T): T {
  return entries;
}
