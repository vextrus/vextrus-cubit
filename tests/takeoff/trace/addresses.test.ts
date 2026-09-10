/**
 * AC-2's address half — `traceAddress` and `originAddress` spell the two routes the test contract
 * fixes, and `citedKeysOf` states which keys a line cites (R-UI-022, s-takeoff-register I-179/I-180).
 *
 * Pure: no store is opened. Every expectation is recomputed from the line it is asked about, so a
 * line given other keys, another sheet or another layout is addressed by the same rule.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { citedKeysSpelling, originAddressSpelling, traceAddressSpelling, traceSeam } from "./support/trace-stage";

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
  return { ...line, sourceKeys: over["sourceKeys"] ?? citedKeysSpelling(line as never) };
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
