/**
 * AC-2 — the six frame methods, in force (R-TO-032, L-MEA-01, L-MEA-09, L-FRM-02/03, L-QTY-03).
 *
 * A method is the sentence a figure is audited by: the variables it declares, in the order its
 * template names them, and the one evaluation both the value and the printed formula come from. This
 * grades the six this leaf lands through the registry the gate resolves them by — never by reading
 * the modules that implement them — and grades their arithmetic against L-MEA-09's own statement of
 * it, computed in the canon rather than transcribed.
 *
 * The re-minted platform edition's live row (the migration in 0036's shape) is graded beside the
 * column method's, in tests/rulesets/column-method-edition.test.ts, which compares the edition the
 * cluster holds to `enumerateMethods()` over the re-baselined `SEED_VERSION` — one home for that
 * claim, not two (ARCH-02).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  AREA,
  BEAM_CONCRETE_RULE_ID,
  BEAM_FORMWORK_RULE_ID,
  COUNT_DIMENSION,
  FRAME_METHOD_DIR,
  FRAME_PAIRS,
  FRAME_SHARD,
  LENGTH,
  LINTEL_CONCRETE_RULE_ID,
  LINTEL_FORMWORK_RULE_ID,
  METHOD_HASHES_SCRIPT,
  PIECES,
  REPO_ROOT,
  SEED_MODULE,
  TIE_BEAM_CONCRETE_RULE_ID,
  TIE_BEAM_FORMWORK_RULE_ID,
  VOLUME,
  canon,
  frameMethod,
  methodsRegistry,
  productModule,
  type Decimal,
  type MethodPairShape,
} from "../takeoff/rails/support/frame-rail-stage";

/** The law every one of the six is recorded under (AC-2). */
const FRAME_LAW = "L-MEA-09";

/**
 * The version the platform edition is re-minted at (AC-2), re-baselined by the SLABS leaf: an
 * edition is immutable, so its twelve new methods are minted at the next version beside 2027.01
 * rather than over it (B-20). The claim graded here is the frame's six pairs, which the re-minted
 * edition cites exactly as the edition before it did.
 */
const SEED_VERSION = "2027.02";

/** The role a method that prints a formula and computes a figure stands in (L-MEA-01). */
const FORMULA_ROLE = "formula";

/** The canonical unit each dimension's binding is evaluated in (L-FRM-06). */
const METRES = "m";

/**
 * The variables each rule declares, in the order its template names them, and the dimension the
 * method stands in — the criterion's own statement of the six methods (AC-2).
 */
const DECLARED: readonly { ruleId: string; dimension: string; variables: readonly string[] }[] = Object.freeze([
  { ruleId: BEAM_CONCRETE_RULE_ID, dimension: VOLUME, variables: ["count", "b", "D", "t", "clear"] },
  { ruleId: BEAM_FORMWORK_RULE_ID, dimension: AREA, variables: ["count", "b", "D", "t_left", "t_right", "clear"] },
  { ruleId: TIE_BEAM_CONCRETE_RULE_ID, dimension: VOLUME, variables: ["count", "b", "D", "clear"] },
  { ruleId: TIE_BEAM_FORMWORK_RULE_ID, dimension: AREA, variables: ["count", "b", "D", "clear"] },
  { ruleId: LINTEL_CONCRETE_RULE_ID, dimension: VOLUME, variables: ["count", "b", "D", "w", "bearing"] },
  { ruleId: LINTEL_FORMWORK_RULE_ID, dimension: AREA, variables: ["count", "b", "D", "w", "bearing"] },
]);

/** The canonical readings AC-2 evaluates the six over, in metres and pieces. */
const BEAM_BINDINGS = Object.freeze({ count: "1", b: "0.25", D: "0.45", t: "0.15", t_left: "0", t_right: "0.15", clear: "4.2" });
const LINTEL_BINDINGS = Object.freeze({ count: "3", b: "0.25", D: "0.15", w: "1.2", bearing: "0.15" });

/** One binding as a method is handed one: a value in the canonical unit of its dimension. */
function carried(values: Readonly<Record<string, string>>, variables: readonly string[]): Record<string, { value: string; unit: string }> {
  return Object.fromEntries(variables.map((name) => [name, { value: values[name] as string, unit: name === "count" ? PIECES : METRES }]));
}

