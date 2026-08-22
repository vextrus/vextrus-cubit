/**
 * The entries' words against the Design Decision (AM-03 (2): "Copy is design … a copy defect is
 * a defect").
 *
 * The chrome table §7 is already read out of the document by the acceptance suite. §5–§6 — the
 * entry titles, the state labels and every quoted sample string — was not, so a silent edit to
 * `gallery.sample.button.label` could turn "Save measurement" into anything and no test would
 * notice. This suite closes that: it parses docs/design/s-design.md at run time and compares the
 * decision's words with `GALLERY_STRINGS`. Nothing here transcribes the copy; the document is
 * the only place it is written down.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESIGN_DOC, absolute, docRoster } from './support/surface';
import { GALLERY_STRINGS } from '../strings';

const values = new Set<string>(Object.values(GALLERY_STRINGS));
const keys = new Set<string>(Object.keys(GALLERY_STRINGS));

/** The §7 rule for a title and a state label: hyphens as spaces, sentence case. */
const sentenceCase = (name: string): string => {
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** One section of the decision, by its heading and the heading that ends it. */
function section(from: string, to: string): string {
  const source = readFileSync(absolute(DESIGN_DOC), 'utf8');
  const start = source.indexOf(from);
  const end = source.indexOf(to);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${DESIGN_DOC}: could not find the ${from} … ${to} section`);
  }
  return source.slice(start, end);
}

/**
 * A quoted run that is an identifier rather than copy: a layer name, a grid line, a code. §7
 * keeps those out of the table unless they sit inside a sentence ("Layer S-COL" is copy;
 * "S-COL" on its own is the identifier the drawing carries).
 */
const isIdentifier = (quoted: string): boolean => /^[A-Z0-9][A-Z0-9 ./-]*$/.test(quoted);

/** Every `"…"` run in a slice of the decision, with code spans removed first. */
function quotedCopy(slice: string): string[] {
  const prose = slice.replace(/`[^`]*`/g, ' ');
  const found = [...prose.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? '');
  return [...new Set(found)].filter((quoted) => quoted.length > 0 && !isIdentifier(quoted));
}

describe('the entries speak the Design Decision (§5–§6)', () => {
  it('carries a title for every entry the roster lists, in §7 sentence case', () => {
    const wrong: string[] = [];
    for (const row of docRoster()) {
      const key = `gallery.entry.${row.id}`;
      const held = (GALLERY_STRINGS as Record<string, string>)[key];
      if (held !== sentenceCase(row.id)) wrong.push(`${key}: ${String(held)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('carries a label for every state the roster lists, in §7 sentence case', () => {
    const wrong: string[] = [];
    for (const row of docRoster()) {
      for (const state of row.states) {
        const key = `gallery.state.${state}`;
        const held = (GALLERY_STRINGS as Record<string, string>)[key];
        if (held !== sentenceCase(state)) wrong.push(`${key}: ${String(held)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('holds every sample string §5 quotes, verbatim', () => {
    // Only the roster's own "Sample (copy verbatim)" cells: the section's preamble quotes its
    // column headings, which are words about the table rather than words on the sheet.
    const samples = section('## 5.', '## 6.')
      .split('\n')
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 5 && /^`[a-z][a-z0-9-]*`$/.test(cells[1] ?? ''))
      .map((cells) => cells[4] ?? '');
    expect(samples.length).toBeGreaterThan(30);
    const quoted = quotedCopy(samples.join('\n'));
    // A roster with no quoted copy in it would make this test vacuous.
    expect(quoted.length).toBeGreaterThan(30);
    expect(quoted.filter((copy) => !values.has(copy))).toEqual([]);
  });

  it('holds every sample string §6 quotes, verbatim', () => {
    const quoted = quotedCopy(section('## 6.', '## 7.'));
    expect(quoted.length).toBeGreaterThan(0);
    expect(quoted.filter((copy) => !values.has(copy))).toEqual([]);
  });

  it('has no sample key for an entry the roster does not list', () => {
    const roster = new Set(docRoster().map((row) => row.id));
    const orphans = [...keys].filter((key) => {
      const id = /^gallery\.sample\.([a-z][a-z0-9-]*)\./.exec(key)?.[1];
      return id !== undefined && !roster.has(id);
    });
    expect(orphans).toEqual([]);
  });
});
