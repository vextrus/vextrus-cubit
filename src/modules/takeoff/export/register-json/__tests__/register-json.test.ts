/**
 * Public acceptance for A-REGISTER-JSON, AC-1: the versioned JSON export of one project's register,
 * derived purely from the reading the register workspace already answers (`RegisterView`).
 *
 * Everything is judged over the committed reading `fixtures/register-view.sample.json` and over what
 * `registerJsonOf` ANSWERS for it — never over the module's source text. The field rosters are not
 * spelled from memory: a line's fields are the reading's own line fields (the document mirrors
 * `ViewLine` field-for-field), derived from the fixture at run time, so a later increment that widens
 * the reading widens this assertion with it. The one closed total is the document's top level, which
 * the criterion itself closes ("and nothing else at the top level").
 */
import { describe, expect, test } from "vitest";
import {
  asBag,
  asBags,
  readCommittedJson,
  registerJsonDoor,
  sampleView,
  schemaBranches,
  sortedKeys,
  typesOf,
  REGISTER_JSON_MODULE,
  SCHEMA_FIXTURE,
  type SchemaNode,
} from "./support/register-json-stage";

/** The top level the criterion closes, in code-unit order. */
const DOCUMENT_KEYS = ["campaign", "lines", "objects", "projectId", "refusals", "schemaVersion", "tenantId"];

/** What every refusal the document publishes carries, and nothing more (interfaces). */
const REFUSAL_KEYS = ["code", "kind", "objectKey"];

/** The line fields the criterion names by hand, beside the ones derived from the reading. */
const LINE_FIELDS = [
  "lineId",
  "objectKey",
  "kind",
  "class",
  "level",
  "value",
  "unit",
  "formula",
  "variables",
  "quantityBasis",
  "selectionBasis",
  "coverage",
  "calibrationKeys",
  "engine",
  "sourceKey",
  "repudiated",
  "drawingId",
  "layoutName",
  "sourceKeys",
];

/** The object fields the criterion names by hand, beside the ones derived from the reading. */
const OBJECT_FIELDS = ["objectKey", "discipline", "level", "class", "mark", "basis", "role", "corroboration", "sourceKey", "attributes"];

/** The export of the committed reading, for one assertion. */
async function exported(): Promise<{ view: ReturnType<typeof sampleView>; document: Record<string, unknown> }> {
  const view = sampleView();
  const door = await registerJsonDoor();
  return { view, document: asBag(door.registerJsonOf(view), "what `registerJsonOf` answers for the committed reading") };
}

