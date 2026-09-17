/**
 * AC-5(g): a document carrying a key the published shape does not know is refused NAMING that key
 * (debt-src-modules-pudc6i, R-TO-070, R-UI-050).
 *
 * The document is built here from the schema's own published fields, so the only thing wrong with it
 * is the one extra key this case adds: what the refusal says about that key is the whole grading.
 */
import { describe, expect, test } from "vitest";
import { MODULE, productModule } from "./support/sweep-stage";

/** The published schema, as far as this case drives it. */
type Schema = { safeParse: (value: unknown) => { success: boolean; error?: unknown } };

type PathsOf = (error: unknown) => readonly string[];

/** A binding of a line's formula, at the shape the published document declares. */
function binding(): Record<string, unknown> {
  return { value: "1.5", unit: "m3", basis: "MEASURED", source: "S-102:e:7", canonical: { value: "1.5", unit: "m3" } };
}

/** One published line, whole — every field the schema names, and nothing else. */
function lineOf(basis: string): Record<string, unknown> {
  return {
    lineId: "line-1",
    objectKey: "PLACEMENT:S-102:C1:1000:2000@level-1",
    kind: "rcc.concrete",
    class: "column",
    level: "1F",
    value: "1.5",
    unit: "m3",
    formula: "V = count × L × B × H",
    variables: { L: binding() },
    quantityBasis: basis,
    selectionBasis: basis,
    coverage: "COMPLETE",
    calibrationKeys: ["cal-1"],
    engine: "VECTOR",
    sourceKey: "S-102:e:7",
    repudiated: false,
    drawingId: "22222222-2222-4222-8222-222222222222",
    layoutName: null,
    sourceKeys: ["S-102:e:7"],
  };
}

describe("AC-5: an unrecognised key is refused by name", () => {
  test("AC-5: the issue paths name the offending key at its own path in the document", async () => {
    const door = await productModule<Record<string, unknown>>(MODULE.registerJson);
    expect(typeof door["documentIssuePathsOf"], `${MODULE.registerJson} publishes \`documentIssuePathsOf\` — what a refused document says about itself (interfaces)`).toBe("function");
    const pathsOf = door["documentIssuePathsOf"] as PathsOf;
    const document_ = door["RegisterJsonDocument"] as Schema | undefined;
    expect(typeof document_?.safeParse, `${MODULE.registerJson} publishes \`RegisterJsonDocument\`, the shape a document is judged against`).toBe("function");

    const law = await productModule<Record<string, unknown>>("src/core/offers/law.ts");
    const basis = ((law["QUANTITY_BASES"] ?? []) as readonly string[])[0] as string;
    const version = door["REGISTER_JSON_SCHEMA_VERSION"] as string;

    const whole = { schemaVersion: version, tenantId: "t", projectId: "p", campaign: null, objects: [], lines: [lineOf(basis)], refusals: [] };
    const stands = (document_ as Schema).safeParse(whole);
    expect(stands.success, "the document this case builds is otherwise the published shape — with anything else wrong with it, the extra key below would not be what the refusal is about").toBe(true);

    const carried = { ...whole, lines: [{ ...lineOf(basis), extra: "something the shape does not know" }] };
    const refused = (document_ as Schema).safeParse(carried);
    expect(refused.success, "a document carrying a key the shape does not declare is refused — every level is closed (R-TO-070)").toBe(false);

    expect(
      pathsOf(refused.error),
      "and the refusal NAMES the key at its path: `lines.0.extra` is what a reader has to go and take out, where an issue reported at the document's own root says only that something, somewhere, is wrong (R-UI-050)",
    ).toContain("lines.0.extra");
  });
});
