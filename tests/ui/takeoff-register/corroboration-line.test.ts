// @vitest-environment jsdom
/**
 * Jev logic-point 6 on the screen (docs/design/s-takeoff.md I-299; L-AI-02, L-AI-03, L-QTY-04).
 *
 * What the machine proposed about a deferred outline stands in the inspector, above the two doors
 * that judge it, as ONE sentence: three readings, three sentences, and the band's own words where it
 * could not tell. It is a Proposal and stays one — the figure is an attribute and never ink, the
 * object stands deferred until a person acts, and the screen adds no door of its own.
 *
 * And the act carries it: pressing a door beside a proposal names the call the person judged, which
 * is what the seam files the outcome against (`src/core/outline-corroboration/outcome.ts`). An
 * object nobody asked about shows no line and names no call, and the act is exactly what it was.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  cleanup,
  copy,
  mountRegister,
  one,
  refusalsFixture,
  registerFixture,
  stagedDoors,
  takeoffStrings,
  text,
  treeItems,
  userEvent,
} from "./support/fixtures";

afterEach(() => cleanup());

/** The screen's copy, loaded by the test that reads it (a suite-wide hook would skip criteria). */
let loading: Promise<Record<string, string>> | undefined;
const strings = (): Promise<Record<string, string>> => (loading ??= takeoffStrings());

/** The proposal line of the open inspector, or null where none stands. */
function line(root: HTMLElement): HTMLElement | null {
  return one(root, "register-inspector").querySelector(".cx-register-corroboration");
}

/** Choose one object in the tree, which is what opens the inspector over it. */
async function choose(root: HTMLElement, mark: string): Promise<void> {
  const item = treeItems(root).find((held) => text(held).startsWith(mark));
  await userEvent.setup().click(item as HTMLElement);
}

describe("what the machine proposed, said once, above the doors that judge it", () => {
  test("a proposal it is sure of reads as the member its mark names, with the figure in an attribute and not in the words", async () => {
    const view = refusalsFixture();
    const object = view.objects[2] as { objectKey: string; mark: string };
    const root = await mountRegister(view, {
      corroborations: { [object.objectKey]: { reading: "YES", probability: "0.93", callId: "call-1" } },
    });
    const said = await strings();

    await choose(root, object.mark);
    const shown = line(root);
    expect(shown, "the inspector carries the machine's sentence about the object the reader chose").not.toBeNull();
    expect(text(shown as HTMLElement)).toBe(copy(said, "takeoff_register_corroboration_yes"));
    expect((shown as HTMLElement).getAttribute("data-reading")).toBe("YES");
    expect((shown as HTMLElement).getAttribute("data-probability"), "the figure stands in the DOM and on S-Audit, never as ink on this screen (B-07)").toBe("0.93");
    expect(text(shown as HTMLElement), "and the probability is not said in words").not.toContain("0.93");
  });

  test("a proposal in the band says the machine could not tell — never a yes, never a no", async () => {
    const view = refusalsFixture();
    const object = view.objects[2] as { objectKey: string; mark: string };
    const root = await mountRegister(view, {
      corroborations: { [object.objectKey]: { reading: "UNSURE", probability: "0.5", callId: "call-2" } },
    });
    const said = await strings();

    await choose(root, object.mark);
    expect(text(line(root) as HTMLElement)).toBe(copy(said, "takeoff_register_corroboration_unsure"));
  });

  test("a proposal it reads the other way says the outline is something else the plan drew there", async () => {
    const view = refusalsFixture();
    const object = view.objects[3] as { objectKey: string; mark: string };
    const root = await mountRegister(view, {
      corroborations: { [object.objectKey]: { reading: "NO", probability: "0.04", callId: "call-3" } },
    });
    const said = await strings();

    await choose(root, object.mark);
    expect(text(line(root) as HTMLElement)).toBe(copy(said, "takeoff_register_corroboration_no"));
  });

  test("an object nobody asked about carries no line at all — never an empty slot (R-UI-050)", async () => {
    const view = refusalsFixture();
    const asked = view.objects[2] as { objectKey: string; mark: string };
    const quiet = view.objects[0] as { mark: string };
    const root = await mountRegister(view, {
      corroborations: { [asked.objectKey]: { reading: "YES", probability: "0.93", callId: "call-4" } },
    });

    await choose(root, quiet.mark);
    expect(line(root), "the proposal belongs to the object it was asked about, and to no other").toBeNull();
  });

  test("the screen with no proposals at all is the screen that shipped", async () => {
    const root = await mountRegister(registerFixture());
    const object = (registerFixture().objects[0] as { mark: string }).mark;

    await choose(root, object);
    expect(line(root)).toBeNull();
  });
});

describe("it is a proposal, and the acts are the person's", () => {
  test("the strike beside a proposal names the call it judged, and the strike beside none names nothing", async () => {
    const view = refusalsFixture();
    const asked = view.objects[2] as { objectKey: string; mark: string };
    const quiet = view.objects[0] as { objectKey: string; mark: string };
    const { calls, doors } = await stagedDoors();
    const root = await mountRegister(view, {
      corroborations: { [asked.objectKey]: { reading: "NO", probability: "0.04", callId: "call-5" } },
      doors,
    });
    const said = await strings();
    const user = userEvent.setup();

    const struck = (): Record<string, unknown>[] =>
      calls.filter((held) => held.door === "previewRepudiate").map((held) => (held.argument as { input: Record<string, unknown> }).input);
    const strike = async (): Promise<void> => {
      await user.click([...one(root, "register-inspector").querySelectorAll("button")].find((button) => text(button) === copy(said, "takeoff_register_repudiate")) as HTMLElement);
    };

    await choose(root, asked.mark);
    await strike();
    expect(struck()[0]?.["proposalCallId"], "the act carries the proposal the person was shown (L-AI-02)").toBe("call-5");
    expect(struck()[0]?.["objectKey"], "about the object they were shown it for").toBe(asked.objectKey);

    // A second mount, because the first press opened the one dialog over the screen: the act beside
    // no proposal is the act this screen has always sent.
    cleanup();
    const quietRoot = await mountRegister(view, { corroborations: { [asked.objectKey]: { reading: "NO", probability: "0.04", callId: "call-5" } }, doors });
    await choose(quietRoot, quiet.mark);
    await userEvent
      .setup()
      .click([...one(quietRoot, "register-inspector").querySelectorAll("button")].find((button) => text(button) === copy(said, "takeoff_register_repudiate")) as HTMLElement);
    const last = struck()[struck().length - 1] as Record<string, unknown>;
    expect(last["objectKey"]).toBe(quiet.objectKey);
    expect(last, "and an act beside no proposal is the act it always was").not.toHaveProperty("proposalCallId");
  });
});
