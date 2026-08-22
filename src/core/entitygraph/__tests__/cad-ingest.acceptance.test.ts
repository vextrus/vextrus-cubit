/**
 * inc-104 acceptance — the DXF half of the `cad/` seam, judged through its one entry point
 * (AC-1, AC-2, AC-3).
 *
 * SEAM-CAD is a process, not a function: "`ingestDrawing(bytes, format) → EntityGraph` via
 * the `cad/` CLI". So every claim below is made against a real `uv run --frozen python -m
 * cubit_cad ingest` invocation writing a real artifact, and the artifact is judged against
 * the input file's own bytes — the two facts L-CAD-02 and L-CAD-03 state are relations
 * between the file and the graph, and an artifact read on its own terms can satisfy neither.
 *
 * No fractional literal appears in this file: it lives under src/**, where B-07's
 * no-float-arithmetic rule binds, and none of these criteria needs one.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type EntityGraph,
  fixtureAbs,
  fixtureRel,
  handleOfKey,
  ingest,
  python,
  readGraph,
  scratch,
} from './support/cli';
import { handlesIn, parseTags, withInsunits } from './support/dxf';

const work = scratch();
afterAll(() => work.dispose());

const outPath = (name: string): string => join(work.dir, `${name}.json`);

/**
 * Ingest a committed fixture once and read the artifact back, failing loudly on a bad exit.
 *
 * Memoised and called from inside each test rather than from `beforeAll`: a throwing
 * `beforeAll` reports its tests as *skipped*, and a skipped criterion proves nothing. Each
 * test that needs the artifact therefore carries the failure itself.
 */
const artifacts = new Map<string, EntityGraph>();
function ingestFixture(fixture: string, label: string): EntityGraph {
  const cached = artifacts.get(label);
  if (cached !== undefined) return cached;
  const out = outPath(label);
  const ran = ingest(fixtureRel(fixture), out);
  expect(ran.status, `ingest ${fixture} said:\n${ran.said}`).toBe(0);
  expect(existsSync(out), `ingest ${fixture} wrote no artifact at --out`).toBe(true);
  const graph = readGraph(out);
  artifacts.set(label, graph);
  return graph;
}

/** The handles a committed fixture's ENTITIES section minted, read from the file itself. */
const entitiesHandles = (fixture: string): Set<string> =>
  handlesIn(parseTags(readFileSync(fixtureAbs(fixture), 'utf8')), 'ENTITIES');

