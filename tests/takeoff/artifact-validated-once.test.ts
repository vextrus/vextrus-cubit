/**
 * L-CAD-05's artifact, validated ONCE per content hash (B-17, B-19).
 *
 * Five readers of one drawing — sheets, scale evidence, the partition rebuild, the thumbnails
 * pipeline and the viewer's head — each had the same read-decode-validate copied into it, so a pass
 * over one set put the same tens of thousands of entities through the mirror five times, and a sixth
 * the next time a sheet index was rendered. The counter is what proves the second read does not.
 *
 * Nothing here reaches a database or a clock: the storage port is a stand-in that counts its reads.
 */
import { describe, expect, test } from "vitest";
import { committedArtifactNames, readCommittedArtifact } from "../cad/support/artifact";
import { artifactAt, artifactCacheTally, forgetArtifacts, rememberValidated } from "@/core/entitygraph/artifact";
import type { Storage } from "@/core/storage";

/** A committed artifact of the corpus — the mirror's own fixtures, so what is counted is the
 * validating of a real graph and not of a shape this file invented. */
const GRAPH = readCommittedArtifact(committedArtifactNames()[0] as string).graph;

const TENANT = "00000000-0000-4000-8000-000000000001";
const HASH = "a".repeat(64);
const OTHER = "b".repeat(64);

/** A storage port that answers the bytes and counts how often it was asked. */
function storageThatCounts(bytes: Uint8Array): { readonly port: Storage; reads: () => number } {
  let reads = 0;
  const port = {
    put: async () => {
      throw new Error("this stand-in is read-only");
    },
    get: async (_tenantId: string, sha256: string) => {
      reads += 1;
      return sha256 === HASH || sha256 === OTHER ? bytes : null;
    },
  } as unknown as Storage;
  return { port, reads: () => reads };
}

const BYTES = new TextEncoder().encode(JSON.stringify(GRAPH));

describe("one validation per content hash", () => {
  test("the second read of the same drawing does not re-validate, and does not re-read the store", async () => {
    forgetArtifacts();
    const store = storageThatCounts(BYTES);

    const first = await artifactAt(TENANT, HASH, store.port, "ingest one");
    expect(artifactCacheTally().validations, "the first reader validates").toBe(1);

    for (let again = 0; again < 4; again += 1) {
      const later = await artifactAt(TENANT, HASH, store.port, "ingest one");
      expect(later, "every later reader is answered with the same validated graph").toBe(first);
    }

    const tally = artifactCacheTally();
    expect(tally.validations, "five readers of one drawing validate it once — this is the whole point").toBe(1);
    expect(tally.hits, "the other four were answered from the hash").toBe(4);
    expect(store.reads(), "and the bytes were fetched once, not five times").toBe(1);
  });

  test("two readers asking at the same moment share one read", async () => {
    forgetArtifacts();
    const store = storageThatCounts(BYTES);
    const together = await Promise.all(Array.from({ length: 5 }, () => artifactAt(TENANT, HASH, store.port, "ingest one")));
    expect(artifactCacheTally().validations, "a race is one validation, not five").toBe(1);
    expect(new Set(together).size, "and they are all handed the same graph").toBe(1);
  });

  test("a different hash is a different artifact — the cache never answers with another drawing", async () => {
    forgetArtifacts();
    const store = storageThatCounts(BYTES);
    await artifactAt(TENANT, HASH, store.port, "ingest one");
    await artifactAt(TENANT, OTHER, store.port, "ingest two");
    expect(artifactCacheTally().validations, "two addresses are two artifacts").toBe(2);
  });

  test("a graph the ingest has already validated is not validated again when it is first asked for", async () => {
    forgetArtifacts();
    const store = storageThatCounts(BYTES);
    rememberValidated(TENANT, HASH, structuredClone(GRAPH) as never);
    await artifactAt(TENANT, HASH, store.port, "ingest one");
    expect(artifactCacheTally().validations, "the validated flag rides with the hash from the moment the hash exists").toBe(0);
    expect(store.reads(), "and nothing is fetched at all").toBe(0);
  });

  test("one tenant is never answered with another tenant's object", async () => {
    forgetArtifacts();
    const store = storageThatCounts(BYTES);
    await artifactAt(TENANT, HASH, store.port, "ingest one");
    await artifactAt("00000000-0000-4000-8000-000000000002", HASH, store.port, "ingest one");
    expect(artifactCacheTally().validations, "an object is a tenant's: the same hash under another tenant is another read").toBe(2);
  });

  test("an address the store cannot answer says which record asked", async () => {
    forgetArtifacts();
    const store = storageThatCounts(BYTES);
    await expect(artifactAt(TENANT, "c".repeat(64), store.port, "ingest seven")).rejects.toThrow("ingest seven");
  });
});
