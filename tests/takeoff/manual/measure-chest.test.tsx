// @vitest-environment jsdom
/**
 * S5's QS outcome and the chest's R-UI-050 cells (docs/design/s-measure.md § 2.6, § 3, § 9, I-374):
 * the QS creates "75 CC blinding under SOG", picks it, and Area arms under it — driven through the
 * mounted viewer as a hand and a keyboard drive it; then each state of the chest as its own cell:
 * three row bones while it is read, the teaching empty state with its one action, the read's fault in
 * place with a retry and the report id, and — without MEASURE — the chest read-only.
 *
 * The doors are the route's shapes in memory (`./support/chest-doors.ts`); the chest's judgement is
 * proved live in `./conditions.db.test.ts`. Every id is the registry's.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useMeasureChest, type ChestDoors } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/measure-chest";
import type { MeasureTool } from "@/modules/takeoff/viewer-measure/gesture";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { BLINDING, CHEST_CATALOGUE, listed, memoryChest } from "./support/chest-doors";
import { key, mountMeasure, unmountMeasure } from "../viewer-measure/support/measure-screen";
import { installInertResizeObserver } from "../viewer/support/viewer-support";

afterEach(() => {
  unmountMeasure();
  cleanup();
});

const one = (testid: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
const all = (testid: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)];
const chestState = (): string | null => one(TESTIDS.measure.chest)?.getAttribute("data-state") ?? null;

/** Fill the New condition form as a QS would: the name, the thickness; the rest as it opens. */
async function authorBlinding(name = BLINDING.name, thickness = "75"): Promise<void> {
  const form = await waitFor(() => {
    const found = one(TESTIDS.measure.conditionForm);
    expect(found, "New condition opens the authoring popover (§ 2.6)").not.toBeNull();
    return found as HTMLElement;
  });
  const nameField = form.querySelector<HTMLInputElement>("#measure-condition-name") as HTMLInputElement;
  const thicknessField = form.querySelector<HTMLInputElement>("#measure-condition-reading-t") as HTMLInputElement;
  expect(thicknessField, "a blinding owes its thickness, so the form asks for it").not.toBeNull();
  await act(async () => {
    fireEvent.change(nameField, { target: { value: name } });
    fireEvent.change(thicknessField, { target: { value: thickness } });
  });
  await act(async () => {
    fireEvent.click(one(TESTIDS.measure.conditionSave) as HTMLElement);
  });
}

