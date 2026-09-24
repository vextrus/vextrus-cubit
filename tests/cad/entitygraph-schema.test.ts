// AC-2 — both runtimes parse the committed fixtures (L-CAD-05).
//
// The TypeScript mirror is loaded the way the held-out frame loads product code: assert the file
// exists first, then import it, so a module the Builder has not written yet fails as an assertion
// naming the path rather than as an opaque collection death.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artifactAt, forgetArtifacts } from "../../src/core/entitygraph/artifact";
import type { EntityGraph } from "../../src/core/entitygraph/schema";
import type { Storage } from "../../src/core/storage";
import {
  asArray,
  asObject,
  asStoredV2,
  committedArtifactNames,
  committedPdfArtifactNames,
  type JsonValue,
  NAMED_FIXTURES,
  readCommittedArtifact,
  REPO_ROOT,
  requireCadPackage,
  runInCadProject,
  writtenAtV3,
} from "./support/artifact";

const SCHEMA_MODULE = join(REPO_ROOT, "src", "core", "entitygraph", "schema.ts");

/** The closed top-level key set of a v3 artifact: v2's nine and the layer table v3 adds. */
const TOP_LEVEL_KEYS = [
  "block_attributes",
  "counters",
  "derived",
  "dropped_layouts",
  "entities",
  "entitygraph_version",
  "ingest",
  "insunits",
  "layers",
  "layouts",
];

interface SchemaModule {
  readonly ENTITYGRAPH_VERSION: unknown;
  readonly ENTITYGRAPH_FLOOR: unknown;
  readonly entityGraphSchema: { parse(value: unknown): unknown; safeParse(value: unknown): { success: boolean; error?: { message: string } } };
}

/** The first record of `kind` whose fields match, from a document the test owns. */
function firstRecord(graph: Record<string, JsonValue>, kind: string, where: Record<string, JsonValue>): Record<string, JsonValue> {
  const found = asArray(graph[kind], kind)
    .map((record, i) => asObject(record, `${kind}[${i}]`))
    .find((record) => Object.entries(where).every(([key, value]) => record[key] === value));
  expect(found, `no ${kind} record where ${JSON.stringify(where)}`).toBeDefined();
  return found!;
}

/** Why the Zod mirror refused a document, or null when it parsed. */
function refusal(schema: SchemaModule["entityGraphSchema"], graph: unknown): string | null {
  const parsed = schema.safeParse(graph);
  return parsed.success ? null : (parsed.error?.message ?? "refused");
}

/** A storage port that answers one artifact's bytes at any address — the stored-read path's input. */
function storageHolding(graph: Record<string, JsonValue>): Storage {
  const bytes = new TextEncoder().encode(JSON.stringify(graph));
  return {
    put: async () => {
      throw new Error("this stand-in is read-only");
    },
    get: async () => bytes,
  } as unknown as Storage;
}

async function schemaModule(): Promise<SchemaModule> {
  expect(existsSync(SCHEMA_MODULE), `${SCHEMA_MODULE} is missing — the Zod mirror does not exist yet`).toBe(true);
  return (await import(SCHEMA_MODULE)) as SchemaModule;
}

// The type is the mirror's third export, and a type is only judged by the compiler: this alias
// fails `tsc` unless `EntityGraph` carries the whole closed top-level vocabulary.
type Assert<T extends true> = T;
export type EntityGraphMirrorsTheArtifact = Assert<
  | "entitygraph_version"
  | "ingest"
  | "insunits"
  | "layouts"
  | "dropped_layouts"
  | "entities"
  | "derived"
  | "block_attributes"
  | "counters"
  | "layers" extends keyof EntityGraph
    ? true
    : false
>;

