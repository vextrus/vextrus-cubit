/**
 * The drift check for the one token category the application entry re-spells (R-UI-001).
 *
 * Tokens are emitted from one TypeScript source — src/ui/tokens.ts → src/ui/tokens.css — and
 * src/ui/globals.css maps each category into Tailwind's `@theme` by reference. The breakpoints
 * cannot be mapped that way: Tailwind spends them inside a media condition, `@media (width >=
 * <value>)`, where `var()` is not legal, and `next build` fails to parse its own output. So
 * src/app/tailwind.css re-declares those four — and only those four — as literals.
 *
 * A hand-maintained second copy is a copy that drifts: change a breakpoint in tokens.ts and
 * every responsive utility would silently keep the old number, with the token sheet and the
 * compiled scale disagreeing and nothing reporting it. This suite is what reports it. It reads
 * the literals back out of the stylesheet and compares them, name for name and value for value,
 * against `tokens.breakpoint` — so the two files can only be changed together.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokens } from '../../ui/tokens';

const ENTRY = 'src/app/tailwind.css';

/** Every `--breakpoint-*` declaration made inside an `@theme` block of the entry stylesheet. */
function declaredBreakpoints(): Record<string, string> {
  const source = readFileSync(join(process.cwd(), ENTRY), 'utf8');
  const found: Record<string, string> = {};
  for (const block of source.matchAll(/@theme[^{]*\{([^}]*)\}/g)) {
    const body = block[1] ?? '';
    for (const declaration of body.matchAll(/--breakpoint-([\w-]+)\s*:\s*([^;]+);/g)) {
      found[declaration[1] ?? ''] = (declaration[2] ?? '').trim();
    }
  }
  return found;
}

describe('R-UI-001 — the Tailwind breakpoint literals track src/ui/tokens.ts', () => {
  const canonical: Record<string, string> = { ...tokens.breakpoint };

  it('declares exactly the breakpoints the token source declares', () => {
    expect(
      Object.keys(declaredBreakpoints()).sort(),
      `R-UI-001: ${ENTRY} names the same breakpoints as tokens.breakpoint — a token added there ` +
        'and not here would compile against Tailwind’s own scale',
    ).toEqual(Object.keys(canonical).sort());
  });

  it('spells each one with the value the token source carries', () => {
    expect(
      declaredBreakpoints(),
      `R-UI-001: the literals in ${ENTRY} are a workaround for a var() that cannot live in a ` +
        'media condition, not a second source of truth — change tokens.ts and change them with it',
    ).toEqual(canonical);
  });

  it('leaves every other token category mapped by reference', () => {
    const source = readFileSync(join(process.cwd(), ENTRY), 'utf8');
    const literals = [...source.matchAll(/@theme[^{]*\{([^}]*)\}/g)]
      .flatMap((block) => [...(block[1] ?? '').matchAll(/(--[\w-]+)\s*:/g)])
      .map((declaration) => declaration[1] ?? '');
    expect(
      literals.filter((name) => !name.startsWith('--breakpoint-')),
      'R-UI-001: only the breakpoints earn a literal here; everything else arrives by var()',
    ).toEqual([]);
  });
});
