// The kind registry's own proof (AM-11, B-19, SEAM-DOC).
//
// The barrel ENUMERATES the kind files and never re-declares what they say, and this is what says so:
// every kind module in the directory is in the roster exactly once, under the key the module itself
// states, and the roster invents none. The claim is about the FILES, so the directory is read and
// each module is imported and asked what it declares — a roster derived from the roster would agree
// with itself whatever it held.
//
// The duplicate-key case is the one this shape exists for. A second kind quietly taking `proof`'s key
// would send every proof document through somebody else's template and schema, and nothing
// downstream would notice; `enumerateKinds` refuses at import instead, and that refusal is exercised
// here directly rather than by writing a second kind file into the tree to collide with.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENT_KINDS } from "./index";
import { enumerateKinds, kindTemplate, type DocumentKind } from "./law";
import { documentKindsPath } from "../tree";

/** The files of this directory that are not a kind: the roster, the shape, and the suites. */
const NOT_A_KIND = /^(index|law)\.ts$|\.test\.ts$/u;

/** A kind with nothing behind it — enough to be enumerated, and nothing that would render. */
const stub = (kind: string): DocumentKind => ({
  kind,
  payloadSchema: { safeParse: () => ({ success: true }) },
  template: kindTemplate(`${kind}.typ`),
  present: () => ({}),
});

describe("the document kind registry", () => {
  it("holds every kind file exactly once, under the key that file states", async () => {
    const files = readdirSync(documentKindsPath()).filter((entry) => entry.endsWith(".ts") && !NOT_A_KIND.test(entry));
    expect(files, "a kinds directory with no kind in it registers nothing").not.toEqual([]);

    const declared = (
      await Promise.all(files.map(async (file) => Object.values((await import(join(documentKindsPath(), file))) as Record<string, unknown>)))
    )
      .flat()
      .filter((value): value is DocumentKind => typeof value === "object" && value !== null && "kind" in value && "payloadSchema" in value)
      .map((kind) => kind.kind);

    expect([...declared].sort(), "every kind file's kind is in the barrel exactly once, and the barrel invents none").toEqual(Object.keys(DOCUMENT_KINDS).sort());
  });

  it("files each kind under the key the kind itself states, never one the barrel chose", () => {
    for (const [key, kind] of Object.entries(DOCUMENT_KINDS)) {
      expect(kind.kind, `the barrel enumerates ${key} under the key its own file states`).toBe(key);
    }
  });

  it("refuses two kinds that claim one key, rather than letting one of them win", () => {
    expect(() => enumerateKinds([stub("proof"), stub("proof")])).toThrow(/declared by two document kinds/u);
  });

  it("enumerates kinds that differ, in the order they were given", () => {
    const roster = enumerateKinds([stub("alpha"), stub("beta")]);
    expect(Object.keys(roster)).toEqual(["alpha", "beta"]);
  });
});
