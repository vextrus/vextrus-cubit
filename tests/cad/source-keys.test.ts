// AC-3 — source keys and extractor identity (L-CAD-02, L-CAD-03).
//
// The key-format and uniqueness rules are graded over every committed artifact, not just the one
// the criterion names: "every original entity carries a source key `scheme:key`" is a rule about
// the extractor, so a fixture added later is judged by it too. The derived→original rule is graded
// wherever derived paint exists, and the blocks fixture — defined by the contract as the one with
// nested INSERTs — is required to have some.
import { describe, expect, it } from "vitest";
import {
  asArray,
  asObject,
  asString,
  committedArtifactNames,
  NAMED_FIXTURES,
  readCommittedArtifact,
  records,
} from "./support/artifact";

const SOURCE_KEY = /^DXF_HANDLE:[0-9A-F]+$/;
const PARAMETER_SET_HASH = /^[0-9a-fA-F]{64}$/;

describe("AC-3: source keys and extractor identity", () => {
  it("AC-3: every original entity carries a unique DXF_HANDLE key", () => {
    const names = committedArtifactNames();
    expect(names, "the corpus must include the basic fixture the criterion names").toContain("basic");

    for (const name of names) {
      const { graph } = readCommittedArtifact(name);
      const entities = records(graph, "entities");
      expect(entities.length, `${name}: entities[] is empty`).toBeGreaterThan(0);

      const keys = entities.map((e, i) => asString(e["key"], `${name}.entities[${i}].key`));
      const malformed = keys.filter((k) => !SOURCE_KEY.test(k));
      expect(malformed, `${name}: keys must be DXF_HANDLE:<UPPERCASE-HEX>`).toEqual([]);
      expect(new Set(keys).size, `${name}: source keys are not unique`).toBe(keys.length);
    }
  });

  it("AC-3: the ingest record pins the extractor identity that scopes those keys", () => {
    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const ingest = asObject(graph["ingest"], `${name}.ingest`);
      expect(ingest["scheme"], `${name}: the scheme rides the ingest record`).toBe("DXF_HANDLE");
      expect(ingest["tool"], `${name}: DXF is read by ezdxf (L-CAD-04)`).toBe("ezdxf");
      expect(asString(ingest["tool_version"], `${name}.ingest.tool_version`).length, `${name}: tool_version is empty`).toBeGreaterThan(0);
      expect(
        asString(ingest["parameter_set_hash"], `${name}.ingest.parameter_set_hash`),
        `${name}: parameter_set_hash must be 64 hex characters`,
      ).toMatch(PARAMETER_SET_HASH);
    }
  });

  it("AC-3: the same pinned parameter set hashes identically across the whole corpus", () => {
    // One extractor identity ingests the corpus, so the parameter-set hash is a property of the
    // pinned parameters and not of the drawing — differing hashes would mean the parameters moved.
    const hashes = committedArtifactNames().map((name) => {
      const { graph } = readCommittedArtifact(name);
      return asString(asObject(graph["ingest"], "ingest")["parameter_set_hash"], "parameter_set_hash");
    });
    expect(new Set(hashes).size, `the corpus reports ${new Set(hashes).size} parameter-set hashes: ${hashes.join(", ")}`).toBe(1);
  });

  it("AC-3: every derived entity names an original in entities[], and no derived entity sits there", () => {
    const withDerived: string[] = [];

    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const originals = records(graph, "entities");
      const keys = new Set(originals.map((e, i) => asString(e["key"], `${name}.entities[${i}].key`)));

      const strays = originals
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e["src"] !== undefined && e["src"] !== null)
        .map(({ i }) => i);
      expect(strays, `${name}: entities[] holds synthesised paint (entries carrying src)`).toEqual([]);

      const derived = records(graph, "derived");
      if (derived.length > 0) withDerived.push(name);
      const orphans = derived
        .map((d, i) => asString(d["src"], `${name}.derived[${i}].src`))
        .filter((src) => !keys.has(src));
      expect(orphans, `${name}: derived paint names a src that is not an original entity key`).toEqual([]);
    }

    // The contract defines the blocks fixture as the one with nested INSERTs and ATTRIBs, so the
    // rule above cannot be satisfied vacuously by a corpus with no explosion in it.
    expect(withDerived, `no committed fixture produced derived paint — ${NAMED_FIXTURES[1]} must`).toContain(NAMED_FIXTURES[1]);
  });

  it("AC-3: block attributes are collected separately and also name an original", () => {
    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const keys = new Set(records(graph, "entities").map((e, i) => asString(e["key"], `${name}.entities[${i}].key`)));
      const attributes = asArray(graph["block_attributes"], `${name}.block_attributes`).map((a, i) =>
        asObject(a, `${name}.block_attributes[${i}]`),
      );
      for (const [i, attribute] of attributes.entries()) {
        expect(keys.has(asString(attribute["src"], `${name}.block_attributes[${i}].src`))).toBe(true);
        expect(asString(attribute["tag"], `${name}.block_attributes[${i}].tag`).length).toBeGreaterThan(0);
      }
    }
  });
});