/** L-MEA-09's own arithmetic, computed in the canon over the same readings (B-19: never typed). */
async function owedFor(ruleId: string): Promise<Decimal> {
  const { exact } = await canon();
  const beam = (name: keyof typeof BEAM_BINDINGS): Decimal => exact(BEAM_BINDINGS[name]);
  const lint = (name: keyof typeof LINTEL_BINDINGS): Decimal => exact(LINTEL_BINDINGS[name]);
  const two = exact("2");
  const minus = (left: Decimal, right: Decimal): Decimal => exact(left.toString()).add(exact(`-${right.toString()}`));
  const opening = (): Decimal => lint("w").add(two.mul(lint("bearing")));
  switch (ruleId) {
    // count · b · (D − t) · clear: the beam owns its depth below the thicker adjoining soffit.
    case BEAM_CONCRETE_RULE_ID:
      return beam("count").mul(beam("b")).mul(minus(beam("D"), beam("t"))).mul(beam("clear"));
    // count · ((D − t_left) + (D − t_right) + b) · clear: two sides and a soffit, each side its own.
    case BEAM_FORMWORK_RULE_ID:
      return beam("count")
        .mul(minus(beam("D"), beam("t_left")).add(minus(beam("D"), beam("t_right"))).add(beam("b")))
        .mul(beam("clear"));
    // count · b · D · clear: a tie beam adjoins no slab, so nothing is taken off its depth.
    case TIE_BEAM_CONCRETE_RULE_ID:
      return beam("count").mul(beam("b")).mul(beam("D")).mul(beam("clear"));
    // count · (2·D + b) · clear.
    case TIE_BEAM_FORMWORK_RULE_ID:
      return beam("count").mul(two.mul(beam("D")).add(beam("b"))).mul(beam("clear"));
    // count · b · D · (w + 2·bearing): a lintel spans its opening plus a bearing at each end.
    case LINTEL_CONCRETE_RULE_ID:
      return lint("count").mul(lint("b")).mul(lint("D")).mul(opening());
    // count · (2·D + b) · (w + 2·bearing).
    default:
      return lint("count").mul(two.mul(lint("D")).add(lint("b"))).mul(opening());
  }
}

/**
 * The shard, as the registry records a method in one: `methods` is an OBJECT keyed
 * `<ruleId>@<version>` — the key a method is resolved by (L-MEA-01) — whose rows restate the pair
 * beside the clause it measures by and the module that computes it. Every shard in this tree is
 * spelled that way, and both readers of one (the registry's areas, `scripts/method-hashes.mjs`)
 * read that shape; a list is a second spelling of the same manifest, which is a defect (AM-11).
 */
type ShardRow = { ruleId?: string; version?: string; law?: string; module?: string };
type Shard = { methods?: unknown; digest?: unknown };

