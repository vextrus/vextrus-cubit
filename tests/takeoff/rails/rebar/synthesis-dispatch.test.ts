/**
 * R6b — the bar synthesis is dispatched on the pair the campaign's edition pins (L-MEA-01, L-REG-07;
 * s-bbs I-658).
 *
 * `rcc.rebar.synthesis@1` and `@2` stand side by side, and which one writes a campaign's bars is the
 * campaign's edition's to say — never the tree's newest. So a campaign pinned before @2 writes the
 * bars it always wrote, byte for byte: the digest frozen below was taken over HEAD c72a3dd5's rows
 * for every column of F-RCC6-BNBC before this version existed.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REBAR_RAIL_MODULE, REPO_ROOT, SYNTHESIS_V2_PAIR, productModule, type BarRowShape, type MethodPairShape, type RailInputShape } from "./support/rebar-contract";
import { detailingLap50MixContested, modelColumnsInput } from "./support/column-ties";

/** The rail door's two readings this file grades. */
type RebarDoor = { barRowsOf: (input: RailInputShape) => BarRowShape[] };

/** The sha-256 of HEAD c72a3dd5's bar rows over every column of the model (frozen; see the header). */
const HEAD_ROWS_DIGEST = "2ba1e76b893455d058fd0d0ba6734ea7f002084bb0febb1c956b6862d344ba87";

/** The same, with the lap stated and nothing contested, so @1's laps are in the bytes too (frozen). */
const HEAD_ROWS_LAPPED_DIGEST = "a03ab4e7bcdf97c7b181119ede785595be484c476f9a272d5b2e0e3fd87c6163";

/** The rows as bytes: every field of every row, in the order the rail answered them. */
function digestOf(rows: readonly BarRowShape[]): string {
  return createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex");
}

/** The pairs a migration's minting row cites (the edition-drift guard's own reading of one). */
function citedPairs(source: string): MethodPairShape[] {
  return [...source.matchAll(/\{\s*"ruleId"\s*:\s*"([^"]+)"\s*,\s*"version"\s*:\s*"([^"]+)"\s*\}/gu)].map(([, ruleId, version]) => ({ ruleId: String(ruleId), version: String(version) }));
}

/** The migration that mints a platform version of IS1200_IN, found by the version it first names. */
function mintingSource(version: string): string {
  const dir = join(REPO_ROOT, "db", "migrations");
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const source = readFileSync(join(dir, file), "utf8");
    if (source.includes("ruleset_editions") && source.includes(`'IS1200_IN'`) && source.includes(`'${version}'`)) return source;
  }
  throw new Error(`no migration mints IS1200_IN ${version}`);
}