describe("AC-2: both sides parse the committed fixtures", () => {
  it("AC-2: the mirror exports ENTITYGRAPH_VERSION 3, the v2 floor, and a Zod entityGraphSchema", async () => {
    const mod = await schemaModule();
    expect(mod.ENTITYGRAPH_VERSION, "ENTITYGRAPH_VERSION is the version the extractor writes").toBe(3);
    expect(mod.ENTITYGRAPH_FLOOR, "ENTITYGRAPH_FLOOR is L-CAD-05's v2 floor").toBe(2);
    expect(typeof mod.entityGraphSchema.parse, "entityGraphSchema must expose Zod's parse").toBe("function");
  });

  it("AC-2: entityGraphSchema.parse accepts every committed artifact, whose top-level keys are the closed set", async () => {
    const { entityGraphSchema } = await schemaModule();
    const names = committedArtifactNames();
    for (const named of NAMED_FIXTURES) expect(names).toContain(named);
    expect(committedPdfArtifactNames(), "the vector-PDF lane's own fixture is committed beside them").toContain("forms");

    for (const name of [...names, ...committedPdfArtifactNames()]) {
      const { graph } = readCommittedArtifact(name);
      expect(Object.keys(graph).sort(), `${name}.entitygraph.json spells keys outside the closed set`).toEqual(TOP_LEVEL_KEYS);
      expect(() => entityGraphSchema.parse(graph), `${name}.entitygraph.json failed the Zod mirror`).not.toThrow();
    }
  });

  it("AC-2: the mirror rejects an artifact below the v2 floor", async () => {
    const { entityGraphSchema } = await schemaModule();
    const { graph } = readCommittedArtifact(NAMED_FIXTURES[0]);
    const downgraded = structuredClone(graph);
    downgraded["entitygraph_version"] = 1;
    expect(() => entityGraphSchema.parse(downgraded), "entitygraph_version 1 must not parse against a v2 mirror").toThrow();
  });

  it("AC-2: the mirror rejects an entity key that drops the DXF_HANDLE scheme", async () => {
    const { entityGraphSchema } = await schemaModule();
    const { graph } = readCommittedArtifact(NAMED_FIXTURES[0]);
    const entities = asArray(graph["entities"], "entities");
    expect(entities.length, "the basic fixture must carry entities to mutate").toBeGreaterThan(0);

    const stripped = structuredClone(graph);
    const first = asObject(asArray(stripped["entities"], "entities")[0], "entities[0]");
    const key = String(first["key"]);
    first["key"] = key.replace(/^DXF_HANDLE:/, "") as JsonValue;
    expect(first["key"], "the fixture's key had no scheme prefix to strip").not.toBe(key);
    expect(() => entityGraphSchema.parse(stripped), "a scheme-less source key must not parse (L-CAD-02)").toThrow();
  });

  it("AC-2: the mirror admits a counters row's conversion_losses and refuses a loss that is not a tally", async () => {
    // The DWG lane reconciles its two passes class by class (L-CAD-04); what the conversion did not
    // carry onto a space rides the counters, where R-TO-001 already keeps what the extraction lost.
    // Optional, because a DXF ingest crosses no converter: every committed artifact here is one, and
    // the shape must admit both — the same reading `cad/tests/test_mirror.py` holds the Python half
    // to, so the two mirrors stay one shape (L-CAD-05).
    const { entityGraphSchema } = await schemaModule();
    const { graph } = readCommittedArtifact(NAMED_FIXTURES[0]);
    const carried = structuredClone(graph);
    const counters = asArray(carried["counters"], "counters");
    expect(counters.length, "the basic fixture must carry a counters row to put a loss on").toBeGreaterThan(0);
    const row = asObject(counters[0], "counters[0]");
    expect(row["conversion_losses"], "a DXF ingest wrote a conversion's loss").toBeUndefined();

    row["conversion_losses"] = { LWPOLYLINE: 12691 };
    expect(() => entityGraphSchema.parse(carried), "a conversion's per-class loss must parse").not.toThrow();

    row["conversion_losses"] = { LWPOLYLINE: -1 };
    expect(() => entityGraphSchema.parse(carried), "a loss that is not a tally must not parse").toThrow();
  });

  it("AC-2: the Python mirror validates the same committed artifacts", () => {
    requireCadPackage();
    const run = runInCadProject(["pytest", "cad/tests/test_mirror.py", "-q"]);
    expect(run.status, `pytest cad/tests/test_mirror.py exited ${run.status}\n${run.stdout}\n${run.stderr}`).toBe(0);
  }, 600_000);
});

