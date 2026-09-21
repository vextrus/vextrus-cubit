// @vitest-environment jsdom
/**
 * A CAMPAIGN WITH OBJECTS AND NO LINES IS UNMEASURED, NOT FILTERED (R-UI-020, R-UI-050,
 * docs/design/s-takeoff.md §2).
 *
 * WHY. The register's lines grid had two empties: "nothing registered" (no objects) and "no line
 * matches these filters" (zero lines after narrowing). A campaign whose objects stand — the pin just
 * registered 653 of them — and whose Measure door nobody has pressed yet fell into the second,
 * with no filter set: the screen told a reader who had narrowed nothing to "clear a filter to see the
 * rest" (found 2026-09-21 by the session-3 probe on J-000's golden run). An empty cell says WHY it is
 * empty (R-UI-020), and this one had the wrong why. The cell now reads "not measured yet" and names
 * the Measure door; the filter copy is kept for the case it was written for.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { copy, levelStackFixture, mountRegister, takeoffStrings, text } from "./support/fixtures";

afterEach(() => {
  cleanup();
});

describe("the lines grid's empty cell says why it is empty", () => {
  test("objects registered, nothing measured, no filter set: the cell names the Measure door, never a filter", async () => {
    const strings = await takeoffStrings();
    const view = { ...levelStackFixture(), lines: [] };
    expect(view.objects.length, "the fixture registers objects").toBeGreaterThan(0);
    const root = await mountRegister(view);
    const said = text(root).replace(/\s+/g, " ");
    expect(said, "the cell says the campaign has not been measured").toContain(copy(strings, "takeoff_register_lines_unmeasured_heading"));
    expect(said, "and names the door that measures it").toContain(copy(strings, "takeoff_register_lines_unmeasured_body"));
    expect(said, "and never blames a filter nobody set").not.toContain(copy(strings, "takeoff_register_lines_none"));
  });

  test("objects registered and lines published: no empty cell stands at all", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister(levelStackFixture());
    const said = text(root).replace(/\s+/g, " ");
    expect(said).not.toContain(copy(strings, "takeoff_register_lines_unmeasured_heading"));
    expect(said).not.toContain(copy(strings, "takeoff_register_lines_none"));
  });
});