describe("R6b: the synthesis a campaign's bars are written by is its edition's pinned pair", () => {
  test("a campaign pinned to an edition citing synthesis@1 writes HEAD's bar rows byte for byte", async () => {
    const door = await productModule<RebarDoor>(REBAR_RAIL_MODULE);
    const pinned = citedPairs(mintingSource("2027.04"));
    expect(pinned.map((pair) => `${pair.ruleId}@${pair.version}`), "IS1200_IN 2027.04 cites synthesis@1").toContain("rcc.rebar.synthesis@1");
    const { input } = modelColumnsInput({ joints: "placed", methods: pinned, detailing: detailingLap50MixContested() });
    expect(digestOf(door.barRowsOf(input)), "synthesis@1 is unchanged: the 2027.04 campaign's rows are HEAD's (L-MEA-01)").toBe(HEAD_ROWS_DIGEST);
    // 2027.05 is the last edition citing @1 (OPEN-3); a campaign opened under it keeps HEAD's bars
    // after OPEN-4 mints the edition that selects @2 (L-REG-07).
    const last = citedPairs(mintingSource("2027.05"));
    expect(last.map((pair) => `${pair.ruleId}@${pair.version}`), "IS1200_IN 2027.05 cites synthesis@1").toContain("rcc.rebar.synthesis@1");
    expect(digestOf(door.barRowsOf(modelColumnsInput({ joints: "placed", methods: last, detailing: detailingLap50MixContested() }).input)), "the 2027.05 campaign's rows are HEAD's").toBe(HEAD_ROWS_DIGEST);
    const lapped = modelColumnsInput({ joints: "placed", methods: pinned, detailing: { ...detailingLap50MixContested(), suspended: [] } }).input;
    const rows = door.barRowsOf(lapped);
    expect(rows.some((row) => Number(row.lapsPerBar) > 0), "with nothing contested @1 laps the verticals, so the laps are in the bytes").toBe(true);
    expect(digestOf(rows), "synthesis@1's laps are HEAD's too").toBe(HEAD_ROWS_LAPPED_DIGEST);
  });

  test("campaigns pinned to 2026.08–.12 cite no synthesis pair, and write HEAD's rows — recorded: @1 is the floor", async () => {
    const door = await productModule<RebarDoor>(REBAR_RAIL_MODULE);
    for (const version of ["2026.08", "2026.09", "2026.10", "2026.11", "2026.12"]) {
      const pairs = citedPairs(mintingSource(version));
      expect(
        pairs.filter((pair) => pair.ruleId.startsWith("rcc.rebar.")),
        `IS1200_IN ${version} predates the rebar rail and cites no rebar pair — the gate publishes no rebar line under it`,
      ).toEqual([]);
      const { input } = modelColumnsInput({ joints: "placed", methods: pairs, detailing: detailingLap50MixContested() });
      expect(digestOf(door.barRowsOf(input)), `a ${version} campaign's bill of bars is the one @1 always wrote (s-bbs I-658)`).toBe(HEAD_ROWS_DIGEST);
    }
    // and a setup a proof builds by hand, with no edition methods at all, reads the same way
    const { input } = modelColumnsInput({ joints: "placed", detailing: detailingLap50MixContested() });
    expect(digestOf(door.barRowsOf(input))).toBe(HEAD_ROWS_DIGEST);
  });

  test("the edition that selects synthesis@2 derives the columns' ties and binds the stated lap; one citing a version nobody computes writes nothing", async () => {
    const door = await productModule<RebarDoor & { readMembers: (input: RailInputShape) => { reads: { bars: BarRowShape[] }[]; observations: { code: string }[] } }>(REBAR_RAIL_MODULE);
    // The platform edition OPEN-4 minted, read as its migration cites it — not 2027.05 edited by hand.
    const pinned = citedPairs(mintingSource("2027.06"));
    expect(
      pinned.filter((pair) => pair.ruleId === "rcc.rebar.synthesis"),
      "IS1200_IN 2027.06 cites the synthesis once, at @2 (I-653)",
    ).toEqual([SYNTHESIS_V2_PAIR]);
    const { input } = modelColumnsInput({ joints: "placed", methods: pinned, detailing: detailingLap50MixContested() });
    const rows = door.barRowsOf(input);
    expect(rows.filter((row) => row.role === "TIE").length, "@2 writes tie rows where @1 wrote none").toBeGreaterThan(150);
    expect(rows.filter((row) => row.role === "MAIN" && Number(row.lapsPerBar) > 0).length, "R2: the stated 50d laps the verticals although the mix is contested").toBeGreaterThan(150);

    const unknown = pinned.map((pair) => (pair.ruleId === "rcc.rebar.synthesis" ? { ruleId: pair.ruleId, version: "9" } : pair));
    const refused = door.readMembers(modelColumnsInput({ joints: "placed", methods: unknown, detailing: detailingLap50MixContested() }).input);
    expect(refused.reads, "no bar is written under a synthesis version the tree does not implement").toEqual([]);
    expect(new Set(refused.observations.map((one) => one.code)), "each member says so by the gate's own code").toEqual(new Set(["METHOD_IMPLEMENTATION_MISSING"]));
  });
});
