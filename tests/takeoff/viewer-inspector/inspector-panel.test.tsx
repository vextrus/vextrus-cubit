// @vitest-environment jsdom
/**
 * AC-1's panel half, AC-3's copy half and AC-4's partial cell — `InspectorPanel` mounted over a
 * supplied hover, selection and missing-key list, which is the surface the increment's interface
 * list publishes for exactly this (test contract: the jsdom mount). It takes `window.location` and
 * never a router, so it mounts bare.
 *
 * What is judged is what a reader meets: the ids the Design Decision closes (§7), the `data-` hooks
 * it names, and the copy the registry carries — every string compared against
 * `src/ui/strings`'s own table rather than against a sentence typed here, so copy has one home
 * (R-SPINE-060, B-19). Nothing here reads product source.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { syntheticKey } from "../viewer/support/synthetic-graph";
import {
  INSPECTOR_PANEL_MODULE,
  bboxAttribute,
  fillSlots,
  productModule,
  registered,
  stringTable,
  type IndexBox,
} from "./support/inspector-support";

/** The copy this region owns, as docs/design/s-viewer-inspector.md §3 fixes it verbatim (C-05). */
const COPY: Readonly<Record<string, string>> = {
  viewer_inspector_heading: "Inspector",
  viewer_inspector_idle_heading: "Nothing selected",
  viewer_inspector_idle_body: "Hover an entity to read it. Click to select; Shift and drag to select a rectangle; Select on a layer row takes the whole layer.",
  viewer_inspector_hover_type: "Type",
  viewer_inspector_hover_layer: "Layer",
  viewer_inspector_hover_handle: "Handle",
  viewer_inspector_key: "Source key",
  viewer_inspector_copy: "Copy key",
  viewer_inspector_copy_label: "Copy {key}",
  viewer_inspector_copied: "Copied",
  viewer_inspector_reveal: "Reveal in sheet",
  viewer_inspector_clear: "Clear selection",
  viewer_inspector_selected_count: "{count} selected",
  viewer_inspector_missing_heading: "Not on this sheet",
  viewer_inspector_missing_body: "The link named these keys, and this sheet does not hold them.",
  viewer_status_selection: "Selection",
  viewer_layer_select: "Select",
  viewer_layer_select_label: "Select every entity on {layer}",
};

/** What the panel is handed about the entity under the pointer (increment interfaces: `HoverFact`). */
type HoverFact = { key: string; type: string; layer: string };

/** One selected entity, as the panel lists and copies it (increment interfaces: `SelectedEntity`). */
type SelectedEntity = { key: string; type: string; layer: string; box: IndexBox };

type Panel = { InspectorPanel: (props: Record<string, unknown>) => unknown };

/** The scheme every source key of this corpus carries — the handle is what follows it (L-CAD-03). */
const SCHEME = "DXF_HANDLE:";

/** Two entities of the declared corpus shape, on two layers, with boxes of their own. */
const SELECTED: SelectedEntity[] = [
  { key: syntheticKey(11), type: "LINE", layer: "SYN-00", box: { min: [10, 20], max: [30, 25] } },
  { key: syntheticKey(12), type: "LWPOLYLINE", layer: "SYN-01", box: { min: [-5, 0], max: [4, 8] } },
];

/** The entity under the pointer, on a layer of its own. */
const HOVERED: HoverFact = { key: syntheticKey(40), type: "TEXT", layer: "SYN-02" };

/** Keys an address named that this sheet does not hold — a shape error and a stale handle (I-88). */
const MISSING = ["FOO:1", syntheticKey(999_001)];

let InspectorPanel: Panel["InspectorPanel"];
let strings: Record<string, string>;

let prepared: Promise<void> | undefined;
function prepare(): Promise<void> {
  prepared ??= (async () => {
    InspectorPanel = (await productModule<Panel>(INSPECTOR_PANEL_MODULE)).InspectorPanel;
    strings = await stringTable();
  })();
  return prepared;
}

/** The props the screen hands the panel, with everything this case does not care about at rest. */
function props(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hover: null,
    selection: [],
    missing: [],
    onCopy: async () => undefined,
    onReveal: () => undefined,
    onClear: () => undefined,
    ...over,
  };
}

const panel = (): HTMLElement => screen.getByTestId("viewer-inspector");

/** The rows of the selection list, in the order the panel renders them. */
function rows(): HTMLElement[] {
  return within(panel()).queryAllByTestId("viewer-inspector-entity");
}

/**
 * A clipboard whose writes this file can read back. It is installed AFTER `userEvent.setup()`, which
 * replaces `navigator.clipboard` with a stub of its own the moment it is called — a spy put there
 * before that call is gone by the time anything is asserted about it.
 */
function watchedClipboard(): string[] {
  const written: string[] = [];
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText: async (value: string) => void written.push(value), readText: async () => written.at(-1) ?? "" },
    configurable: true,
    writable: true,
  });
  return written;
}

afterEach(() => {
  cleanup();
});