describe("S5: the QS creates '75 CC blinding under SOG', picks it, and A arms", () => {
  test("New condition → name and 75 mm → Save; the row stands with digit 1; a click on it arms Area and the measure cell names it; after V, the digit 1 arms it again", async () => {
    const chest = memoryChest();
    const mount = await mountMeasure({ chest });
    await waitFor(() => expect(chestState(), "an empty chest teaches (§ 3's empty cell)").toBe("empty"));
    expect(one(TESTIDS.measure.chest)?.textContent).toContain(strings.measure_chest_empty_title);

    await act(async () => {
      fireEvent.click(one(TESTIDS.measure.chestNew) as HTMLElement);
    });
    await authorBlinding();
    expect(chest.author, "the statement the chest's door is handed").toHaveBeenCalledWith({
      projectId: expect.any(String),
      condition: { name: BLINDING.name, geometry: "POLYGON", elementClass: "slab", kinds: ["pcc.blinding"], readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm" }], colour: "slab", hatch: "solid" },
    });

    const row = await waitFor(() => {
      const found = all(TESTIDS.measure.chestCondition);
      expect(found.length, "the chest re-reads and lists the new condition").toBe(1);
      return found[0] as HTMLElement;
    });
    expect([row.getAttribute("data-hotkey"), row.getAttribute("data-geometry"), row.textContent]).toEqual(["1", "POLYGON", expect.stringContaining(BLINDING.name)]);
    expect(row.getAttribute("data-selected"), "a saved condition is picked, ready to measure with").toBe("true");
    expect(mount.one(TESTIDS.viewer.toolArea)?.getAttribute("aria-pressed"), "and its tool — Area, for an area condition — is armed (I-374)").toBe("true");
    const cell = mount.one(TESTIDS.viewer.statusMeasure) as HTMLElement;
    expect(cell.textContent, "the measure cell names the condition the tool measures under (§ 4)").toContain(fill(strings.measure_status_drawing, { tool: strings.viewer_tool_area, condition: BLINDING.name, points: "0" }));

    // Back to Select, then the digit: 1 picks the chest's first condition and arms its tool.
    await key(mount, { key: "v" });
    expect(mount.one(TESTIDS.viewer.toolArea)?.getAttribute("aria-pressed")).toBe("false");
    await key(mount, { key: "1" });
    expect(mount.one(TESTIDS.viewer.toolArea)?.getAttribute("aria-pressed"), "the digit arms the condition's tool (I-374)").toBe("true");

    // A click on the row, once more, from Select.
    await key(mount, { key: "v" });
    await act(async () => {
      fireEvent.click(row.querySelector("button") as HTMLElement);
    });
    expect(mount.one(TESTIDS.viewer.toolArea)?.getAttribute("aria-pressed"), "a click on the row picks it and arms Area").toBe("true");
    // Another geometry's tool leaves the Area condition behind: a Line never measures under it (I-576).
    await key(mount, { key: "l" });
    expect(mount.one(TESTIDS.viewer.toolLinear)?.getAttribute("aria-pressed")).toBe("true");
    const measureCell = (): string => mount.one(TESTIDS.viewer.statusMeasure)?.textContent ?? "";
    expect(measureCell(), "Linear is not measuring under an Area condition").not.toContain(BLINDING.name);
    expect(measureCell()).toContain(fill(strings.measure_status_tool, { tool: strings.viewer_tool_linear, points: "0" }));
    expect(row.getAttribute("data-selected"), "and the chest does not show it picked").toBe("false");
    // Area again, and the condition last picked for it stands again (§ 2.6: "the area condition last used").
    await key(mount, { key: "a" });
    expect(measureCell()).toContain(fill(strings.measure_status_drawing, { tool: strings.viewer_tool_area, condition: BLINDING.name, points: "0" }));
    expect(row.getAttribute("data-selected")).toBe("true");
  });

  test("a second condition of a standing name is refused in the popover by the register's code, and nothing is added", async () => {
    const chest = memoryChest({ conditions: [listed(BLINDING, "00000000-0000-4000-8000-00000000abcd", 0)] });
    await mountMeasure({ chest });
    await waitFor(() => expect(chestState()).toBe("ready"));
    await act(async () => {
      fireEvent.click(one(TESTIDS.measure.chestNew) as HTMLElement);
    });
    await authorBlinding();
    const refusal = await waitFor(() => {
      const found = one(TESTIDS.refusal.state);
      expect(found, "the one RefusalState, inside the popover that asked (R-UI-020)").not.toBeNull();
      return found as HTMLElement;
    });
    expect(refusal.getAttribute("data-code")).toBe("CONDITION_NAME_TAKEN");
    expect(one(TESTIDS.measure.conditionForm), "the form stays, so the QS can rename").not.toBeNull();
    expect(chest.held.length).toBe(1);
  });
});

/** The chest mounted alone, as the drawer hosts it, with its arming door observed. */
function Host({ doors, onArm, busy = false }: { doors: ChestDoors; onArm: (tool: MeasureTool) => void; busy?: boolean }) {
  const [projectId] = useState("22222222-2222-4222-8222-222222222222");
  // The region's door, as the screen wires it: under a shape in progress the tool does not change (I-372).
  const [armed, setArmed] = useState<MeasureTool | null>(null);
  const arm = (tool: MeasureTool): void => {
    onArm(tool);
    if (!busy) setArmed(tool);
  };
  const chest = useMeasureChest({ projectId, enabled: true, onArm: arm, isBusy: () => busy, armed, doors });
  return createElement("div", { onKeyDown: (event: never) => chest.onKey(event) }, chest.panel, createElement("output", { "data-picked": chest.picked?.name ?? "" }));
}

function mountChest(doors: ChestDoors, o: { busy?: boolean } = {}): { onArm: ReturnType<typeof vi.fn> } {
  installInertResizeObserver();
  const onArm = vi.fn();
  render(createElement(Host, { doors, onArm, busy: o.busy === true }));
  return { onArm };
}

describe("the chest's R-UI-050 cells (§ 3)", () => {
  test("loading: three row bones under a real heading, and no New", async () => {
    mountChest({ ...memoryChest(), read: () => new Promise(() => undefined) });
    await waitFor(() => expect(chestState()).toBe("loading"));
    expect(document.querySelectorAll(".cx-measure-chest-bone").length).toBe(3);
    expect(one(TESTIDS.measure.chest)?.textContent).toContain(strings.measure_chest_heading);
    expect(one(TESTIDS.measure.chestNew)).toBeNull();
  });

  test("empty: the teaching empty state, whose one action is New condition", async () => {
    mountChest(memoryChest());
    await waitFor(() => expect(chestState()).toBe("empty"));
    const text = one(TESTIDS.measure.chest)?.textContent ?? "";
    expect(text).toContain(strings.measure_chest_empty_title);
    expect(text).toContain(strings.measure_chest_empty_body);
    expect(one(TESTIDS.measure.chestNew)?.textContent).toBe(strings.measure_chest_empty_action);
  });

  test("ready: a row per condition in the chest's order, digits by place, the campaign's COMPLETE total per kind — none shown as a dash, never a zero", async () => {
    const billed = listed(BLINDING, "00000000-0000-4000-8000-000000000001", 0, { measured: 2, billed: 1, totals: [{ kind: "pcc.blinding", unit: "m3", value: "24.663" }] });
    const second = listed({ ...BLINDING, name: "100 CC blinding under footings", hatch: "cross" }, "00000000-0000-4000-8000-000000000002", 1);
    mountChest(memoryChest({ conditions: [billed, second] }));
    await waitFor(() => expect(chestState()).toBe("ready"));
    const rows = all(TESTIDS.measure.chestCondition);
    expect(rows.map((row) => [row.getAttribute("data-hotkey"), row.querySelector(".cx-measure-chest-name")?.textContent])).toEqual([
      ["1", BLINDING.name],
      ["2", "100 CC blinding under footings"],
    ]);
    const totals = rows.map((row) => row.querySelector(".cx-measure-chest-total") as HTMLElement);
    expect(totals[0]?.textContent, "the line's own figure, through the format seam").toBe("24.663m3");
    expect(totals[0]?.querySelector(`[data-testid="${TESTIDS.unit.badge}"]`)?.textContent, "its unit in the product's one unit badge").toBe("m3");
    expect([totals[0]?.getAttribute("data-measured"), totals[0]?.getAttribute("data-billed")]).toEqual(["2", "1"]);
    expect(totals[1]?.textContent, "nothing billed is a dash, never 0").toBe(strings.measure_chest_total_none);
    expect(rows.map((row) => row.querySelector(".cx-measure-swatch")?.getAttribute("data-hatch")), "colour is never the only thing that tells two apart (R-UI-060)").toEqual(["diagonal", "cross"]);
    expect(one(TESTIDS.measure.chestNew), "a MEASURER may add another").not.toBeNull();
    expect(all(TESTIDS.measure.chestRowMenu).length, "and each row has its menu").toBe(2);
  });

  test("a pick arms the condition's tool; the digit picks by place; under a shape in progress the pick changes nothing and the region is asked (it says why)", async () => {
    const conditions = [listed(BLINDING, "00000000-0000-4000-8000-000000000001", 0), listed({ ...BLINDING, name: "Wall run", geometry: "POLYLINE" }, "00000000-0000-4000-8000-000000000002", 1)];
    const { onArm } = mountChest(memoryChest({ conditions }));
    await waitFor(() => expect(chestState()).toBe("ready"));
    await act(async () => {
      fireEvent.click(all(TESTIDS.measure.chestCondition)[1]?.querySelector("button") as HTMLElement);
    });
    expect(onArm).toHaveBeenLastCalledWith("linear");
    expect(document.querySelector("output")?.getAttribute("data-picked")).toBe("Wall run");
    await act(async () => {
      fireEvent.keyDown(one(TESTIDS.measure.chest) as HTMLElement, { key: "1" });
    });
    expect(onArm).toHaveBeenLastCalledWith("area");
    expect(document.querySelector("output")?.getAttribute("data-picked")).toBe(BLINDING.name);
    await act(async () => {
      fireEvent.keyDown(one(TESTIDS.measure.chest) as HTMLElement, { key: "7" });
    });
    expect(onArm, "a digit no condition holds is not the chest's").toHaveBeenCalledTimes(2);
  });

  test("under a shape in progress a pick does not change the condition", async () => {
    const conditions = [listed(BLINDING, "00000000-0000-4000-8000-000000000001", 0)];
    const { onArm } = mountChest(memoryChest({ conditions }), { busy: true });
    await waitFor(() => expect(chestState()).toBe("ready"));
    await act(async () => {
      fireEvent.click(all(TESTIDS.measure.chestCondition)[0]?.querySelector("button") as HTMLElement);
    });
    expect(onArm, "the region is asked, and answers 'finish or discard first' (I-372)").toHaveBeenCalledWith("area");
    expect(document.querySelector("output")?.getAttribute("data-picked")).toBe("");
  });

  test("error: the read's fault in place — the sentence, a retry that reads again, and the report id; the retry reads the chest", async () => {
    const chest = memoryChest({ conditions: [listed(BLINDING, "00000000-0000-4000-8000-000000000001", 0)] });
    const read = vi.fn(chest.read);
    read.mockImplementationOnce(async () => {
      throw Object.assign(new Error("the store is away"), { digest: "4242424242" });
    });
    mountChest({ ...chest, read });
    await waitFor(() => expect(chestState()).toBe("failed"));
    const text = one(TESTIDS.measure.chest)?.textContent ?? "";
    expect(text).toContain(strings.measure_chest_read_failed);
    expect(text).toContain(fill(strings.measure_read_report, { id: "4242424242" }));
    await act(async () => {
      fireEvent.click(one(TESTIDS.measure.chestRetry) as HTMLElement);
    });
    await waitFor(() => expect(chestState()).toBe("ready"));
    expect(read).toHaveBeenCalledTimes(2);
  });

  test("permission-denied: without MEASURE the chest is read-only — its rows and a line that says so, no New, no menu, and a click arms nothing", async () => {
    const { onArm } = mountChest(memoryChest({ conditions: [listed(BLINDING, "00000000-0000-4000-8000-000000000001", 0)], canAuthor: false }));
    await waitFor(() => expect(chestState()).toBe("readonly"));
    expect(one(TESTIDS.measure.chest)?.textContent).toContain(strings.measure_chest_readonly);
    expect(all(TESTIDS.measure.chestCondition).length).toBe(1);
    expect(one(TESTIDS.measure.chestNew)).toBeNull();
    expect(one(TESTIDS.measure.chestRowMenu)).toBeNull();
    await act(async () => {
      fireEvent.click(all(TESTIDS.measure.chestCondition)[0]?.querySelector("button") as HTMLElement);
    });
    expect(onArm).not.toHaveBeenCalled();
    // Nor is a digit the chest's: the keystroke goes on to the sheet's own keys, not swallowed.
    const digit = new KeyboardEvent("keydown", { key: "1", bubbles: true, cancelable: true });
    await act(async () => {
      one(TESTIDS.measure.chest)?.dispatchEvent(digit);
    });
    expect([digit.defaultPrevented, onArm.mock.calls.length], "a read-only chest leaves 1 to the sheet (§ 3)").toEqual([false, 0]);
  });

  test("the catalogue a chest is read with is what the form offers: Area, slab, blinding, a thickness in mm", () => {
    expect(CHEST_CATALOGUE[0]?.classes[0]?.kinds[0]?.readings[0]?.units).toContain("mm");
  });
});
