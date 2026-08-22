/**
 * inc-104 acceptance — one schema, two runtimes, the same committed fixtures (AC-4).
 *
 * L-CAD-05: "EntityGraph is versioned (v2 as the floor) and mirrored in Zod; both sides
 * parse committed fixtures." A mirror is only a mirror if the two sides agree on both
 * answers, so every committed fixture is put to Zod and to `cubit_cad.schema` in the same
 * loop, and every deliberately-malformed file is required to be refused by both — Zod by
 * throwing, Python by raising `EntityGraphError`.
 *
 * The Zod side is imported inside each test rather than at the top: a module that does not
 * exist yet would otherwise take the whole file down as one collection error, and one red
 * line says far less than a list of the behaviours still missing.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO, fixtureRel, ingest, scratch, uvRun } from './support/cli';

const VALID_DIR = join(REPO, 'fixtures', 'entitygraph');
const MALFORMED_DIR = join(VALID_DIR, 'malformed');

/** The five artifacts the test contract commits, by name (the directory may hold more). */
const DECLARED_VALID = ['basic', 'inserts', 'units-unmapped', 'layouts-strays', 'flatten-cap'];

/** The three deliberately-invalid files the spec declares, by name. */
const DECLARED_MALFORMED = ['wrong-version', 'missing-key', 'bad-scheme'];

const jsonFilesIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).sort() : [];

/** The Zod mirror, as the spec's Exports section names it. */
interface Mirror {
  readonly EntityGraphV2Schema: {
    readonly parse: (input: unknown) => unknown;
    readonly safeParse: (input: unknown) => { readonly success: boolean };
  };
  readonly parseEntityGraph: (input: unknown) => { readonly version: number };
}

const loadMirror = async (): Promise<Mirror> => (await import('../index')) as unknown as Mirror;

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

describe('AC-4 — the committed fixture corpus exists on both sides', () => {
  it('commits the five EntityGraph fixtures the contract names', () => {
    const found = jsonFilesIn(VALID_DIR);
    // Members, not the exact set: a later increment may commit more artifacts here, and
    // that must not redden this suite.
    for (const name of DECLARED_VALID) expect(found, `${name}.json`).toContain(`${name}.json`);
  });

  it('confines the deliberately-invalid fixtures to fixtures/entitygraph/malformed/', () => {
    const found = jsonFilesIn(MALFORMED_DIR);
    for (const name of DECLARED_MALFORMED) expect(found, `${name}.json`).toContain(`${name}.json`);
  });

  // AC-4: "The vitest mirror suite lives at src/core/entitygraph/__tests__/mirror.test.ts
  // and runs inside plain `pnpm vitest run`."
  it('places the mirror suite where the criterion names, inside the vitest stage globs', async () => {
    expect(existsSync(join(REPO, 'src', 'core', 'entitygraph', '__tests__', 'mirror.test.ts'))).toBe(
      true,
    );
    const config = await import('../../../../vitest.config');
    expect(config.default.test.include).toContain('src/**/__tests__/*.test.ts');
  });
});

describe('AC-4 — the Zod side (L-CAD-05)', () => {
  it('exports EntityGraphV2Schema and parseEntityGraph from src/core/entitygraph', async () => {
    const mirror = await loadMirror();
    expect(typeof mirror.parseEntityGraph).toBe('function');
    expect(typeof mirror.EntityGraphV2Schema.parse).toBe('function');
    expect(typeof mirror.EntityGraphV2Schema.safeParse).toBe('function');
  });

  it('parses every committed EntityGraph fixture', async () => {
    const mirror = await loadMirror();
    const found = jsonFilesIn(VALID_DIR);
    expect(found.length).toBeGreaterThan(0);
    for (const name of found) {
      const parsed = mirror.parseEntityGraph(readJson(join(VALID_DIR, name)));
      // v2 is the floor L-CAD-05 states, and the parse must hand back the graph, not a
      // boolean: a validator that returns nothing cannot be the app's entry to the seam.
      expect(parsed.version, name).toBe(2);
    }
  });

  it('throws on every malformed fixture — wrong version, missing key, unknown scheme', async () => {
    const mirror = await loadMirror();
    const found = jsonFilesIn(MALFORMED_DIR);
    expect(found.length).toBeGreaterThan(0);
    for (const name of found) {
      const bad = readJson(join(MALFORMED_DIR, name));
      expect(() => mirror.parseEntityGraph(bad), name).toThrow();
      expect(mirror.EntityGraphV2Schema.safeParse(bad).success, name).toBe(false);
    }
  });
});

