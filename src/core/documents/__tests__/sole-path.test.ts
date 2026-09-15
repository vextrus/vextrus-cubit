/**
 * AC-1: THE SEAM'S SURFACE — `renderDocument` is the tree's ONE path to the pinned Typst
 * subprocess, every kind is a file behind a barrel that enumerates and never re-declares, and a
 * kind or a payload the seam cannot take is refused before the subprocess is ever reached
 * (SEAM-DOC, R-SPINE-040, AM-08).
 *
 * The first two questions are about the SOURCE TEXT and cannot be otherwise: "no second file
 * spawns typst" and "no template asks the renderer for today's date" are properties of what is
 * written, not of what any one call does — a run proves only the path it took. Both are read
 * through the tree's one lexical machine (tests/support/source-lex.ts), so a `typst` in a comment
 * or in prose is not a spawn, and both are anchored to a file that must EXIST: a scan over a tree
 * with no renderer in it would pass by finding nothing.
 *
 * The rest is behaviour: the barrel's own enumeration, and the two refusals the order of work
 * states — with the subprocess injected, so "never called" is observed rather than assumed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inTree } from "../../../../tests/docs/support/product";
import { kindsModule, documentsIndex, type DocumentKind, type RenderDeps, type StagedRender } from "../../../../tests/docs/support/seam";
// white-box: AC-1 — the criterion names the tree's one lexer ("lexing every .ts/.tsx under src/**,
// tests/**, db/**, scripts/** through tests/support/source-lex.ts so comments and string literals
// do not count"): "no SECOND file spawns typst" is a property of the source, and this is the one
// home for reading it (tests/docs/support/tree-source.ts).
import { filesUnder, withoutComments } from "../../../../tests/docs/support/tree-source";
import { refusalCodeOf } from "../../faults/refusal-marker";

/** The one file the tree admits a `typst` subprocess in (SEAM-DOC). */
const SOLE_PATH = "src/core/documents/typst.ts";

/** The roots AC-1 lexes: everything that could hold a second spawn. */
const SCANNED_ROOTS = ["src", "tests", "db", "scripts"] as const;

/** Where a `.typ` of this product lives, and where `datetime.today` would make a render non-deterministic. */
const TEMPLATE_ROOTS = ["documents/base", "src/core/documents/kinds"] as const;

/**
 * Does this file hand `typst` to `child_process`? The command is the call's FIRST argument, and the
 * question is whether `typst` is spelled in it — `spawn("typst", …)` and a defaulted
 * `execFile(binary ?? "typst", …)` are the same fact about the same file.
 */
