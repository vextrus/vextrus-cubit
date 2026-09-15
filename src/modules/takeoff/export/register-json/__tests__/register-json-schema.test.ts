/**
 * Public acceptance for A-REGISTER-JSON, AC-2: schema drift fails. The committed JSON Schema
 * fixture is the live Zod schema's own output, regenerated here in memory and compared — so a field
 * added, removed or retyped in `RegisterJsonDocument` without a deliberate re-baseline is red, and
 * the published shape cannot move under an integration's feet without someone saying so.
 *
 * The comparison is against what `z.toJSONSchema` answers today, not against a shape spelled here:
 * a lawful addition re-baselines the fixture, and this suite keeps passing.
 */
import { z } from "zod";
import { describe, expect, test } from "vitest";
import { BASELINE_DUTY, readCommittedJson, registerJsonDoor, SCHEMA_FIXTURE } from "./support/register-json-stage";

/** What a missing fixture is owed, quoted where it is missing. */
const OWED = `this increment commits \`z.toJSONSchema(RegisterJsonDocument)\` here so drift is visible (AC-2); ${BASELINE_DUTY}`;

/** A JSON-Schema node, as far as this suite reads one. */
type Node = Record<string, unknown>;

/** The committed fixture, parsed. */
function committed(): Node {
  return readCommittedJson(SCHEMA_FIXTURE, OWED) as Node;
}

/** The schema the module declares today, as JSON Schema. */
async function live(): Promise<Node> {
  const door = await registerJsonDoor();
  return z.toJSONSchema(door.RegisterJsonDocument) as unknown as Node;
}

/** One step into a node, with a message when the shape the criterion names is not there. */
function at(node: Node, path: readonly string[]): Node {
  let here: Node = node;
  for (const step of path.slice(0, -1)) {
    const next = here[step];
    expect(next !== null && typeof next === "object", `${SCHEMA_FIXTURE} declares \`${path.join(".")}\` (AC-2)`).toBe(true);
    here = next as Node;
  }
  const last = path[path.length - 1] as string;
  const leaf = here[last];
  expect(leaf !== null && typeof leaf === "object", `${SCHEMA_FIXTURE} declares \`${path.join(".")}\` (AC-2)`).toBe(true);
  return leaf as Node;
}

/** Every node of the schema that declares named properties — every object level, however deep. */
function objectLevels(node: unknown, path: string, found: { path: string; node: Node }[] = []): { path: string; node: Node }[] {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => objectLevels(entry, `${path}[${index}]`, found));
    return found;
  }
  if (node === null || typeof node !== "object") return found;
  const here = node as Node;
  if (here["properties"] !== undefined && here["properties"] !== null && typeof here["properties"] === "object") found.push({ path, node: here });
  for (const [key, value] of Object.entries(here)) objectLevels(value, path === "" ? key : `${path}.${key}`, found);
  return found;
}

describe("AC-2: the published shape cannot drift without a deliberate re-baseline", () => {
  test("AC-2: the committed JSON Schema is what the live Zod schema answers today", async () => {
    const fixture = committed();
    expect(fixture, `${SCHEMA_FIXTURE} is no longer \`z.toJSONSchema(RegisterJsonDocument)\` — the published shape moved. If the move is deliberate, ${BASELINE_DUTY}`).toEqual(await live());
  });

  test("AC-2: the committed schema pins the version as a constant", async () => {
    const door = await registerJsonDoor();
    expect(at(committed(), ["properties", "schemaVersion"])["const"], `${SCHEMA_FIXTURE} declares \`schemaVersion\` as the constant the module publishes (AC-2)`).toBe(
      door.REGISTER_JSON_SCHEMA_VERSION,
    );
    expect(at(committed(), ["properties", "schemaVersion"])["const"], `the committed shape is version "1.0" (AC-2)`).toBe("1.0");
  });

  test("AC-2: the document, its objects, its lines and its refusals are closed — an added field is visible", () => {
    const fixture = committed();
    const levels: Record<string, readonly string[]> = {
      document: [],
      "objects[]": ["properties", "objects", "items"],
      "lines[]": ["properties", "lines", "items"],
      "refusals[]": ["properties", "refusals", "items"],
    };
    for (const [name, path] of Object.entries(levels)) {
      const node = path.length === 0 ? fixture : at(fixture, path);
      expect(node["additionalProperties"], `the ${name} level declares \`additionalProperties: false\` — it is a strict object, so a field added to it shows up here (AC-2)`).toBe(false);
    }
    // The rule, not those four: every level that names properties is closed, however deep the
    // document grows — an attribute, a competing reading, a variable's canonical figure.
    for (const level of objectLevels(fixture, "")) {
      expect(level.node["additionalProperties"], `the object level at \`${level.path}\` declares \`additionalProperties: false\` (AC-2)`).toBe(false);
    }
  });

  test("AC-2: the fixture discriminates — a field added, removed or retyped no longer matches", async () => {
    const schema = await live();
    const properties = at(committed(), ["properties"]);
    const scalar = Object.keys(properties).find((key) => (properties[key] as Node)["type"] === "string") ?? "";
    expect(scalar, `${SCHEMA_FIXTURE} declares a string property of the document to mutate (AC-2)`).not.toBe("");

    const added = structuredClone(committed());
    at(added, ["properties"])["exportedAt"] = { type: "string" };
    expect(added, "a field ADDED to the document is drift the committed fixture refuses (AC-2)").not.toEqual(schema);

    const removed = structuredClone(committed());
    delete at(removed, ["properties"])[scalar];
    expect(removed, "a field REMOVED from the document is drift the committed fixture refuses (AC-2)").not.toEqual(schema);

    const retyped = structuredClone(committed());
    at(retyped, ["properties", scalar])["type"] = "number";
    expect(retyped, "a field RETYPED is drift the committed fixture refuses (AC-2)").not.toEqual(schema);
  });
});
