/**
 * AC-2's address half — `traceAddress` and `originAddress` spell the two routes the test contract
 * fixes, and `citedKeysOf` states which keys a line cites (R-UI-022, s-takeoff-register I-179/I-180).
 *
 * Pure: no store is opened. Every expectation is recomputed from the line it is asked about, so a
 * line given other keys, another sheet or another layout is addressed by the same rule.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { parseSelection, splitSelection } from "../../../src/modules/takeoff/viewer-inspector/selection";
import { citedKeysSpelling, originAddressSpelling, selectionKeysSpelling, traceAddressSpelling, traceSeam } from "./support/trace-stage";

/** One published line, as the register's reading answers one — the shape the address is composed from. */
function aLine(over: Record<string, unknown> = {}): Record<string, unknown> {
  const sourceKey = "DXF_HANDLE:1A4";
  const variables = {
    length: { value: "0.3", unit: "m", basis: "MEASURED", source: "DXF_HANDLE:1A4" },
    breadth: { value: "0.45", unit: "m", basis: "MEASURED", source: "DXF_HANDLE:2B7" },
    height: { value: "3", unit: "m", basis: "TRANSCRIBED", source: "DXF_HANDLE:2B7" },
  };
  const line: Record<string, unknown> = {
    lineId: "b1d6f0aa-0000-4000-8000-000000000001",
    objectKey: "PLAN|S-101:t:12|C1|GF",
    kind: "rcc.concrete",
    value: "0.405",
    unit: "m3",
    drawingId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    layoutName: "S-101 Plan",
    formula: "length × breadth × height",
    variables,
    quantityBasis: "MEASURED",
    selectionBasis: "MEASURED",
    sourceKey,
    calibrationKeys: ["S-101:PLAN:scale"],
    ...over,
  };
  // The register carries two lists (I-426): every key the line cites, and what its Trace selects.
  // A line stated with no selection of its own selects what it cites.
  const cited = citedKeysSpelling(line as never);
  return { ...line, sourceKeys: over["sourceKeys"] ?? cited, traceKeys: over["traceKeys"] ?? cited };
}

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("AC-2: the addresses", () => {
  test("AC-2: `LINE_PARAM` is the query the origin is carried under", async () => {
    const { LINE_PARAM } = await traceSeam();
    expect(LINE_PARAM, "the origin parameter is `line` (test contract)").toBe("line");
  });

  test("AC-2: `traceAddress` spells the viewer route with the cited keys and the origin line, and no `v`", async () => {
    const { traceAddress, LINE_PARAM } = await traceSeam();

    for (const line of [aLine(), aLine({ layoutName: "Model", sourceKey: "DXF_HANDLE:FF" }), aLine({ layoutName: "A1 / Sheet 2", sourceKey: "DXF_HANDLE:0", variables: {} })]) {
      const said = traceAddress(TENANT, PROJECT, line);
      expect(said, `the address is composed from the line it is given: ${JSON.stringify(line["layoutName"])}`).toBe(
        traceAddressSpelling(TENANT, PROJECT, line as never, LINE_PARAM),
      );
      expect(/[?&]v=/.test(said), "no `v` parameter — its absence is what makes the viewer fly (I-85)").toBe(false);
      expect(said.startsWith(`/t/${TENANT}/p/${PROJECT}/viewer/`), "the address is the viewer's, under this tenant and project").toBe(true);
    }
  });

  /*
   * Walk-0 (BLOCKS_DEMO): a pile's placement key `…|P1|599250.0,0.0` reached the viewer as TWO keys,
   * `…|P1|599250.0` and `0.0`, because the address joined keys with the very comma a placement key
   * carries between its coordinates. Every key form a rail publishes is round-tripped here, through
   * the browser's own reading of the query (`URL`), back to the keys the line named (I-423).
   */
  test("VD-1: the selection is lossless — every key form a rail cites comes back whole", async () => {
    const { traceAddress } = await traceSeam();
    const published = [
      "v:LAYOUT_PLAN:DXF_HANDLE:1FEB|P1|599250.0,0.0",
      "v:LAYOUT_PLAN:DXF_HANDLE:20B6|C3|1200000.0,-395123.2@34f04e73-687a-4006-8fa5-12f7352f0ed9#bars",
      "v:LAYOUT_PLAN:DXF_HANDLE:20B6",
      "edition:b43500d12e5ec01b68d2139aa35089d385323c616f2979aaabd3df91d8c61a35#blinding",
      "act:3d02536e-637f-406d-801a-ff047d121a5a",
      "DXF_HANDLE:99C",
      "PDF_OBJECT:12,0",
      "a key with 100% and a comma, both",
    ];
    const said = traceAddress(TENANT, PROJECT, aLine({ traceKeys: published }));
    const value = new URL(said, "http://cubit.test").searchParams.get("s") ?? "";

    expect(splitSelection(value), "the viewer reads back exactly the keys the address was composed from, in order, each whole").toEqual(published);
    expect(selectionKeysSpelling(value), "and so does the contract's own reading of the value").toEqual(published);
    expect(splitSelection(value).length, "a placement key's `x,y` is one key, not two (walk-0)").toBe(published.length);

    const parsed = parseSelection(value);
    expect(parsed.keys, "the entities it names are the source keys of EVERY registered scheme, not only DXF handles").toEqual(["DXF_HANDLE:99C", "PDF_OBJECT:12,0"]);
    expect(parsed.malformed, "and what names no entity is reported whole, never cut at a comma").toEqual(published.filter((key) => !key.startsWith("DXF_HANDLE:") && !key.startsWith("PDF_OBJECT:")));
  });

  /*
   * The register's reading carries what a line CITES (`sourceKeys`, the JSON export's 1.0 field) and
   * what its Trace SELECTS (`traceKeys`) apart, because for a line measured off a placement they share
   * no key (I-421, I-426). The address is composed from the selection alone; a line that states
   * none is addressed at the keys it cites, read off its own key and bindings — never off a
   * `sourceKeys` list, whose meaning is the export's.
   */
  test("VD-1: the address carries the Trace's selection, never the list of cited keys", async () => {
    const { traceAddress, LINE_PARAM } = await traceSeam();
    const member = ["DXF_HANDLE:98B", "DXF_HANDLE:9A5"];
    const placed = aLine({ traceKeys: member });
    const said = traceAddress(TENANT, PROJECT, placed);

    expect(said, "the address the contract spells over the selection").toBe(traceAddressSpelling(TENANT, PROJECT, placed as never, LINE_PARAM));
    expect(splitSelection(new URL(said, "http://cubit.test").searchParams.get("s") ?? ""), "exactly the member, none of the keys the line cites").toEqual(member);

    const unselected = aLine({ sourceKeys: ["DXF_HANDLE:DEAD"] });
    delete unselected["traceKeys"];
    const fallback = traceAddress(TENANT, PROJECT, unselected);
    expect(
      splitSelection(new URL(fallback, "http://cubit.test").searchParams.get("s") ?? ""),
      "a line that states no selection is addressed at what it cites — its key, then each binding — whatever list rides beside it",
    ).toEqual(citedKeysSpelling(unselected as never));
  });

  test("VD-1: a selection of handles reads exactly as it always did", () => {
    expect(parseSelection("DXF_HANDLE:1A, DXF_HANDLE:2B,,DXF_HANDLE:1A"), "handles carry neither escape, so an address written before the escape still reads").toEqual({
      keys: ["DXF_HANDLE:1A", "DXF_HANDLE:2B"],
      malformed: [],
    });
  });

  test("AC-2: `originAddress` spells the register route, with the origin line and without it", async () => {
    const { originAddress, LINE_PARAM } = await traceSeam();
    const lineId = randomUUID();

    expect(originAddress(TENANT, PROJECT, lineId), "the register's address plus `?line={lineId}` (test contract)").toBe(originAddressSpelling(TENANT, PROJECT, lineId, LINE_PARAM));
    expect(originAddress(TENANT, PROJECT, null), "and the bare register path, which is `registerRoute`'s one home (Decision §1)").toBe(originAddressSpelling(TENANT, PROJECT, null, LINE_PARAM));
  });
});

describe("AC-2: the keys a line cites", () => {
  test("AC-2: `citedKeysOf` is the line's own key then each binding's source, first occurrence winning", async () => {
    const { citedKeysOf } = await traceSeam();

    const line = aLine();
    expect(citedKeysOf(line), "the sourceKey leads, then the bindings in binding order, duplicates collapsed").toEqual(citedKeysSpelling(line as never));

    const alone = aLine({ variables: {} });
    expect(citedKeysOf(alone), "a line with no bindings cites its own key alone").toEqual([alone["sourceKey"]]);

    const echo = aLine({ variables: { a: { value: "1", unit: "m", basis: "MEASURED", source: "DXF_HANDLE:1A4" } } });
    expect(citedKeysOf(echo), "a binding read at the line's own key adds nothing: the collapse is by first occurrence").toEqual(["DXF_HANDLE:1A4"]);
  });

  test("AC-2: a calibration key is not an entity and is never cited (risk note 2)", async () => {
    const { citedKeysOf } = await traceSeam();
    const calibration = "S-101:PLAN:scale";
    const line = aLine({ calibrationKeys: [calibration] });
    expect(citedKeysOf(line), "the calibration the view was scaled by is not one of the entities the Trace flies to").not.toContain(calibration);
  });
});
