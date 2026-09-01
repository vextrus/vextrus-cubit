// AC-2 — both runtimes parse the committed fixtures (L-CAD-05).
//
// The TypeScript mirror is loaded the way the held-out frame loads product code: assert the file
// exists first, then import it, so a module the Builder has not written yet fails as an assertion
// naming the path rather than as an opaque collection death.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EntityGraph } from "../../src/core/entitygraph/schema";
import {
  asArray,
  asObject,
  committedArtifactNames,
  type JsonValue,
  NAMED_FIXTURES,
  readCommittedArtifact,
  REPO_ROOT,
  requireCadPackage,
  runInCadProject,
} from "./support/artifact";

const SCHEMA_MODULE = join(REPO_ROOT, "src", "core", "entitygraph", "schema.ts");

/** The closed top-level key set the test contract states. */
const TOP_LEVEL_KEYS = [
  "block_attributes",
  "counters",
  "derived",
  "dropped_layouts",
  "entities",
  "entitygraph_version",
  "ingest",
  "insunits",
  "layouts",
];

interface SchemaModule {
  readonly ENTITYGRAPH_VERSION: unknown;
  readonly entityGraphSchema: { parse(value: unknown): unknown };
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
  | "counters" extends keyof EntityGraph
    ? true
    : false
>;

describe("AC-2: both sides parse the committed fixtures", () => {
  it("AC-2: the mirror exports ENTITYGRAPH_VERSION 2 and a Zod entityGraphSchema", async () => {
    const mod = await schemaModule();
    expect(mod.ENTITYGRAPH_VERSION, "ENTITYGRAPH_VERSION must be the v2 floor").toBe(2);
    expect(typeof mod.entityGraphSchema.parse, "entityGraphSchema must expose Zod's parse").toBe("function");
  });

  it("AC-2: entityGraphSchema.parse accepts every committed artifact, whose top-level keys are the closed set", async () => {
    const { entityGraphSchema } = await schemaModule();
    const names = committedArtifactNames();
    for (const named of NAMED_FIXTURES) expect(names).toContain(named);

    for (const name of names) {
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

  it("AC-2: the Python mirror validates the same committed artifacts", () => {
    requireCadPackage();
    const run = runInCadProject(["pytest", "cad/tests/test_mirror.py", "-q"]);
    expect(run.status, `pytest cad/tests/test_mirror.py exited ${run.status}\n${run.stdout}\n${run.stderr}`).toBe(0);
  }, 600_000);
});
