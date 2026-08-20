import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tokens } from '../tokens';

// R-UI-001 / R-UI-002 / R-UI-003 / R-UI-004 — tokens are CSS variables emitted
// from one TS source; no colour literal lives outside it.

const ROOT = process.cwd();
const GLOBALS = path.join(ROOT, 'src/app/globals.css');

const t = tokens as unknown as Record<string, Record<string, unknown>>;

const isColour = (v: unknown) =>
  typeof v === 'string' && /^(#[0-9a-fA-F]{3,8}|oklch\(|rgb|hsl|color\()/.test(v.trim());

const px = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
    if (m?.[1] !== undefined) return Number(m[1]);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

describe('AC-05 tokens are the sole source (R-UI-001)', () => {
  it('AC-05: graphite scale runs 0–1000 for surfaces and text', () => {
    const graphite = t.graphite ?? {};
    for (const step of [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) {
      const value = graphite[String(step)];
      expect(value, `graphite.${step} missing`).toBeDefined();
      expect(isColour(value), `graphite.${step} is not a colour: ${String(value)}`).toBe(true);
    }
  });

  it('AC-05: one accent — cobalt — for interactive', () => {
    expect(t.cobalt, 'tokens.cobalt missing').toBeDefined();
    const values = typeof t.cobalt === 'object' ? Object.values(t.cobalt) : [t.cobalt];
    expect(values.length).toBeGreaterThan(0);
    expect(values.some(isColour)).toBe(true);
  });

  it('AC-05: semantic success/warn/danger/info', () => {
    const semantic = t.semantic ?? {};
    for (const name of ['success', 'warn', 'danger', 'info']) {
      const value = semantic[name];
      expect(value, `semantic.${name} missing`).toBeDefined();
      const leaf = typeof value === 'object' && value !== null ? Object.values(value)[0] : value;
      expect(isColour(leaf) || isColour(value), `semantic.${name} is not a colour`).toBe(true);
    }
  });
});

describe('AC-05 basis palette carries colour AND glyph (R-UI-002)', () => {
  const EXPECTED: ReadonlyArray<readonly [string, string]> = [
    ['MEASURED', '◆'],
    ['TRANSCRIBED', '▣'],
    ['DERIVED', 'ƒ'],
    ['IMPORTED', '⇩'],
    ['ENTERED', '✎'],
    ['INTERPRETED', '▦'],
    ['DEFAULTED', '○'],
  ];

  it('AC-05: all seven bases exist with their fixed glyph', () => {
    const basis = t.basis ?? {};
    expect(Object.keys(basis).sort()).toEqual(EXPECTED.map(([k]) => k).sort());
    for (const [name, glyph] of EXPECTED) {
      const entry = basis[name] as Record<string, unknown> | undefined;
      expect(entry, `basis.${name} missing`).toBeDefined();
      expect(entry?.glyph, `basis.${name}.glyph`).toBe(glyph);
    }
  });

  it('AC-05: each basis also carries a colour so the pair renders everywhere', () => {
    const basis = t.basis ?? {};
    for (const [name] of EXPECTED) {
      const entry = (basis[name] ?? {}) as Record<string, unknown>;
      const colour = entry.colour ?? entry.color;
      expect(isColour(colour), `basis.${name} colour is not a colour: ${String(colour)}`).toBe(true);
    }
  });

  it('AC-05: canvas and element-class palettes exist', () => {
    expect(t.canvas, 'tokens.canvas missing').toBeDefined();
    const elementClass = t.elementClass ?? t.element ?? t.elements;
    expect(elementClass, 'element-class palette missing').toBeDefined();
    expect(Object.keys(elementClass as object).length).toBeGreaterThan(0);
  });
});

describe('AC-05 geometry, type, motion (R-UI-001, R-UI-003, R-UI-004)', () => {
  it('AC-05: spacing is a 4-pt grid', () => {
    const spacing = Object.values(t.spacing ?? {});
    expect(spacing.length).toBeGreaterThan(0);
    for (const value of spacing) {
      const n = px(value);
      expect(n, `spacing value ${String(value)} is not a length`).not.toBeNull();
      expect((n as number) % 4, `spacing ${String(value)} is off the 4-pt grid`).toBe(0);
    }
  });

  it('AC-05: radii are 2 / 4 / 8 / 12', () => {
    const radii = Object.values(t.radii ?? t.radius ?? {}).map(px).filter((n) => n !== null);
    for (const expected of [2, 4, 8, 12]) {
      expect(radii, `radius ${expected} missing`).toContain(expected);
    }
  });

  it('AC-05: four shadows (hairline borders preferred over shadows)', () => {
    const shadows = t.elevation ?? t.shadows ?? t.shadow ?? {};
    expect(Object.keys(shadows).length).toBe(4);
  });

  it('AC-05: type scale is 12/13/14/16/20/24/32', () => {
    const type = (t.type ?? t.typography ?? {}) as Record<string, unknown>;
    const scaleHolder = (type.scale ?? type.size ?? type.sizes ?? type) as Record<string, unknown>;
    const sizes = Object.values(scaleHolder).map(px).filter((n): n is number => n !== null);
    for (const expected of [12, 13, 14, 16, 20, 24, 32]) {
      expect(sizes, `type size ${expected} missing`).toContain(expected);
    }
  });

  it('AC-05: motion durations sit in the stated bands, with easings and no bounce', () => {
    const motion = JSON.stringify(t.motion ?? {});
    expect(motion.length, 'tokens.motion missing').toBeGreaterThan(2);
    const durations = motion.match(/\d+/g)?.map(Number) ?? [];
    expect(durations.some((d) => d >= 120 && d <= 200), 'no 120–200ms state-change duration').toBe(true);
    expect(durations, 'no 240ms panel duration').toContain(240);
    expect(durations, 'no 320ms fly-to duration').toContain(320);
    expect(motion.toLowerCase()).not.toContain('bounce');
  });

  it('AC-05: z-layers and breakpoints are defined', () => {
    const z = t.z ?? t.zLayers ?? t.layers ?? {};
    expect(Object.keys(z).length, 'z-layers missing').toBeGreaterThan(0);
    expect(Object.keys(t.breakpoints ?? {}).length, 'breakpoints missing').toBeGreaterThan(0);
  });
});

describe('AC-05 gen:tokens emission is the committed CSS', () => {
  it('AC-05: globals.css defines both themes on :root and [data-theme="dark"]', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    expect(css).toMatch(/:root\s*\{/);
    expect(css).toMatch(/\[data-theme=["']dark["']\]\s*\{/);
    // the emitted block is CSS variables, not literals scattered by hand
    expect(css).toMatch(/--[a-z0-9-]+:/i);
  });

  it('AC-05: the committed block equals a fresh emission (pnpm gen:tokens is idempotent)', () => {
    const before = readFileSync(GLOBALS, 'utf8');
    execFileSync('pnpm', ['gen:tokens'], { cwd: ROOT, stdio: 'pipe' });
    const after = readFileSync(GLOBALS, 'utf8');
    if (before !== after) writeFileSync(GLOBALS, before); // leave the tree untouched
    expect(after, 'committed token block differs from the emission — run pnpm gen:tokens').toBe(
      before,
    );
  });
});

describe('AC-19 typography and reduced motion (R-UI-003, R-UI-004)', () => {
  it('AC-19: Inter, JetBrains Mono and tabular numerals are wired in globals.css', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    expect(css).toMatch(/Inter/);
    expect(css).toMatch(/JetBrains\s*Mono/i);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums\s+slashed-zero/);
  });

  it('AC-19: prefers-reduced-motion is honoured', () => {
    const css = readFileSync(GLOBALS, 'utf8');
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  });
});
