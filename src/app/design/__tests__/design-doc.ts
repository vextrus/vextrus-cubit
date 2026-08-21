/**
 * inc-007 acceptance support — the Design Decision, read as data (AM-03, AC-1).
 *
 * AM-03: "a DESIGN DECISION is committed at docs/design/<screen>.md BEFORE acceptance is
 * written — layout and hierarchy; every R-UI-050 state with its copy verbatim; ... and the
 * data-testid/route names it introduces, which C-05's test contract draws from." The
 * document is already committed (the designer's commit), so the acceptance does not restate
 * its roster or its copy: it reads them out of the document and holds the product to what is
 * written there. A later increment that lawfully adds a component adds a §3 row and a §6 key,
 * and these assertions follow it — which is the whole point of not freezing today's list.
 *
 * Two tables are read:
 *   §3 "The entry roster" — | slug | covers | states | specimen |
 *   §6 "Copy, verbatim"   — the `key` → value runs, and the | Key | Value | table.
 *
 * Nothing here asserts; it is the input to the suites beside it, and to the J-004 journey.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** AM-03 names the document by the screen it decides; this increment's screen is S-Design. */
export const DESIGN_DOC = 'docs/design/s-design.md';

/** One §3 row: the entry the registry must carry and the states it must render. */
export interface RosterRow {
  readonly slug: string;
  readonly covers: readonly string[];
  readonly states: readonly string[];
}

/** The document's text. A missing document is AM-03's own failure and reads as one. */
export function designDocText(repo: string = process.cwd()): string {
  return readFileSync(join(repo, DESIGN_DOC), 'utf8');
}

/** The cells of a markdown table row, without the empty edges. */
function cells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  const parts = trimmed.split('|').map((cell) => cell.trim());
  parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/** The rows of the table whose header cells start with `header`, in document order. */
function tableRows(text: string, header: readonly string[]): string[][] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => {
    const row = cells(line);
    return header.every((name, index) => row[index] === name);
  });
  if (start < 0) return [];
  const rows: string[][] = [];
  // start + 1 is the |---|---| separator; the body runs until the first non-table line.
  for (let index = start + 2; index < lines.length; index += 1) {
    const row = cells(lines[index] ?? '');
    if (row.length === 0) break;
    rows.push(row);
  }
  return rows;
}

/** A list written into one cell — `Button, IconButton` or `primary · secondary · ghost`. */
function items(cell: string | undefined, separator: string): string[] {
  if (cell === undefined) return [];
  return cell
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** The markdown bullets in a slice of the document, each folded to one line. */
function bullets(section: string): string[] {
  const found: string[] = [];
  for (const line of section.split('\n')) {
    if (/^\s*-\s+/.test(line)) {
      found.push(line.replace(/^\s*-\s+/, ''));
      continue;
    }
    const open = found.length - 1;
    // A continuation line belongs to the bullet above it; prose before the first bullet
    // (the paragraph that introduces the runs) belongs to no bullet and is dropped.
    if (open >= 0 && line.trim() !== '') found[open] = `${found[open] ?? ''} ${line.trim()}`;
  }
  return found;
}

/**
 * §3's roster: every entry the gallery must carry, the barrel exports it demonstrates and
 * the `data-gallery-state` values it must render (§10 says those are the state names
 * verbatim).
 */
export function rosterRows(repo?: string): RosterRow[] {
  const text = repo === undefined ? designDocText() : designDocText(repo);
  return tableRows(text, ['slug', 'covers', 'states']).map((row) => ({
    slug: row[0] ?? '',
    covers: items(row[1], ','),
    states: items(row[2], '·'),
  }));
}

/**
 * §6's copy, verbatim: every `key` → value the document decides, keyed as the string table
 * keys them. "Keys below drop the `design.sample.` prefix where shown bare", so a bare name
 * — one with no dot in it — is a sample key.
 */
export function copyEntries(repo?: string): Map<string, string> {
  const text = repo === undefined ? designDocText() : designDocText(repo);
  const found = new Map<string, string>();

  const runsStart = text.indexOf('Label keys, verbatim');
  const runsEnd = text.indexOf('Sentence copy:');
  if (runsStart >= 0 && runsEnd > runsStart) {
    // A run is one bullet: `key` → value pairs separated by `·`, wrapped over several
    // lines. The bullet boundary matters — the last pair of one bullet and the first of the
    // next have no `·` between them, so the lines are gathered per bullet first.
    for (const bullet of bullets(text.slice(runsStart, runsEnd))) {
      for (const fragment of bullet.split('·')) {
        const match = /`([^`]+)`\s*→\s*(.+)/.exec(fragment);
        if (match === null) continue;
        const key = match[1] ?? '';
        const value = (match[2] ?? '').trim();
        if (key === '' || value === '') continue;
        found.set(key.includes('.') ? key : `design.sample.${key}`, value);
      }
    }
  }

  for (const row of tableRows(text, ['Key', 'Value'])) {
    const key = /`([^`]+)`/.exec(row[0] ?? '')?.[1];
    const value = (row[1] ?? '').trim();
    if (key === undefined || value === '') continue;
    found.set(key.includes('.') ? key : `design.sample.${key}`, value);
  }

  return found;
}
