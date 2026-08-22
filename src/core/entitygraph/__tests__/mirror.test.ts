/**
 * The EntityGraph mirror, judged as a mirror (L-CAD-05, AC-4).
 *
 * "EntityGraph is versioned (v2 as the floor) and mirrored in Zod; both sides parse
 * committed fixtures." Two runtimes agreeing on a corpus is the whole claim, so every
 * committed artifact is put to the Zod schema and to `cubit_cad.schema` in the same run and
 * the two verdicts are compared; a mirror where one side is the lenient one is not a
 * mirror, it is a second opinion.
 *
 * The mutation cases below are built by bending a committed fixture rather than by writing
 * a graph out longhand: a hand-written negative drifts from the corpus the moment the
 * vocabulary grows, and then it proves that the schema refuses a shape the extractor never
 * emits. No colour literal and no fractional literal is written here — B-07 and R-UI-001
 * bind `src/**`, and every value these tests need is already in the corpus.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EntityGraphV2Schema, KEY_SCHEMES, parseEntityGraph } from '../index';
import { REPO, uvRun } from './support/cli';

const VALID_DIR = join(REPO, 'fixtures', 'entitygraph');
const MALFORMED_DIR = join(VALID_DIR, 'malformed');

const jsonFilesIn = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();

const readJson = (dir: string, name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>;

/** A deep copy of a committed fixture, to be bent one field at a time. */
const bend = (name: string): Record<string, unknown> =>
  JSON.parse(JSON.stringify(readJson(VALID_DIR, name))) as Record<string, unknown>;

describe('the Zod side parses the committed corpus (L-CAD-05)', () => {
  it.each(jsonFilesIn(VALID_DIR))('parses %s and hands the graph back', (name) => {
    const graph = parseEntityGraph(readJson(VALID_DIR, name));
    expect(graph.version).toBe(2);
    expect(graph.layouts.length).toBeGreaterThan(0);
  });

  it.each(jsonFilesIn(MALFORMED_DIR))('refuses %s', (name) => {
    const bad = readJson(MALFORMED_DIR, name);
    expect(() => parseEntityGraph(bad)).toThrow();
    expect(EntityGraphV2Schema.safeParse(bad).success).toBe(false);
  });
});

describe('the closed sets are closed (L-CAD-02, L-CAD-03, L-CAD-05)', () => {
  // L-CAD-02: the scheme set is closed and the scheme rides per key. A key minted under a
  // scheme no extractor answers for names an atom nobody can re-derive.
  it('refuses a key outside the closed scheme set', () => {
    const graph = bend('basic.json');
    const entities = graph.entities as Record<string, unknown>[];
    entities[0]!.key = `SVG_NODE:${String(entities[0]!.key).split(':')[1]}`;
    expect(() => parseEntityGraph(graph)).toThrow();
    expect(KEY_SCHEMES).not.toContain('SVG_NODE');
  });

  // L-CAD-03: "The atom a source key names is one EntityGraph original entity" — derived
  // paint is not an atom, so a derived record carrying a key of its own is refused.
  it('refuses derived paint that mints a key, and an original that claims a parent', () => {
    const withKey = bend('inserts.json');
    const derived = withKey.derived as Record<string, unknown>[];
    expect(derived.length).toBeGreaterThan(0);
    derived[0]!.key = derived[0]!.src;
    expect(() => parseEntityGraph(withKey)).toThrow();

    const withSrc = bend('inserts.json');
    const entities = withSrc.entities as Record<string, unknown>[];
    entities[0]!.src = entities[0]!.key;
    expect(() => parseEntityGraph(withSrc)).toThrow();
  });

  // L-CAD-03: "every synthesised entity carries `src` (its parent instance's key)".
  it('refuses derived paint with no src', () => {
    const graph = bend('inserts.json');
    const derived = graph.derived as Record<string, unknown>[];
    delete derived[0]!.src;
    expect(() => parseEntityGraph(graph)).toThrow();
  });

  // L-CAD-05: "Colour resolved server-side (true colour → explicit → BYLAYER → BYBLOCK)" —
  // the four rules are the whole set, and an unresolved sentinel is not one of them.
  it('refuses a colour resolved by a rule that is not one of the four', () => {
    const graph = bend('basic.json');
    const entities = graph.entities as Record<string, unknown>[];
    (entities[0]!.colour as Record<string, unknown>).source = 'aci_index';
    expect(() => parseEntityGraph(graph)).toThrow();
  });

  // L-CAD-02: "an unmapped code reports null + a flag, never unitless". The null and the
  // flag are one statement; either alone is the misreading the clause forbids.
  it('refuses a unit that disagrees with the unmapped flag, in both directions', () => {
    const nulledWithoutFlag = bend('basic.json');
    (nulledWithoutFlag.units as Record<string, unknown>).unit = null;
    expect(() => parseEntityGraph(nulledWithoutFlag)).toThrow();

    const unitless = bend('units-unmapped.json');
    (unitless.units as Record<string, unknown>).unit = 'unitless';
    expect(() => parseEntityGraph(unitless)).toThrow();
  });

  // L-CAD-05: "paper layouts get their own bbox" — four numbers, in that order, always.
  it('refuses a layout bbox that is not [minx, miny, maxx, maxy]', () => {
    const graph = bend('basic.json');
    const layouts = graph.layouts as Record<string, unknown>[];
    layouts[0]!.bbox = (layouts[0]!.bbox as number[]).slice(0, 3);
    expect(() => parseEntityGraph(graph)).toThrow();
  });

  // R-TO-001: the counters are "named facts", so a graph that omits one is a graph whose
  // sheet card would have nothing to show.
  it('refuses a graph with no counters block', () => {
    const graph = bend('basic.json');
    delete graph.counters;
    expect(() => parseEntityGraph(graph)).toThrow();
  });
});

