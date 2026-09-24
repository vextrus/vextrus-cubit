// @vitest-environment jsdom
/**
 * I-558 — a storey-height reading is the Trace to the words it was read from (docs/design/s-levels.md,
 * R-UI-022, evidence-link I-555).
 *
 * A level with two readings — one transcribed off a section's mark whose key the server placed on a
 * sheet, one a person entered, which cites nothing — is mounted with the shipped chrome. What a QS
 * meets is judged: the transcribed reading's key is a link to that sheet, coloured by the reading's
 * own basis; the entered reading has no source and no link; and a key the server could not place
 * keeps its words and offers no link.
 */
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS as TESTIDS_REGISTRY, testIdSelector } from "../../../src/ui/testids";
import { ENTERED, TESTID, TRANSCRIBED, attr, cleanup, fireEvent, hook, hooks, levelFixture, mountLevels, viewFixture } from "./support/levels-ui-view";

afterEach(() => {
  cleanup();
});

const PLACED = "DXF_HANDLE:7C";
const UNPLACED = "DXF_HANDLE:7D";
const HREF = "/t/tenant-1/p/project-1/viewer/drawing-1/S-25?s=DXF_HANDLE:7C";

describe("I-558: a reading reveals the words it was read from", () => {
  test("a placed source key links the viewer at its sheet in the reading's basis; an entered reading and an unplaced key do not", async () => {
    const level = await levelFixture({
      label: "GF",
      ordinal: 0,
      readings: [
        { basis: TRANSCRIBED, sourceKey: PLACED, value: "3048", unit: "mm" },
        { basis: TRANSCRIBED, sourceKey: UNPLACED, value: "3048", unit: "mm" },
        { basis: ENTERED, value: "3.048", unit: "m" },
      ],
    });
    const readings = level.readings.map((reading) => ({ ...reading, sourceHref: reading.sourceKey === PLACED ? HREF : null }));
    const mounted = await mountLevels({ view: viewFixture({ stack: [{ ...level, readings }] }) });

    const row = hooks(hook(mounted.root, TESTID.grid), TESTID.row).find((candidate) => attr(candidate, "data-level") === level.levelId) as HTMLElement;
    fireEvent.click(row);
    const shown = hooks(hook(mounted.container, TESTID.inspector), TESTID.reading);
    expect(shown, "one element per reading").toHaveLength(3);

    const [placed, unplaced, entered] = shown as [HTMLElement, HTMLElement, HTMLElement];
    const links = [...placed.querySelectorAll<HTMLAnchorElement>(testIdSelector(TESTIDS_REGISTRY.evidence.link))];
    expect(links, "the placed reading carries exactly one Trace").toHaveLength(1);
    const link = links[0] as HTMLAnchorElement;
    expect(link.getAttribute("href"), "to the address the server composed, verbatim").toBe(HREF);
    expect(link.getAttribute("data-basis"), "coloured by the reading's own basis — a height is a figure read on one").toBe(TRANSCRIBED);
    expect(link.textContent ?? "", "reading as the key, whole").toContain(PLACED);

    expect(unplaced.querySelector("a"), "a key the server could not place offers no link (I-181)").toBeNull();
    expect(unplaced.textContent ?? "", "and keeps its words").toContain(UNPLACED);
    expect(entered.querySelector("a"), "an entered height cites nothing, so nothing links").toBeNull();
  });
});