describe("AC-2: the six frame methods are in force", () => {
  test("AC-2: the shards enumerate the six pairs this leaf lands", async () => {
    const registry = await methodsRegistry();
    const enumerated = registry.enumerateMethods().map((pair: MethodPairShape) => `${pair.ruleId}@${pair.version}`);

    for (const held of FRAME_PAIRS) {
      expect(enumerated, `\`enumerateMethods()\` answers ${held.pair.ruleId}@${held.pair.version} — a method not enumerated is a method no edition can cite (L-MEA-01)`).toContain(
        `${held.pair.ruleId}@${held.pair.version}`,
      );
    }
    expect(new Set(enumerated).size, "and answers each pair once — the barrel enumerates its shards and never re-declares one (AM-11)").toBe(enumerated.length);
  });

  test("AC-2: each is a formula method declaring its variables in the order its template names them", async () => {
    for (const declared of DECLARED) {
      const held = FRAME_PAIRS.find((pair) => pair.pair.ruleId === declared.ruleId) as (typeof FRAME_PAIRS)[number];
      const method = await frameMethod(held.pair);

      expect(method.role, `${declared.ruleId} prints a formula and computes a figure — it is a formula method, not a resolver (L-MEA-01)`).toBe(FORMULA_ROLE);
      expect(method.kind, `${declared.ruleId} measures the kind its rail offers under (L-MEA-08)`).toBe(held.kind);
      expect(method.dimension, `${declared.ruleId} stands in the dimension its kind is catalogued in (L-FRM-06)`).toBe(declared.dimension);
      expect(
        method.variables.map((variable) => variable.name),
        `${declared.ruleId} declares exactly the readings L-MEA-09 measures it from, in order (AC-2)`,
      ).toEqual([...declared.variables]);
      expect(
        method.variables.map((variable) => variable.dimension),
        `a count is a COUNT and every other reading a LENGTH — nothing is declared in the dimension of the answer (${declared.ruleId})`,
      ).toEqual(declared.variables.map((name) => (name === "count" ? COUNT_DIMENSION : LENGTH)));
      expect([...method.deductionChannels], `${declared.ruleId} nets nothing: a junction is owned, never deducted (L-MEA-09)`).toEqual([]);
      expect(typeof method.template, `${declared.ruleId} carries the template a line's formula is rendered from (L-QTY-03)`).toBe("string");
    }
  });

  test("AC-2: each evaluates to L-MEA-09's own arithmetic over canonical readings, and every one of them counts its instances", async () => {
    const { exact } = await canon();
    const two = exact("2");

    for (const declared of DECLARED) {
      const held = FRAME_PAIRS.find((pair) => pair.pair.ruleId === declared.ruleId) as (typeof FRAME_PAIRS)[number];
      const method = await frameMethod(held.pair);
      const readings: Readonly<Record<string, string>> = declared.ruleId.includes(".lintel.") ? LINTEL_BINDINGS : BEAM_BINDINGS;
      const bindings = carried(readings, declared.variables);
      const owed = await owedFor(declared.ruleId);
      const answered = method.evaluate(bindings);

      expect(
        exact(answered).eq(owed),
        `${declared.ruleId} over ${JSON.stringify(bindings)} is ${owed.toString()} — the law's own arithmetic, computed in the canon: it answered ${answered}`,
      ).toBe(true);

      // `count` multiplies the whole of every one of the six (L-FRM-02/03), so the same readings at
      // twice the instances measure twice the work. Graded on each method rather than inferred from
      // the one whose canonical reading counts more than one: a method that declares `count` and
      // never multiplies by it answers the owed figure for a batch of one and understates every
      // other batch — and F-RCC6, which stands one instance to a placement, can never catch it.
      const twiceCount = exact(readings["count"] as string).mul(two).toString();
      const twice = method.evaluate(carried({ ...readings, count: twiceCount }, declared.variables));

      expect(
        exact(twice).eq(exact(answered).mul(two)),
        `${declared.ruleId} at count ${twiceCount} over otherwise identical readings is twice its figure at count ${String(readings["count"])} — it answered ${twice} beside ${answered}`,
      ).toBe(true);
    }
  });

  test("AC-2: the six are recorded in the frame shard under L-MEA-09, and the hash stage accepts it", async () => {
    // white-box: AC-2 — the shard IS the artefact the criterion names ("recorded in
    // src/core/rulesets/methods/frame/frame.methods.json with `law` L-MEA-09 and a `module` under
    // src/core/rulesets/methods/frame/"). What is asserted is a property of that manifest's own
    // text, which no behaviour of the product exposes; the methods it records are graded above
    // through the registry.
    const at = join(REPO_ROOT, FRAME_SHARD);
    expect(existsSync(at), `${FRAME_SHARD} is the manifest this area's methods are recorded in — the product does not provide it yet`).toBe(true);
    const shard = JSON.parse(readFileSync(at, "utf8")) as Shard;
    expect(
      Array.isArray(shard.methods),
      `${FRAME_SHARD} records its methods as an object keyed \`<ruleId>@<version>\`, as every shard in this tree is spelled and as both readers of one read it — a list is a second spelling of the same manifest (AM-11)`,
    ).toBe(false);
    expect(shard.methods !== null && typeof shard.methods === "object", `${FRAME_SHARD} records the methods of this area under \`methods\` — a manifest with no roster arms nothing`).toBe(true);
    const recorded = Object.entries(shard.methods as Record<string, ShardRow>);
    expect(recorded.length, `${FRAME_SHARD} records the methods of this area — a manifest with no rows arms nothing`).toBeGreaterThan(0);

    for (const [key, row] of recorded) {
      expect(
        key,
        `every row of ${FRAME_SHARD} is keyed by the pair it records, and restates that pair in the row — the key a method is resolved by (L-MEA-01)`,
      ).toBe(`${String(row?.ruleId)}@${String(row?.version)}`);
    }

    const byKey = Object.fromEntries(recorded) as Record<string, ShardRow | undefined>;
    for (const held of FRAME_PAIRS) {
      const key = `${held.pair.ruleId}@${held.pair.version}`;
      const row = byKey[key];
      expect(row, `${FRAME_SHARD} records ${key} under exactly that key — the shard the registry's frame area puts in force (AM-11)`).toBeTruthy();
      expect(row?.law, `and records it under the clause it measures by (${key})`).toBe(FRAME_LAW);
      expect(String(row?.module), `and names a module under ${FRAME_METHOD_DIR} (${key})`).toContain(FRAME_METHOD_DIR);
    }

    const answered = execFileSync("node", [METHOD_HASHES_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    expect(typeof answered, `${METHOD_HASHES_SCRIPT} is green over every shard's digest — a shard whose digest has moved is a method roster nobody re-hashed`).toBe("string");
  });

  test("AC-2: the platform seed is re-minted, and cites every method the shards enumerate", async () => {
    const registry = await methodsRegistry();
    const seed = await productModule<{ SEED_EDITION_IDENTITY: { scope: string; name: string; version: string }; SEED_EDITION_CONTENT: { methods: readonly MethodPairShape[] } }>(SEED_MODULE);

    expect(seed.SEED_EDITION_IDENTITY.version, "the platform edition is re-minted at the head of the lineage, so the seed and every fork of it cite the six (L-REG-07, B-20)").toBe(SEED_VERSION);
    expect(
      [...seed.SEED_EDITION_CONTENT.methods],
      "the edition cites every method in force — the shards' own roster, so a method landed with its manifest is cited without a second list being edited (B-19)",
    ).toEqual([...registry.enumerateMethods()]);
  });
});