describe("AC-1: the panel renders the state it is handed, by the ids and the copy the contract fixes", () => {
  test("AC-1: the registry carries this region's copy, verbatim", async () => {
    await prepare();
    for (const [key, value] of Object.entries(COPY)) {
      expect(registered(strings, key), `\`${key}\` reads as docs/design/s-viewer-inspector.md §3 fixes it`).toBe(value);
    }
  });

  test("AC-1: nothing hovered and nothing selected is the idle state, and it teaches the three gestures", async () => {
    await prepare();
    render(<InspectorPanel {...props()} />);

    expect(panel().getAttribute("data-state"), "an inspector holding nothing says so").toBe("idle");
    expect(panel().getAttribute("data-count"), "and counts the empty set rather than hiding it").toBe("0");
    expect(panel().textContent ?? "", "the idle cell teaches what to do next (R-UI-050)").toContain(registered(strings, "viewer_inspector_idle_body"));
    expect(within(panel()).queryAllByTestId("viewer-inspector-hover").length, "nothing is under the pointer, so no hover cell is rendered").toBe(0);
    expect(rows().length, "and no entity is listed").toBe(0);

    const reveal = within(panel()).getByRole("button", { name: registered(strings, "viewer_inspector_reveal") });
    expect((reveal as HTMLButtonElement).disabled, "a reveal with nothing selected has nowhere to go, so the door is shut (AC-3)").toBe(true);
  });

  test("AC-1: the entity under the pointer is read out by type, layer and handle, verbatim", async () => {
    await prepare();
    render(<InspectorPanel {...props({ hover: HOVERED })} />);

    expect(panel().getAttribute("data-state"), "with nothing selected, the pointer is what the panel is reporting").toBe("hover");
    const hover = within(panel()).getByTestId("viewer-inspector-hover");
    expect(hover.getAttribute("data-key"), "the hover cell names the source key it is reading").toBe(HOVERED.key);

    expect(within(hover).getByTestId("viewer-inspector-hover-type").textContent, "the record's own type, as data (I-25)").toBe(HOVERED.type);
    expect(within(hover).getByTestId("viewer-inspector-hover-layer").textContent, "the layer it is grouped under, verbatim").toBe(HOVERED.layer);
    expect(within(hover).getByTestId("viewer-inspector-hover-handle").textContent, "and the handle alone — what follows the scheme in its key").toBe(HOVERED.key.slice(SCHEME.length));

    expect(hover.textContent ?? "", "each value is labelled by the registry's own word").toContain(registered(strings, "viewer_inspector_hover_type"));
    expect(hover.textContent ?? "", "each value is labelled by the registry's own word").toContain(registered(strings, "viewer_inspector_hover_layer"));
    expect(hover.textContent ?? "", "each value is labelled by the registry's own word").toContain(registered(strings, "viewer_inspector_hover_handle"));
  });

  test("AC-1: a selection is listed in selection order, and outranks the hover", async () => {
    await prepare();
    render(<InspectorPanel {...props({ hover: HOVERED, selection: SELECTED })} />);

    expect(panel().getAttribute("data-state"), "what is held outranks what is merely under the pointer").toBe("selected");
    expect(panel().getAttribute("data-count"), "and the count is the selection's own size").toBe(String(SELECTED.length));
    expect(within(panel()).queryAllByTestId("viewer-inspector-hover").length, "the hover is still read — it never displaces what is held").toBe(1);

    const listed = rows();
    expect(listed.map((row) => row.getAttribute("data-key")), "one row per selected key, in selection order").toEqual(SELECTED.map((entity) => entity.key));
    for (const [at, entity] of SELECTED.entries()) {
      const row = listed[at] as HTMLElement;
      expect(row.getAttribute("data-type"), `row ${at} names the record's type`).toBe(entity.type);
      expect(row.getAttribute("data-layer"), `row ${at} names the layer it is on`).toBe(entity.layer);
      expect(row.getAttribute("data-bbox"), `row ${at} publishes its world box as minx,miny,maxx,maxy`).toBe(bboxAttribute(entity.box));
      expect(within(row).getByTestId("viewer-inspector-key").textContent, `row ${at} shows the source key whole and verbatim (I-26)`).toBe(entity.key);
    }
  });
});

