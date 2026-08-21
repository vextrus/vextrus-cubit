/**
 * The typed string table, unit by unit (R-SPINE-060).
 *
 * The acceptance suite next door pins the contract; this one walks what the fold has to keep
 * true as modules are added: every key belongs to the module that registered it, every value
 * is English copy, and `t()` reads the table rather than holding a second copy of it.
 *
 * The compiler half of the rule — a key nobody registered does not compile — is not a runtime
 * assertion at all, and is proved by the tsc fixture projects under tests/lint-fixtures/format/.
 */
import { describe, expect, it } from 'vitest';
import { STRINGS, t } from '../strings';
import type { StringKey } from '../strings';
import { SPINE_STRINGS } from '../strings/spine';

/** The table as data, for the walks below. */
const strings = STRINGS as Record<string, string>;

describe('the composed table', () => {
  it('answers the one key the platform has today', () => {
    const key: StringKey = 'spine.appName';
    expect(t(key)).toBe('Vextrus CUBIT');
  });

  it('reads every registered key back through t', () => {
    const keys = Object.keys(strings);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(t(key as StringKey)).toBe(strings[key]);
    }
  });

  it('is inert once imported, as the refusal registries are', () => {
    expect(Object.isFrozen(STRINGS)).toBe(true);
    expect(Object.isFrozen(SPINE_STRINGS)).toBe(true);
  });

  it('carries the spine module’s table whole, under its own prefix', () => {
    const spine = SPINE_STRINGS as Record<string, string>;
    expect(Object.keys(spine).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(spine)) {
      expect(key.startsWith('spine.')).toBe(true);
      expect(strings[key]).toBe(value);
    }
  });

  it('keys by module and values in English, with nothing blank', () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(key).toMatch(/^[a-z][a-z0-9]*\.[A-Za-z0-9][A-Za-z0-9.]*$/);
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
      // A readiness rule, not a translation system: English values today.
      expect(/[ঀ-৿]/.test(value)).toBe(false);
    }
  });
});