describe("EntityGraph v3: two versions, two doors (L-CAD-05, I-415)", () => {
  it("a stored v2 artifact still reads — through the mirror and through the stored-read path", async () => {
    const { entityGraphSchema } = await schemaModule();
    for (const name of committedArtifactNames()) {
      const stored = asStoredV2(readCommittedArtifact(name).graph);
      expect(refusal(entityGraphSchema, stored), `${name} at the v2 floor must still parse`).toBeNull();
    }

    // The path a drawing ingested before v3 is read by (sheets, the partition rebuild, the viewer).
    forgetArtifacts();
    const stored = asStoredV2(readCommittedArtifact(NAMED_FIXTURES[0]).graph);
    const graph = await artifactAt("00000000-0000-4000-8000-000000000001", "c".repeat(64), storageHolding(stored), "a v2 ingest");
    expect(graph.entitygraph_version, "the stored v2 artifact is answered as the v2 it is").toBe(2);
    expect(graph.layers, "and carries none of v3's facts").toBeUndefined();
    forgetArtifacts();
  });

  it("a version beside the two it admits is refused", async () => {
    const { entityGraphSchema } = await schemaModule();
    const { graph } = readCommittedArtifact(NAMED_FIXTURES[0]);
    expect(refusal(entityGraphSchema, { ...graph, entitygraph_version: 4 }), "v4 is not a version this tree reads").not.toBeNull();
    expect(refusal(entityGraphSchema, { ...asStoredV2(graph), entitygraph_version: 1 }), "v1 is below the floor").not.toBeNull();
  });

  it("a v2 artifact spelling one of v3's facts is two dialects in one file, and refused", async () => {
    const { entityGraphSchema } = await schemaModule();
    const stored = asStoredV2(readCommittedArtifact(NAMED_FIXTURES[0]).graph);
    expect(refusal(entityGraphSchema, { ...stored, layers: [] })).toMatch(/v2 artifact never carries layers/);

    const turned = structuredClone(stored);
    firstRecord(turned, "entities", { type: "TEXT" })["rotation"] = 90;
    expect(refusal(entityGraphSchema, turned)).toMatch(/which a v2 artifact never carries/);
  });

  it("v3 requires its facts wherever they apply", async () => {
    const { entityGraphSchema } = await schemaModule();
    const basic = readCommittedArtifact("basic").graph;
    const blocks = readCommittedArtifact("blocks").graph;

    const cases: { what: string; graph: Record<string, JsonValue>; says: RegExp }[] = [];
    const without = (source: Record<string, JsonValue>, kind: string, where: Record<string, JsonValue>, field: string): Record<string, JsonValue> => {
      const graph = structuredClone(source);
      delete firstRecord(graph, kind, where)[field];
      return graph;
    };
    cases.push({ what: "a TEXT without its rotation", graph: without(basic, "entities", { type: "TEXT" }, "rotation"), says: /missing rotation/ });
    cases.push({ what: "a TEXT without its halign", graph: without(basic, "entities", { type: "TEXT" }, "halign"), says: /missing halign or valign/ });
    cases.push({ what: "an MTEXT without its attachment", graph: without(basic, "entities", { type: "MTEXT" }, "attachment"), says: /missing attachment/ });
    cases.push({ what: "a block reference without its identity", graph: without(blocks, "entities", { type: "INSERT" }, "block"), says: /missing block/ });
    cases.push({ what: "an attribute without its valign", graph: without(blocks, "block_attributes", { tag: "ROOM" }, "valign"), says: /missing valign/ });
    const layerless = structuredClone(basic);
    delete layerless["layers"];
    cases.push({ what: "an artifact without its layer table", graph: layerless, says: /missing layers/ });

    for (const { what, graph, says } of cases) {
      expect(refusal(entityGraphSchema, graph), `${what} is a broken v3 artifact, not an old one`).toMatch(says);
    }
  });

  it("v3's facts are admitted only where they apply, and only in range", async () => {
    const { entityGraphSchema } = await schemaModule();
    const basic = readCommittedArtifact("basic").graph;
    const cases: { what: string; type: string; field: string; value: JsonValue; says: RegExp }[] = [
      { what: "a rotation of a whole turn", type: "TEXT", field: "rotation", value: 360, says: /rotation/ },
      { what: "a clockwise rotation", type: "TEXT", field: "rotation", value: -90, says: /rotation/ },
      { what: "halign past FIT", type: "TEXT", field: "halign", value: 6, says: /halign/ },
      { what: "an attachment on a TEXT", type: "TEXT", field: "attachment", value: 1, says: /only an MTEXT states/ },
      { what: "halign on an MTEXT", type: "MTEXT", field: "halign", value: 0, says: /as its attachment/ },
      { what: "an alignment point on a left-baseline text", type: "TEXT", field: "align_point", value: [0, 0], says: /aligned left on its baseline/ },
      { what: "a rotation on a LINE", type: "LINE", field: "rotation", value: 0, says: /only a text carries/ },
      { what: "an override on a LINE", type: "LINE", field: "override", value: "14'-2\"", says: /only a dimension states/ },
    ];
    for (const { what, type, field, value, says } of cases) {
      const graph = structuredClone(basic);
      firstRecord(graph, "entities", { type })[field] = value;
      expect(refusal(entityGraphSchema, graph), `${what} must not parse`).toMatch(says);
    }

    const aligned = structuredClone(basic);
    const text = firstRecord(aligned, "entities", { type: "TEXT" });
    text["halign"] = 1;
    text["valign"] = 2;
    expect(refusal(entityGraphSchema, aligned), "a text aligned off its baseline carries the point that places it").toMatch(/missing align_point/);
    text["align_point"] = [1, 2];
    expect(refusal(entityGraphSchema, aligned), "and parses once it does").toBeNull();
  });

  it("the layer table restates a name the drawing spells empty, as a drawn record's layer is admitted", async () => {
    // A restated fact never refuses a drawing v2 took (I-415): v2 admitted `layer: ""` on a record,
    // so the row stating that layer's visibility is admitted too. cad/tests/test_unreadable_facts.py
    // holds the Python mirror and the extractor to the same.
    const { entityGraphSchema } = await schemaModule();
    const graph = structuredClone(readCommittedArtifact("basic").graph);
    graph["layers"] = [...asArray(graph["layers"], "layers"), { name: "", on: true, frozen: false, plot: true }];
    expect(refusal(entityGraphSchema, graph), "an empty layer name parses").toBeNull();
    graph["layers"] = [...asArray(graph["layers"], "layers"), { name: 0, on: true, frozen: false, plot: true }];
    expect(refusal(entityGraphSchema, graph), "a name is still a string").not.toBeNull();
  });

  it("a block identity is closed, canonical and complete", async () => {
    const { entityGraphSchema } = await schemaModule();
    const blocks = readCommittedArtifact("blocks").graph;
    const cases: { what: string; patch: Record<string, JsonValue>; drop?: string }[] = [
      { what: "a negative scale (a mirror is `mirrored`)", patch: { scale: [-1, 1] } },
      { what: "a rotation of a whole turn", patch: { rotation: 360 } },
      { what: "an uppercase digest", patch: { definition_sha256: "A".repeat(64) } },
      { what: "a key outside the closed set", patch: { via: "x" } },
      { what: "no mirrored flag", patch: {}, drop: "mirrored" },
    ];
    for (const { what, patch, drop } of cases) {
      const graph = structuredClone(blocks);
      const reference = firstRecord(graph, "entities", { type: "INSERT" });
      const block = { ...asObject(reference["block"], "block"), ...patch };
      if (drop !== undefined) delete block[drop];
      reference["block"] = block;
      expect(refusal(entityGraphSchema, graph), `${what} must not parse`).not.toBeNull();
    }
  });

  it("a stand-in's drawing is what the door takes only once it is written at v3, and a block reference must state what it names", async () => {
    // The unit, database and journey stages stand in for the extractor at the ingest door, which
    // takes v3 alone; they author their drawings through writtenAtV3 (tests/cad/support). A stage's
    // own v2-shaped drawing is the stored-v2 form of a committed artifact.
    const { entityGraphSchema } = await schemaModule();
    const authored = asStoredV2(readCommittedArtifact("basic").graph);
    expect(refusal(entityGraphSchema, { ...authored, entitygraph_version: 3 }), "the number alone is not v3: its facts are missing").toMatch(/missing/);

    const written = writtenAtV3(authored);
    expect(refusal(entityGraphSchema, written), "written at v3, the stage's drawing parses as the extractor's would").toBeNull();
    const drawnOn = [...new Set(["entities", "derived"].flatMap((kind) => asArray(written[kind], kind).map((record) => asObject(record, kind)["layer"])))];
    expect(asArray(written["layers"], "layers"), "every layer drawn on is in the table, on, thawed and plotted, in the order first drawn").toEqual(
      drawnOn.map((name) => ({ name, on: true, frozen: false, plot: true })),
    );

    const turned = structuredClone(authored);
    firstRecord(turned, "entities", { type: "TEXT" })["rotation"] = 90;
    expect(firstRecord(writtenAtV3(turned), "entities", { type: "TEXT" })["rotation"], "a fact the stage states is kept as stated").toBe(90);

    const referenced = asStoredV2(readCommittedArtifact("blocks").graph);
    expect(() => writtenAtV3(referenced), "no block identity is invented for a stage").toThrow(/block reference that states no block/);
  });
});

