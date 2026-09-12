// @vitest-environment jsdom
/**
 * The v22 rebuild's own properties (Design Direction 00 §3.2, §8's "Register (1.5)"; Decision
 * s-takeoff.md I-230–I-236).
 *
 * Three of the five fixes §8 asks this screen for are composition, and composition is exactly what a
 * jsdom mount can hold to account: the inspector is the FRAME's one right column and is absent until
 * something is selected, the job strip exists only while a run is watched, and the row a reader picks
 * — with the pointer, not only with the keyboard — is what the inspector states.
 *
 * The two mounts are bound here as the route binds them, except that they render in place (there is
 * no frame in jsdom): what this suite reads under `register-workspace` is the node the route hands
 * the frame, which is the thing the Decision rules.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  all,
  cleanup,
  copy,
  lineRows,
  mountRegister,
  one,
  registerFixture,
  takeoffStrings,
  text,
  treeItems,
  userEvent,
  type ViewLine,
} from "./support/fixtures";

afterEach(() => cleanup());

/** The screen's copy, loaded by the test that reads it (a suite-wide hook would skip criteria). */
let loading: Promise<Record<string, string>> | undefined;
const strings = (): Promise<Record<string, string>> => (loading ??= takeoffStrings());

describe("the frame's one right column, filled on selection and absent otherwise (R-UI-080, I-231)", () => {
  test("at rest the register renders no inspector at all — not an idle sentence", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);
    const said = await strings();

    expect(all(root, "register-inspector").length, "nothing is selected, so there is no right column: R-UI-080's absence is width 0, never a placeholder").toBe(0);
    for (const key of ["takeoff_register_inspector_idle_heading", "takeoff_register_inspector_idle_body"]) {
      expect(text(root), `\`${key}\` is a sentence standing in an empty region, which is what v22 removed (I-231)`).not.toContain(copy(said, key));
    }
    expect(all(root, "register-object-key").length, "and no identifier of a thing nobody has chosen stands anywhere").toBe(0);
  });

  test("a row taken with the pointer states its line: the figure, the formula whole, and the key in Technical", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);
    const said = await strings();
    const line = view.lines[0] as ViewLine;

    const row = lineRows(root).find((held) => held.getAttribute("data-line") === line.lineId);
    expect(row, "every row publishes the line it stands for, which is how a pointer's row is read (I-236)").toBeTruthy();
    await userEvent.setup().click((row as HTMLElement).querySelectorAll('[role="gridcell"], [role="rowheader"]')[0] as HTMLElement);

    const inspector = one(root, "register-inspector");
    expect(inspector.getAttribute("data-line"), "the column states the line the reader took").toBe(line.lineId);
    expect(text(inspector), "the formula, whole — the expansion §5 rule 2 owes a cell that may not grow taller").toContain(line.formula);
    expect(text(inspector), "and the kind it was measured for").toContain(line.kind);
    for (const [name, binding] of Object.entries(line.variables)) {
      expect(text(inspector), `the variable \`${name}\` it was read with`).toContain(name);
      expect(text(inspector), `and the reading itself`).toContain(binding.value);
    }
    expect(text(one(root, "register-object-key")), "the machine's own name for the object stands in the Technical disclosure, whole (I-234)").toBe(line.objectKey);
    expect(one(root, "register-object-key").getAttribute("data-technical"), "which is the one home §7 C6 sanctions for it").toBe("");
    expect(text(one(root, "register-source-key")), "and the source key it was read at, whole, beside it").toBe(line.sourceKey);
    expect(
      (row as HTMLElement).getAttribute("data-line-selected"),
      "and the row says it is the taken one, so the grid paints it as selected (I-236)",
    ).toBe("true");
    expect(text(inspector), "the object's own doors are not offered over a line: a line is a record").not.toContain(copy(said, "takeoff_register_repudiate"));
  });

  test("an object chosen in the tree states the object, and carries this screen's two act doors", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);
    const said = await strings();
    const object = view.objects[0] as { objectKey: string; mark: string };

    const item = treeItems(root).find((held) => text(held).startsWith(object.mark));
    await userEvent.setup().click(item as HTMLElement);

    const inspector = one(root, "register-inspector");
    expect(inspector.getAttribute("data-object"), "the column states the object the reader chose").toBe(object.objectKey);
    expect(all(root, "register-object-basis").length, "with the basis it rests on").toBe(1);
    expect(text(inspector), "the door that strikes it, as a SECONDARY in the inspector and never a full-width bar (§8)").toContain(copy(said, "takeoff_register_repudiate"));
    expect(text(inspector), "and the door that records a reading against an attribute").toContain(copy(said, "takeoff_register_corroborate"));
  });

  test("choosing the other kind of subject replaces the column rather than doubling it", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);
    const user = userEvent.setup();
    const line = view.lines[0] as ViewLine;
    const object = view.objects[0] as { objectKey: string; mark: string };

    const row = lineRows(root).find((held) => held.getAttribute("data-line") === line.lineId) as HTMLElement;
    await user.click(row.querySelectorAll('[role="gridcell"], [role="rowheader"]')[0] as HTMLElement);
    await user.click(treeItems(root).find((held) => text(held).startsWith(object.mark)) as HTMLElement);

    const inspector = one(root, "register-inspector");
    expect(inspector.getAttribute("data-line"), "the line the reader left states nothing over the object they chose").toBeNull();
    expect(inspector.getAttribute("data-object"), "the one column states the one subject").toBe(object.objectKey);
  });
});

describe("the job strip stands only while a run does (R-UI-080, §8's first fix)", () => {
  test("no run watched, no strip — and the door puts one there", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);
    const said = await strings();

    expect(all(root, "register-timeline").length, "an empty `Measure runs` block over the grid is height the grid paid for (§8)").toBe(0);
    expect(text(root), "and its heading is not standing over nothing either").not.toContain(copy(said, "takeoff_register_timeline_heading"));

    await userEvent.setup().click(one(root, "register-measure"));

    expect(all(root, "register-timeline").length, "the run the door answered is shown where it was started (R-UI-024)").toBe(1);
    expect(text(one(root, "register-timeline")), "under the pattern's own heading").toContain(copy(said, "takeoff_register_timeline_heading"));
  });
});