describe("AC-3: every listed key is copyable, one at a time", () => {
  test("AC-3: pressing a row's copy writes exactly that key, and says so where a reader hears it", async () => {
    await prepare();
    const copied: string[] = [];
    const person = userEvent.setup();
    const written = watchedClipboard();
    render(<InspectorPanel {...props({ selection: SELECTED, onCopy: async (key: string) => void copied.push(key) })} />);

    const first = rows()[0] as HTMLElement;
    const key = SELECTED[0]?.key as string;
    const button = within(first).getByRole("button", { name: fillSlots(registered(strings, "viewer_inspector_copy_label"), { key }) });
    expect(within(first).getByTestId("viewer-inspector-copy"), "the row's copy door is the button that names that key").toBe(button);
    expect(button.getAttribute("data-copied"), "nothing has been copied yet").toBe("false");

    await person.click(button);

    expect(copied, "the key is handed over exactly as it stands — no scheme stripped, nothing trimmed").toEqual([key]);
    expect(
      written.every((value) => value === key),
      `whatever the panel put on the clipboard itself, it was that key and nothing else: ${JSON.stringify(written)}`,
    ).toBe(true);

    expect(button.getAttribute("data-copied"), "the button says it holds the copied key").toBe("true");
    expect(button.textContent ?? "", "and reads as copied rather than as an invitation to copy again").toContain(registered(strings, "viewer_inspector_copied"));

    // A live region, found by the role that makes it one — `status` is polite by definition, and a
    // panel that also spells `aria-live` may only spell it politely (R-UI-012, Decision §1).
    const live = within(panel()).getAllByRole("status");
    expect(live.length, "the panel carries one live region, not one per row").toBe(1);
    const region = live[0] as HTMLElement;
    expect(region.getAttribute("aria-live") ?? "polite", "and it interrupts nobody").toBe("polite");
    expect(region.textContent ?? "", "which announces the copy to a reader who cannot see the button change").toContain(registered(strings, "viewer_inspector_copied"));
  });

  test("AC-3: copying a second row returns the first to uncopied", async () => {
    await prepare();
    const person = userEvent.setup();
    render(<InspectorPanel {...props({ selection: SELECTED })} />);

    await person.click(within(rows()[0] as HTMLElement).getByTestId("viewer-inspector-copy"));
    await person.click(within(rows()[1] as HTMLElement).getByTestId("viewer-inspector-copy"));

    expect(
      rows().map((row) => within(row).getByTestId("viewer-inspector-copy").getAttribute("data-copied")),
      "at most one row is the copied one: the clipboard holds one key",
    ).toEqual(["false", "true"]);
  });

  test("AC-3: the reveal and the clear doors are what they say, and act on the selection", async () => {
    await prepare();
    const person = userEvent.setup();
    let revealed = 0;
    let cleared = 0;
    render(<InspectorPanel {...props({ selection: SELECTED, onReveal: () => (revealed += 1), onClear: () => (cleared += 1) })} />);

    const reveal = within(panel()).getByTestId("viewer-inspector-reveal");
    expect((reveal as HTMLButtonElement).disabled, "with a selection held, the reveal is open").toBe(false);
    expect(reveal.textContent ?? "", "and reads as the registry writes it").toContain(registered(strings, "viewer_inspector_reveal"));
    await person.click(reveal);
    expect(revealed, "pressing it asks the screen to fly to what is held").toBe(1);

    const clear = within(panel()).getByTestId("viewer-inspector-clear");
    expect(clear.textContent ?? "", "the clear door reads as the registry writes it").toContain(registered(strings, "viewer_inspector_clear"));
    await person.click(clear);
    expect(cleared, "and pressing it asks the screen to let the selection go").toBe(1);

    expect(panel().textContent ?? "", "the count line states the size of what is held (R-SPINE-010's figure, the registry's sentence)").toContain(
      fillSlots(registered(strings, "viewer_inspector_selected_count"), { count: String(SELECTED.length) }),
    );
  });
});

describe("AC-4: keys the sheet does not hold are shown, not hidden", () => {
  test("AC-4: every offered key that is not on this sheet is listed, while the ones that are stay selected", async () => {
    await prepare();
    render(<InspectorPanel {...props({ selection: SELECTED, missing: MISSING })} />);

    const listed = within(panel()).getByTestId("viewer-inspector-missing");
    const rowsMissing = within(listed).getAllByTestId("viewer-inspector-missing-key");
    expect(rowsMissing.map((row) => row.getAttribute("data-key")), "one row per key the address named and the sheet does not hold (I-88)").toEqual(MISSING);
    for (const row of rowsMissing) {
      expect(row.textContent ?? "", `the key ${row.getAttribute("data-key")} is shown whole and verbatim`).toContain(row.getAttribute("data-key") as string);
    }

    expect(panel().textContent ?? "", "and the cell says what happened, in the registry's own words").toContain(registered(strings, "viewer_inspector_missing_body"));
    expect(rows().length, "the keys that were found are still selected — a partial is shown, never hidden (R-UI-050)").toBe(SELECTED.length);
    expect(panel().getAttribute("data-count"), "and the count is of what is held, not of what was asked for").toBe(String(SELECTED.length));
  });

  test("AC-4: with nothing found and nothing hovered, the missing keys stand beside the idle cell", async () => {
    await prepare();
    render(<InspectorPanel {...props({ missing: MISSING })} />);

    expect(panel().getAttribute("data-state"), "nothing was selected, so nothing is held").toBe("idle");
    expect(panel().getAttribute("data-count"), "and the count says so").toBe("0");
    expect(within(panel()).getAllByTestId("viewer-inspector-missing-key").length, "while the keys the link named are still reported").toBe(MISSING.length);
  });
});