const SPAWN_CALL = /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(([^,)]*)/gu;
const TYPST_COMMAND = /(["'`])typst\1/u;

function spawnsTypst(source: string): boolean {
  return [...source.matchAll(SPAWN_CALL)].some((call) => TYPST_COMMAND.test(call[1] ?? ""));
}

describe("AC-1: the seam's surface", () => {
  it("AC-1: exactly one file in the tree spawns `typst`, and it is src/core/documents/typst.ts", () => {
    // white-box: AC-1 — the criterion is exactly this scan, over exactly these roots; there is no
    // call, request or render that can show a spawn nobody made on this run.
    const sources = SCANNED_ROOTS.flatMap((root) => filesUnder(root, [".ts", ".tsx"]));
    expect(sources.length, "the roots AC-1 names hold source to lex").toBeGreaterThan(0);

    // white-box: AC-1 — "a spawn whose command literal is `typst` in no file but
    // src/core/documents/typst.ts" is a property of the tree's source; no run can show that a
    // second spawn is absent, only that the path this run took did not use one.
    const spawners = sources.filter((file) => spawnsTypst(withoutComments(file)));
    expect(
      spawners,
      `SEAM-DOC is the sole path to the pinned renderer: ${SOLE_PATH} spawns it and nothing else does. Found: ${spawners.join(", ") || "no file at all — the renderer is not written yet"}`,
    ).toEqual([SOLE_PATH]);
  });

  it("AC-1: no template asks the renderer for today's date", () => {
    const templates = TEMPLATE_ROOTS.flatMap((root) => filesUnder(root, [".typ"]));
    // Anchored to the templates that must exist: a scan of an empty tree finds no `datetime.today`
    // and would pass while nothing had been written at all (B-19).
    expect(templates, "the page frame and the proof template are .typ files of this tree").not.toEqual([]);
    expect(templates.some((file) => file.startsWith("documents/base/")), "documents/base carries the page frame").toBe(true);
    expect(templates, "the proof kind's template stands beside its kind file").toContain("src/core/documents/kinds/proof.typ");

    // white-box: AC-1 — "finds `datetime.today` in no .typ file" is a property of the template
    // source; a render proves only that one run was deterministic, never that the next will be.
    const dated = templates.filter((file) => readFileSync(inTree(file), "utf8").includes("datetime.today"));
    expect(dated, "a document that reads the clock cannot render byte-identically twice (R-SPINE-040)").toEqual([]);
  });

  it("AC-1: the kinds barrel enumerates this node's one kind and re-declares none of it", async () => {
    const { DOCUMENT_KINDS } = await kindsModule();
    const keys = Object.keys(DOCUMENT_KINDS);

    // The node ships exactly one kind; `boq-draft` and `bbs` are later increments' one file and one
    // barrel line each (this increment's out-of-scope list), and each amends this expectation with
    // its own criterion rather than inheriting it.
    expect(keys, "this node ships exactly the `proof` kind").toEqual(["proof"]);

    for (const [key, kind] of Object.entries(DOCUMENT_KINDS)) {
      expect(kind.kind, `the barrel enumerates ${key} under the key the kind file states — it never re-declares it`).toBe(key);
      expect(typeof kind.payloadSchema?.safeParse, `${key}'s payload is parsed by a Zod schema`).toBe("function");
      expect(kind.template.endsWith(".typ"), `${key}'s template is a .typ file`).toBe(true);
    }

    const proof = DOCUMENT_KINDS["proof"] as DocumentKind;
    expect(resolve(proof.template), "the proof kind's template resolves to the file beside it").toBe(inTree("src/core/documents/kinds/proof.typ"));

    // Enumeration, never re-declaration: every kind module under kinds/ is in the barrel exactly
    // once, and the barrel names no kind that no module declares. A duplicate key collapses one of
    // the two sides of this equality, which is what the barrel's own duplicate-key test guards.
    // white-box: AC-1 — "every kind is a file behind a barrel that enumerates and never re-declares"
    // is a claim about the FILES the barrel is built from, so the directory is enumerated and each
    // module is then IMPORTED and asked what kind it declares; no source text is read here.
    const declared = filesUnder("src/core/documents/kinds", [".ts"])
      .filter((file) => !/\/(index|law)\.ts$/u.test(file) && !file.includes("__tests__") && !file.endsWith(".test.ts"));
    const modules = await Promise.all(declared.map(async (file) => (await import(inTree(file))) as Record<string, unknown>));
    const kindsOfModules = modules
      .flatMap((module) => Object.values(module))
      .filter((value): value is DocumentKind => typeof value === "object" && value !== null && typeof (value as DocumentKind).kind === "string" && "payloadSchema" in value)
      .map((kind) => kind.kind);
    expect([...kindsOfModules].sort(), "every kind file's kind is in the barrel exactly once, and the barrel invents none").toEqual([...keys].sort());
  });

  it("AC-1: an unknown kind and a malformed payload are refused before the subprocess is reached", async () => {
    const { renderDocument } = await documentsIndex();
    const ctx = { requestId: "ac-1-request", actor: "acceptance" };
    const compiled: StagedRender[] = [];
    const deps: RenderDeps = {
      compile: async (staged) => {
        compiled.push(staged);
        return new Uint8Array();
      },
    };

    const unknownKind = await renderDocument("nope", {}, ctx, deps).then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(refusalCodeOf(unknownKind), "a kind the barrel does not hold is a refusal, never a fault").toBe("DOCUMENT_KIND_UNKNOWN");

    const malformed = await renderDocument("proof", { title: 1 }, ctx, deps).then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(refusalCodeOf(malformed), "a payload the kind's schema rejects is refused by name").toBe("DOCUMENT_PAYLOAD_MALFORMED");

    expect(compiled, "neither refusal reaches the renderer — the order of work stops before it").toEqual([]);
  });
});