describe("AC-1: the register JSON export is a pure function of the register's reading", () => {
  test("AC-1: the module publishes the schema version, the schema and the export function", async () => {
    const door = await registerJsonDoor();
    expect(door.REGISTER_JSON_SCHEMA_VERSION, `${REGISTER_JSON_MODULE} publishes the version this schema is (AC-1)`).toBe("1.0");
  });

  test("AC-1: the schema accepts the document the committed reading exports to", async () => {
    const { document } = await exported();
    const door = await registerJsonDoor();
    const verdict = door.RegisterJsonDocument.safeParse(document) as { success: boolean; error?: { issues: { path: unknown[]; message: string }[] } };
    const said = (verdict.error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
    expect(verdict.success, `\`RegisterJsonDocument\` accepts what \`registerJsonOf\` answers for the committed reading (AC-1) — it refused: ${said}`).toBe(true);
    expect(document["schemaVersion"], "the document states the schema version it was written under (AC-1)").toBe(door.REGISTER_JSON_SCHEMA_VERSION);
  });

  test("AC-1: the document carries the reading's tenant, project and campaign", async () => {
    const { view, document } = await exported();
    expect(document["tenantId"], "the document names the tenant the register was read for (AC-1)").toBe(view.tenantId);
    expect(document["projectId"], "the document names the project the register was read for (AC-1)").toBe(view.projectId);
    expect(document["campaign"], "the campaign is exported as `{ campaignId, setRevisionId }` — exactly the reading's (AC-1)").toEqual({
      campaignId: view.campaign?.campaignId,
      setRevisionId: view.campaign?.setRevisionId,
    });
  });

  test("AC-1: a reading with no campaign standing exports `campaign: null`, and the schema accepts it", async () => {
    const door = await registerJsonDoor();
    // Derived from the committed reading, never a second fixture: the same register, read where no
    // campaign stands (`ViewCampaign | null` — a project with none is a state, not a fault).
    const uncampaigned = { ...sampleView(), campaign: null };
    const document = asBag(door.registerJsonOf(uncampaigned), "what `registerJsonOf` answers for a reading with no campaign");
    expect(document["campaign"], "the document publishes `campaign: null` where the reading has no campaign — the half of the shape the criterion names (AC-1)").toBeNull();
    const verdict = door.RegisterJsonDocument.safeParse(document) as { success: boolean; error?: { issues: { path: unknown[]; message: string }[] } };
    const said = (verdict.error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");
    expect(verdict.success, `\`RegisterJsonDocument\` accepts a document read under no campaign — \`campaign\` is a pair OR null (AC-1) — it refused: ${said}`).toBe(true);
    expect(sortedKeys(document), "the top level is the same seven whether or not a campaign stands (AC-1)").toEqual(DOCUMENT_KEYS);
  });

  test("AC-1: the committed schema declares `campaign` as a pair or null", () => {
    const fixture = readCommittedJson(SCHEMA_FIXTURE, "this increment commits the schema of the shape it publishes (AC-2)") as SchemaNode;
    const campaign = (fixture["properties"] as SchemaNode | undefined)?.["campaign"];
    const branches = schemaBranches(campaign, fixture);
    expect(branches.length, `${SCHEMA_FIXTURE} declares \`campaign\` (AC-1)`).toBeGreaterThan(0);
    expect(typesOf(branches), `${SCHEMA_FIXTURE} declares \`campaign\` as accepting null — a register read under no campaign is a document this schema admits (AC-1)`).toContain("null");
    expect(
      branches.some((branch) => branch["properties"] !== undefined && typeof branch["properties"] === "object"),
      `${SCHEMA_FIXTURE} declares the campaign's own shape — \`{ campaignId, setRevisionId }\` (AC-1)`,
    ).toBe(true);
  });

  test("AC-1: every published line is exported, mirroring the reading field-for-field", async () => {
    const { view, document } = await exported();
    const lines = asBags(document["lines"], "the document's `lines`");
    expect(lines.length, "every published line of the reading is exported — no line is dropped, none invented (AC-1)").toBe(view.lines.length);
    lines.forEach((line, at) => {
      const read = view.lines[at] as unknown as Record<string, unknown>;
      // The roster is the READING's own, not a list frozen here: the document mirrors `ViewLine`.
      expect(sortedKeys(line), `the exported line ${at} carries the reading's line fields, no more and no fewer (AC-1)`).toEqual(sortedKeys(read));
      for (const field of LINE_FIELDS) {
        expect(Object.hasOwn(line, field), `the exported line ${at} carries \`${field}\` (AC-1)`).toBe(true);
      }
      expect(line, `the exported line ${at} says what the reading says — the export adds nothing and rewrites nothing (AC-1)`).toEqual(read);
    });
  });

  test("AC-1: a line's value is a decimal string or null, never a JSON number", async () => {
    const { document } = await exported();
    const lines = asBags(document["lines"], "the document's `lines`");
    for (const line of lines) {
      const value = line["value"];
      expect(
        value === null || typeof value === "string",
        `line ${String(line["lineId"])} publishes its figure at full precision as a string (or null where it carries none) — never a JSON number (AC-1)`,
      ).toBe(true);
    }
    const kept = lines.filter((line) => line["coverage"] !== "COMPLETE");
    expect(kept.length, "the committed reading exercises a line whose coverage is not COMPLETE (AC-1)").toBeGreaterThanOrEqual(1);
    for (const line of kept) {
      expect(line["value"], `line ${String(line["lineId"])} is kept with no quantity, so it publishes none — never a zero (AC-1)`).toBeNull();
    }
  });

  test("AC-1: every register object is exported, mirroring the reading field-for-field", async () => {
    const { view, document } = await exported();
    const objects = asBags(document["objects"], "the document's `objects`");
    expect(objects.length, "every object of the reading is exported (AC-1)").toBe(view.objects.length);
    objects.forEach((object, at) => {
      const read = view.objects[at] as unknown as Record<string, unknown>;
      expect(sortedKeys(object), `the exported object ${at} carries the reading's object fields, no more and no fewer (AC-1)`).toEqual(sortedKeys(read));
      for (const field of OBJECT_FIELDS) {
        expect(Object.hasOwn(object, field), `the exported object ${at} carries \`${field}\` (AC-1)`).toBe(true);
      }
      expect(object, `the exported object ${at} says what the reading says, its attributes and their readings whole (AC-1)`).toEqual(read);
    });
  });

  test("AC-1: every refusal is exported as its code, its object and its kind", async () => {
    const { view, document } = await exported();
    const refusals = asBags(document["refusals"], "the document's `refusals`");
    expect(refusals.length, "every sighting that produced no line is exported (AC-1)").toBe(view.refusals.length);
    refusals.forEach((refusal, at) => {
      expect(sortedKeys(refusal), `the exported refusal ${at} carries \`code\`, \`objectKey\` and \`kind\` and nothing else (AC-1)`).toEqual(REFUSAL_KEYS);
      expect(refusal, `the exported refusal ${at} says what the reading says (AC-1)`).toEqual(view.refusals[at]);
    });
  });

  test("AC-1: the document carries register content and nothing else — no level stacks, no timestamp", async () => {
    const { view, document } = await exported();
    expect(view.levelStacks.length, "the committed reading offers a level stack, so leaving it out is a choice this proves (AC-1)").toBeGreaterThanOrEqual(1);
    expect(sortedKeys(document), "the document's top level is exactly the seven the schema declares — a screen affordance and a timestamp are neither of them (AC-1)").toEqual(DOCUMENT_KEYS);
    expect(Object.hasOwn(document, "levelStacks"), "`levelStacks` is an offered-group affordance of the screen, not register content (AC-1)").toBe(false);
  });

  test("AC-1: the export is pure — the same reading answers the same document every time", async () => {
    const view = sampleView();
    const door = await registerJsonDoor();
    const first = door.registerJsonOf(view);
    const second = door.registerJsonOf(view);
    expect(second, "`registerJsonOf` reads no clock and mints no id: two exports of one reading are the same document (AC-1)").toEqual(first);
  });
});