/** A well-formed record of one traced picture on `space` (I-584), for a test to break one field of. */
function rasterRecord(space: string): Record<string, JsonValue> {
  return {
    space,
    sha256: "0".repeat(64),
    width: 720,
    height: 480,
    dpi: 152.4,
    dpi_source: "placement",
    deskew_degrees: 0,
    placement: [
      [85, 323],
      [425, 323],
      [425, 96],
      [85, 96],
    ],
    traced: 1,
    dropped_short: 0,
  };
}

describe("M4P-3: a traced picture is recorded beside its lines, and both mirrors read the record alike (R-TO-003, I-584)", () => {
  const TRACE = { tool: "opencv-lsd", tool_version: "4.13.0.90", parameter_set_hash: "0".repeat(64) };
  const RASTER_KEY = `RASTER_TRACE:${"B".repeat(64)}`;

  /** The forms fixture as a mixed page: its page 1 image traced into one line, identity and record in place. */
  function mixed(): Record<string, JsonValue> {
    const graph = structuredClone(readCommittedArtifact("forms").graph);
    const entities = asArray(graph["entities"], "entities").map((record, i) => asObject(record, `entities[${String(i)}]`));
    const image = entities.find((record) => record["type"] === "IMAGE");
    expect(image, "the forms fixture lists one image").toBeDefined();
    const line = {
      key: RASTER_KEY,
      space: image!["space"] ?? null,
      type: "LINE",
      layer: "TRACE",
      colour: { rgb: [0, 0, 0], source: "truecolor" },
      points: [
        [450, 330],
        [490, 360],
      ],
    };
    return {
      ...graph,
      ingest: { ...asObject(graph["ingest"], "ingest"), trace: TRACE },
      entities: [...entities, line],
      rasters: [{ ...rasterRecord(String(image!["space"])), image: image!["key"] ?? null }],
    };
  }

  it("admits a mixed page: pdfium's keys and the vectoriser's on one page, the picture's record naming its IMAGE", async () => {
    const { entityGraphSchema } = await schemaModule();
    expect(refusal(entityGraphSchema, mixed())).toBeNull();
    const unstated = { ...rasterRecord("Page 1"), dpi: null, dpi_source: "unstated" };
    expect(refusal(entityGraphSchema, { ...mixed(), rasters: [unstated] }), "a DPI nobody stated is null, and says so").toBeNull();
  });

  it("refuses traced lines with no record of their picture, and a record where no vectoriser is pinned", async () => {
    const { entityGraphSchema } = await schemaModule();
    const graph = mixed();
    expect(refusal(entityGraphSchema, { ...graph, rasters: [] }), "a traced line whose picture nobody recorded").toMatch(/no traced picture's record/);
    const unpinnedIngest = Object.fromEntries(Object.entries(asObject(graph["ingest"], "ingest")).filter(([key]) => key !== "trace"));
    const unpinned = { ...graph, ingest: unpinnedIngest, entities: asArray(graph["entities"], "entities").slice(0, -1) };
    expect(refusal(entityGraphSchema, unpinned), "a picture's record with no vectoriser pinned").toMatch(/no vectoriser's identity is pinned/);
  });

  it.each([
    [{ dpi: null }, /null exactly when/],
    [{ dpi_source: "unstated" }, /null exactly when/],
    [{ dpi_source: "sheet" }, /dpi_source/],
    [{ sha256: "A".repeat(64) }, /sha256/],
    [{ space: "Page 9" }, /names no layout/],
    [{ placement: [[0, 0]] }, /placement/],
    [{ traced: -1 }, /traced/],
    [{ image: `PDF_OBJECT:${"A".repeat(64)}` }, /names no IMAGE/],
    [{ note: 1 }, /note/],
  ] as const)("refuses a record with %j", async (change, why) => {
    const { entityGraphSchema } = await schemaModule();
    const graph = mixed();
    const [record] = asArray(graph["rasters"], "rasters");
    expect(refusal(entityGraphSchema, { ...graph, rasters: [{ ...asObject(record, "rasters[0]"), ...change }] })).toMatch(why);
  });

  it("a v2 artifact never carries rasters", async () => {
    const { entityGraphSchema } = await schemaModule();
    const stored = asStoredV2(readCommittedArtifact("basic").graph);
    expect(refusal(entityGraphSchema, stored), "the stored v2 artifact reads").toBeNull();
    expect(refusal(entityGraphSchema, { ...stored, rasters: [] })).toMatch(/never carries rasters/);
  });

  it("the Python mirror admits and refuses the same records", () => {
    requireCadPackage();
    const [record] = asArray(mixed()["rasters"], "rasters");
    const graphs = [mixed(), { ...mixed(), rasters: [] }, { ...mixed(), rasters: [{ ...asObject(record, "rasters[0]"), dpi: null }] }];
    const dir = mkdtempSync(join(tmpdir(), "cubit-rasters-mirror-"));
    try {
      const paths = graphs.map((graph, index) => {
        const path = join(dir, `${String(index)}.json`);
        writeFileSync(path, JSON.stringify(graph));
        return path;
      });
      const script = [
        "import json, sys",
        "from vextrus_cad import parse_entity_graph",
        "for path in sys.argv[1:]:",
        "    try:",
        "        parse_entity_graph(json.load(open(path))); print('ok')",
        "    except Exception as error:",
        "        print('refused', error)",
      ].join("\n");
      const run = runInCadProject(["python", "-c", script, ...paths]);
      const [admitted, unrecorded, undeclared] = run.stdout.trim().split("\n");
      expect(admitted, run.stderr).toBe("ok");
      expect(unrecorded).toMatch(/no traced picture's record/);
      expect(undeclared).toMatch(/null exactly when/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("M4P-1: the scheme rides per key, and the ingest record pins one identity per scheme (L-CAD-02)", () => {
  /** A committed PDF artifact with its geometry taken away, so only the rule under test decides. */
  function keyless(): Record<string, JsonValue> {
    return { ...readCommittedArtifact("forms").graph, entities: [], derived: [], block_attributes: [] };
  }

  /** The forms fixture's first original, re-keyed. */
  function keyed(key: string): Record<string, JsonValue> {
    const first = asObject(asArray(readCommittedArtifact("forms").graph["entities"], "entities")[0], "entities[0]");
    return { ...first, key };
  }

  const TRACE = { tool: "vectoriser", tool_version: "1", parameter_set_hash: "0".repeat(64) };
  const RASTER_KEY = `RASTER_TRACE:${"A".repeat(64)}`;

  it("admits every scheme of the closed set as the ingest record's, and refuses any other spelling", async () => {
    const { entityGraphSchema } = await schemaModule();
    const graph = keyless();
    const ingest = asObject(graph["ingest"], "ingest");
    for (const scheme of ["DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE"]) {
      expect(refusal(entityGraphSchema, { ...graph, ingest: { ...ingest, scheme } }), `${scheme} is a scheme an extractor mints`).toBeNull();
    }
    for (const scheme of ["pdf_object", "PDF_OBJECTS", "SCHEME_NOTHING_MINTS"]) {
      expect(refusal(entityGraphSchema, { ...graph, ingest: { ...ingest, scheme } }), `${scheme} is no scheme`).not.toBeNull();
    }
  });

  it("refuses a key of a scheme the ingest record pins no identity for", async () => {
    const { entityGraphSchema } = await schemaModule();
    const graph = keyless();
    expect(refusal(entityGraphSchema, { ...graph, entities: [keyed(RASTER_KEY)] }), "a traced key with no vectoriser identity").toMatch(/pins no identity/);
    expect(refusal(entityGraphSchema, { ...graph, entities: [keyed("DXF_HANDLE:1F")] }), "a handle in a PDF's record").toMatch(/pins no identity/);
    const traced = { ...graph, ingest: { ...asObject(graph["ingest"], "ingest"), trace: TRACE }, entities: [keyed(RASTER_KEY)] };
    const record = rasterRecord(String(keyed(RASTER_KEY)["space"]));
    expect(refusal(entityGraphSchema, { ...traced, rasters: [record] }), "a traced key beside a PDF's, the vectoriser's identity pinned (a mixed page)").toBeNull();
  });

  it("admits a vectoriser's identity only beside a PDF's, and only whole", async () => {
    const { entityGraphSchema } = await schemaModule();
    const graph = keyless();
    const ingest = asObject(graph["ingest"], "ingest");
    for (const scheme of ["DXF_HANDLE", "RASTER_TRACE"]) {
      expect(refusal(entityGraphSchema, { ...graph, ingest: { ...ingest, scheme, trace: TRACE } }), `a vectoriser's identity beside ${scheme}`).toMatch(/rides only beside PDF_OBJECT/);
    }
    const partial = { tool: TRACE.tool, tool_version: TRACE.tool_version };
    expect(refusal(entityGraphSchema, { ...graph, ingest: { ...ingest, trace: partial } }), "half an identity").not.toBeNull();
    expect(refusal(entityGraphSchema, { ...graph, ingest: { ...ingest, trace: { ...TRACE, dpi: 300 } } }), "an identity outside its closed keys").not.toBeNull();
  });

  it("refuses a digest scheme's key that is not a whole sha256", async () => {
    const { entityGraphSchema } = await schemaModule();
    expect(refusal(entityGraphSchema, { ...keyless(), entities: [keyed("PDF_OBJECT:9B26C360")] }), "a truncated digest collides where the drawing does not").toMatch(/whole sha256/);
  });

  it("admits a page's collapse tally on its counters row, and refuses one that is not a tally", async () => {
    const { entityGraphSchema } = await schemaModule();
    const graph = structuredClone(readCommittedArtifact("forms").graph);
    const row = asObject(asArray(graph["counters"], "counters")[0], "counters[0]");
    expect(row["collapsed"], "the fixture collapses on page 1").toEqual({ LWPOLYLINE: 2, TEXT: 1 });
    row["collapsed"] = { TEXT: -1 };
    expect(refusal(entityGraphSchema, graph), "a collapse count below zero").not.toBeNull();
  });

  it("admits a page's unread tally on its counters row, and refuses one that is not a tally (I-521)", async () => {
    const { entityGraphSchema } = await schemaModule();
    const graph = structuredClone(readCommittedArtifact("forms").graph);
    expect(refusal(entityGraphSchema, graph), "the committed fixture parses").toBeNull();
    const row = asObject(asArray(graph["counters"], "counters")[0], "counters[0]");
    expect(row["unread"], "the fixture's page 1 carries one image").toEqual({ IMAGE: 1 });
    row["unread"] = { IMAGE: 0.5 };
    expect(refusal(entityGraphSchema, graph), "a fractional count").not.toBeNull();
  });
});