describe('AC-1 — one shot, keys minted from the file, identity pinned (L-CAD-01, L-CAD-02)', () => {
  const basic = (): EntityGraph => ingestFixture('basic.dxf', 'basic');

  // AC-1 / L-CAD-05: "EntityGraph is versioned (v2 as the floor)".
  it('writes an artifact at --out declaring version 2', () => {
    const graph = basic();
    expect(graph.version).toBe(2);
    expect(graph.entities.length).toBeGreaterThan(0);
  });

  // AC-1 / L-CAD-02: "`DXF_HANDLE` (ezdxf, DWG or DXF upload — the file's own handle)".
  it('keys every original entity DXF_HANDLE:<handle> with a handle the file itself minted', () => {
    const graph = basic();
    const fileHandles = entitiesHandles('basic.dxf');
    expect(fileHandles.size).toBeGreaterThan(0);
    for (const entity of graph.entities) {
      const handle = handleOfKey(entity.key);
      expect(handle, `entity ${entity.type} carries key ${String(entity.key)}`).not.toBeNull();
      // A counter, a byte offset or an index would pass the shape check and fail this one:
      // the handle has to be one the ENTITIES section of the input actually wrote.
      expect(fileHandles.has(handle ?? ''), `handle ${String(handle)} is not in the file`).toBe(
        true,
      );
    }
  });

  // L-CAD-03: "The atom a source key names is one EntityGraph original entity" — one atom,
  // one key; two entities sharing a key would collapse two atoms into one.
  it('mints each key once', () => {
    const keys = basic().entities.map((e) => e.key ?? '');
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // AC-1 / L-CAD-02: "the ingest record pins extractor identity" — name, version, and the
  // parameter-set hash the key is scoped to.
  it('pins extractor identity: ezdxf, the installed version, and a sha256 parameter-set hash', () => {
    const graph = basic();
    expect(graph.ingest.extractor.name).toBe('ezdxf');

    const installed = python(['-c', 'import ezdxf, sys; sys.stdout.write(ezdxf.__version__)']);
    expect(installed.status, `reading the installed ezdxf version said:\n${installed.said}`).toBe(0);
    expect(graph.ingest.extractor.version).toBe(installed.stdout.trim());

    expect(graph.ingest.extractor.parameter_set_hash).toMatch(/^[0-9a-f]{64}$/);
    // The parameter set is pinned, so its hash is a property of the extractor and not of
    // the drawing: it must not be the file digest wearing a different name.
    expect(graph.ingest.extractor.parameter_set_hash).not.toBe(graph.ingest.file_sha256);
  });

  // AC-1: "`ingest.file_sha256` is the sha256 of the input bytes".
  it('records the sha256 of the input bytes', () => {
    const digest = createHash('sha256').update(readFileSync(fixtureAbs('basic.dxf'))).digest('hex');
    expect(basic().ingest.file_sha256).toBe(digest);
  });

  // L-CAD-02: a key is scoped to (file bytes, extractor identity) — so a second run over
  // the same bytes with the same identity is the same key multiset, and the pinned
  // parameter set does not vary with the drawing.
  it('is deterministic: two runs agree on the key multiset, and the parameter hash is drawing-independent', () => {
    const first = basic();
    const again = ingestFixture('basic.dxf', 'basic-again');
    const sorted = (g: EntityGraph): string[] => g.entities.map((e) => e.key ?? '').sort();
    expect(sorted(again).length).toBeGreaterThan(0);
    expect(sorted(again)).toEqual(sorted(first));
    expect(again.ingest.extractor.parameter_set_hash).toBe(
      first.ingest.extractor.parameter_set_hash,
    );

    const other = ingestFixture('inserts.dxf', 'inserts-for-hash');
    expect(other.ingest.extractor.parameter_set_hash).toBe(
      first.ingest.extractor.parameter_set_hash,
    );
    expect(other.ingest.file_sha256).not.toBe(first.ingest.file_sha256);
  });
});

describe('AC-1 — loud failure, no partial artifact (L-CAD-04: "loud failures")', () => {
  /**
   * Every refusal is the same shape: non-zero, something said on stderr, nothing at --out.
   *
   * The control run comes first and is not decoration. A CLI that does not exist refuses
   * everything, so the three cases below would pass over an empty tree and prove nothing;
   * pairing each with a successful ingest of the same shape distinguishes "the extractor
   * refused this input" from "the extractor never ran".
   */
  const refuses = (label: string, input: string, extra: readonly string[] = []): void => {
    const control = ingestFixture('basic.dxf', 'basic');
    expect(control.version, 'the control ingest must succeed for a refusal to mean anything').toBe(
      2,
    );
    const out = outPath(label);
    const ran = ingest(input, out, extra);
    expect(ran.status, `expected a refusal; the CLI said:\n${ran.said}`).not.toBe(0);
    expect(ran.stderr.trim(), 'a refusal says why on stderr').not.toBe('');
    expect(existsSync(out), 'a refusal leaves no partial artifact at --out').toBe(false);
  };

  it('refuses a path that does not exist', () => {
    refuses('missing', join('tests', 'fixtures', 'no-such-drawing.dxf'));
  });

  it('refuses a file it cannot read as DXF', () => {
    const junk = join(work.dir, 'unreadable.dxf');
    writeFileSync(junk, 'this is not a DXF file, it is a sentence\n', 'utf8');
    refuses('junk', junk);
  });

  it('refuses a --format other than dxf', () => {
    // The contract: "Only `--format dxf` (the default, inferred from extension) is
    // supported this increment; anything else is a loud refusal."
    refuses('wrong-format', fixtureRel('basic.dxf'), ['--format', 'dwg']);
  });
});

describe('AC-2 — the extractor consumes originals only (L-CAD-03)', () => {
  const inserts = (): EntityGraph => ingestFixture('inserts.dxf', 'inserts');
  const insertKeysOf = (graph: EntityGraph): Set<string> =>
    new Set(graph.entities.filter((e) => e.type === 'INSERT').map((e) => e.key ?? ''));

  // L-CAD-03: "Derived paint geometry never reaches the extractor ... extraction consumes
  // original entities only." A block definition's entities live in the BLOCKS section; if
  // one of their handles turns up as an original's key, paint has reached the extractor.
  it('keys originals only from the ENTITIES section, never from a block definition', () => {
    const graph = inserts();
    const tags = parseTags(readFileSync(fixtureAbs('inserts.dxf'), 'utf8'));
    const entitiesSectionHandles = handlesIn(tags, 'ENTITIES');
    const blocksSectionHandles = handlesIn(tags, 'BLOCKS');
    expect(blocksSectionHandles.size).toBeGreaterThan(0);
    for (const entity of graph.entities) {
      const handle = handleOfKey(entity.key);
      expect(handle, `entity ${entity.type} carries key ${String(entity.key)}`).not.toBeNull();
      expect(entitiesSectionHandles.has(handle ?? ''), `${String(handle)} is not an entity`).toBe(
        true,
      );
      expect(blocksSectionHandles.has(handle ?? ''), `${String(handle)} is block paint`).toBe(false);
    }
  });

  // L-CAD-03: "INSERTs and PDF Form XObjects explode to world coordinates for rendering
  // only" — the INSERT itself stays an original entity.
  it('keeps the INSERT entities themselves among the originals', () => {
    const graph = inserts();
    expect(graph.entities.some((e) => e.type === 'INSERT')).toBe(true);
    for (const entity of graph.entities) expect(entity.src).toBeUndefined();
  });

  // L-CAD-03: "every synthesised entity carries `src` (its parent instance's key)".
  it('puts exploded paint in derived[], every element carrying its parent INSERT key as src', () => {
    const graph = inserts();
    const insertKeys = insertKeysOf(graph);
    expect(graph.derived.length).toBeGreaterThan(0);
    const fromInserts = graph.derived.filter((d) => insertKeys.has(d.src ?? ''));
    expect(fromInserts.length).toBeGreaterThan(0);
    for (const item of graph.derived) {
      expect(item.src, 'derived paint without src').toBeDefined();
      expect(handleOfKey(item.src), `derived src ${String(item.src)}`).not.toBeNull();
      // Derived paint is not an atom, so it never mints a key of its own.
      expect(item.key, 'derived paint must not carry a key').toBeUndefined();
    }
  });

  // L-CAD-03: "Block attributes collect separately."
  it('collects block attributes only in attributes[], each with src, tag and text', () => {
    const graph = inserts();
    expect(graph.attributes.length).toBeGreaterThan(0);
    const insertKeys = insertKeysOf(graph);
    for (const attribute of graph.attributes) {
      expect(insertKeys.has(attribute.src), `attribute src ${attribute.src}`).toBe(true);
      expect(typeof attribute.tag).toBe('string');
      expect(attribute.tag).not.toBe('');
      expect(typeof attribute.text).toBe('string');
    }
    // "separately" is the whole point: the attribute is not also an original entity, and
    // its text is not smuggled in as one.
    const attributeText = new Set(graph.attributes.map((a) => a.text).filter((t) => t !== ''));
    for (const entity of graph.entities) {
      expect(entity.type).not.toBe('ATTRIB');
      expect(entity.type).not.toBe('ATTDEF');
      if (entity.text !== undefined) expect(attributeText.has(entity.text)).toBe(false);
    }
  });
});

describe('AC-3 — $INSUNITS through the closed map (L-CAD-02)', () => {
  /** L-CAD-02, verbatim: "0 unitless · 1 inch · 2 foot · 4 mm · 5 cm · 6 m". */
  const CLOSED_MAP: readonly (readonly [number, string])[] = [
    [0, 'unitless'],
    [1, 'inch'],
    [2, 'foot'],
    [4, 'mm'],
    [5, 'cm'],
    [6, 'm'],
  ];

  /** basic.dxf with one header variable rewritten, ingested. */
  function ingestWithInsunits(code: number): EntityGraph {
    const source = readFileSync(fixtureAbs('basic.dxf'), 'utf8');
    const path = join(work.dir, `insunits-${code}.dxf`);
    writeFileSync(path, withInsunits(source, code), 'utf8');
    const out = outPath(`insunits-${code}`);
    const ran = ingest(path, out);
    expect(ran.status, `ingest at $INSUNITS=${code} said:\n${ran.said}`).toBe(0);
    return readGraph(out);
  }

  it.each(CLOSED_MAP)('reports code %i as %s, not unmapped', (code, unit) => {
    const graph = ingestWithInsunits(code);
    expect(graph.units.insunits_code).toBe(code);
    expect(graph.units.unit).toBe(unit);
    expect(graph.units.insunits_unmapped).toBe(false);
  });

  // L-CAD-02: "an unmapped code reports null + a flag, never unitless".
  it('reports an unmapped code as null with the flag raised, never unitless', () => {
    const graph = ingestFixture('units-unmapped.dxf', 'units-unmapped');
    expect(graph.units.insunits_code).toBe(3);
    expect(graph.units.unit).toBeNull();
    expect(graph.units.insunits_unmapped).toBe(true);
    expect(graph.units.unit).not.toBe('unitless');
  });

  // L-CAD-02: "Coordinates stay in native drawing units." The same drawing declared in
  // feet and in millimetres must produce byte-identical geometry; anything else is a
  // conversion the seam is forbidden to make.
  it('leaves coordinates in native drawing units whatever the header declares', () => {
    const asFoot = ingestWithInsunits(2);
    const asMm = ingestWithInsunits(4);
    expect(asFoot.units.unit).toBe('foot');
    expect(asMm.units.unit).toBe('mm');
    const geometry = (g: EntityGraph): string =>
      JSON.stringify(g.entities.map((e) => [e.key, e.geometry]));
    expect(geometry(asMm)).toBe(geometry(asFoot));
    expect(JSON.stringify(asMm.layouts)).toBe(JSON.stringify(asFoot.layouts));
  });
});