describe('the two runtimes give the same verdict on the same bytes (L-CAD-05)', () => {
  /**
   * The Python half, asked over the whole corpus in one process: it prints
   * `<name>\t<verdict>` per file, where a verdict is ACCEPTED or REFUSED and anything else
   * is the class of the error that escaped `EntityGraphError`.
   */
  const PROBE = [
    'import json, sys',
    'from cubit_cad.schema import EntityGraphError, parse_entity_graph',
    '',
    'for path in sys.argv[1:]:',
    '    with open(path, "rb") as handle:',
    '        obj = json.loads(handle.read().decode("utf-8"))',
    '    try:',
    '        parse_entity_graph(obj)',
    '    except EntityGraphError:',
    '        print(path + "\\tREFUSED")',
    '    except Exception as exc:',
    '        print(path + "\\t" + type(exc).__name__)',
    '    else:',
    '        print(path + "\\tACCEPTED")',
    '',
  ].join('\n');

  it('accepts every committed fixture on both sides and refuses every malformed one', () => {
    const valid = jsonFilesIn(VALID_DIR).map((name) => join(VALID_DIR, name));
    const malformed = jsonFilesIn(MALFORMED_DIR).map((name) => join(MALFORMED_DIR, name));
    const ran = uvRun(['python', '-c', PROBE, ...valid, ...malformed]);
    expect(ran.status, `the python mirror said:\n${ran.said}`).toBe(0);

    const python = new Map<string, string>();
    for (const line of ran.stdout.split('\n')) {
      const [path, verdict] = line.split('\t');
      if (path !== undefined && verdict !== undefined) python.set(path, verdict.trim());
    }

    for (const path of valid) {
      const zod = EntityGraphV2Schema.safeParse(
        JSON.parse(readFileSync(path, 'utf8')) as unknown,
      ).success;
      expect(zod, path).toBe(true);
      expect(python.get(path), `${path}\n${ran.said}`).toBe('ACCEPTED');
    }
    for (const path of malformed) {
      const zod = EntityGraphV2Schema.safeParse(
        JSON.parse(readFileSync(path, 'utf8')) as unknown,
      ).success;
      expect(zod, path).toBe(false);
      expect(python.get(path), `${path}\n${ran.said}`).toBe('REFUSED');
    }
  });
});