describe('AC-4 — the Python side reads the same files the same way (L-CAD-05)', () => {
  /**
   * One probe process for the whole corpus: it prints `<path>\t<verdict>` per file, where
   * the verdict is ACCEPTED, REFUSED (an `EntityGraphError` and nothing else), or
   * WRONG-ERROR with the class that escaped. Any other failure kills the process and the
   * assertion below reports what it said.
   */
  const PROBE = [
    'import json, sys',
    'from cubit_cad.schema import EntityGraphError, parse_entity_graph',
    '',
    'for path in sys.argv[1:]:',
    '    with open(path, "rb") as fh:',
    '        obj = json.loads(fh.read().decode("utf-8"))',
    '    try:',
    '        parse_entity_graph(obj)',
    '    except EntityGraphError:',
    '        print(path + "\\tREFUSED")',
    '    except Exception as exc:',
    '        print(path + "\\tWRONG-ERROR:" + type(exc).__name__)',
    '    else:',
    '        print(path + "\\tACCEPTED")',
    '',
  ].join('\n');

  const verdicts = new Map<string, string>();
  let said = '';

  beforeAll(() => {
    const work = scratch();
    try {
      const probe = join(work.dir, 'mirror_probe.py');
      writeFileSync(probe, PROBE, 'utf8');
      const paths = [
        ...jsonFilesIn(VALID_DIR).map((n) => join(VALID_DIR, n)),
        ...jsonFilesIn(MALFORMED_DIR).map((n) => join(MALFORMED_DIR, n)),
      ];
      const ran = uvRun(['python', probe, ...paths]);
      said = `exit ${String(ran.status)}\n${ran.said}`;
      for (const line of ran.stdout.split('\n')) {
        const [path, verdict] = line.split('\t');
        if (path !== undefined && verdict !== undefined) verdicts.set(path, verdict.trim());
      }
    } finally {
      work.dispose();
    }
  });

  it('parses every committed EntityGraph fixture', () => {
    const found = jsonFilesIn(VALID_DIR);
    expect(found.length, said).toBeGreaterThan(0);
    for (const name of found) {
      expect(verdicts.get(join(VALID_DIR, name)), `${name}\n${said}`).toBe('ACCEPTED');
    }
  });

  it('raises EntityGraphError — and nothing else — on every malformed fixture', () => {
    const found = jsonFilesIn(MALFORMED_DIR);
    expect(found.length, said).toBeGreaterThan(0);
    for (const name of found) {
      expect(verdicts.get(join(MALFORMED_DIR, name)), `${name}\n${said}`).toBe('REFUSED');
    }
  });
});

describe('AC-4 — the committed fixtures are the CLI’s own output', () => {
  // "regenerated by the CLI from the DXFs": a mirror corpus that drifted from the
  // extractor would let both sides agree on a graph the seam never produces.
  it('reproduces fixtures/entitygraph/basic.json by ingesting tests/fixtures/basic.dxf', () => {
    const work = scratch();
    try {
      const out = join(work.dir, 'basic.json');
      const ran = ingest(fixtureRel('basic.dxf'), out);
      expect(ran.status, `ingest basic.dxf said:\n${ran.said}`).toBe(0);
      const produced = readJson(out);
      const committed = readJson(join(VALID_DIR, 'basic.json'));
      expect(produced).toEqual(committed);
    } finally {
      work.dispose();
    }
  });
});
