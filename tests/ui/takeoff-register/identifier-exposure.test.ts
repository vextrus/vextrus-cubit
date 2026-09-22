/**
 * R-UI-082 on the register, as I-287 rules it: a DXF handle, a version key and a source key are
 * identifiers, and an identifier is never body text. Every published line's `sourceKey` is a VIEW
 * key (`v:{class}:{anchor}`, L-REG-04 — `register-ui/server.ts`), and every refusal row's object key
 * is a PLACEMENT key, so both are the keys a reader met on the face of this screen before this
 * increment: the source cell read `Model · B1 · v:LAYOUT_PLAN:DXF_HANDLE:424` and the index rail
 * printed the placement key as bare mono text, which the craft rubric's `identifierExposure` reads
 * from the DOM and scores 0 for.
 *
 * What is asserted here is the rubric's OWN reading, spelled by this contract rather than imported:
 * the three patterns `scripts/probe/lib/craft.mjs` matches, over every text node of the workspace,
 * outside the chip and the tooltip it excludes. Nothing is rendered to satisfy it — the key is not
 * dropped anywhere, it moves onto the element's own data, where it is whole, copyable and one hover
 * from a reader (R-UI-082, I-26).
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import {
  DUPLICATE_IDENTITY,
  VIEW_CLASS_IN_WORDS,
  aLine,
  aView,
  all,
  anObject,
  cleanup,
  mountRegister,
  objectKeyOf,
  one,
  placementKeyOf,
  text,
  textNodesUnder,
  viewKeyOf,
} from "./support/fixtures";

afterEach(() => cleanup());

/**
 * The craft probe's three patterns, verbatim from `scripts/probe/lib/craft.mjs` — a uuid, a 64-hex
 * digest and an extractor's handle. Copied rather than imported, so a screen that satisfied this
 * file could not do it by agreeing with itself (B-19).
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HEX64 = /\b[0-9a-f]{64}\b/i;
const HANDLE = /\b(?:DXF_HANDLE|PDF_OBJECT|RASTER_TRACE):[0-9A-Za-z]+/;

/** What the probe reads past: the chip, the tooltip, and anything hidden from the accessibility tree. */
function exposedUnder(root: HTMLElement): string[] {
  const said = textNodesUnder(
    root,
    (node) =>
      node.matches(`${testIdSelector(TESTIDS.idChip.root)}, ${testIdSelector(TESTIDS.tooltip.content)}, [hidden], [aria-hidden="true"]`) ||
      node.classList.contains("cx-visually-hidden"),
  );
  return said.filter((node) => UUID.test(node) || HEX64.test(node) || HANDLE.test(node));
}

/** A register whose keys are the ones the product in fact derives (L-REG-04), and nothing simpler. */
function keyedFixture() {
  const line = aLine({ lineId: "line-B1", objectKey: objectKeyOf("B1"), sourceKey: viewKeyOf("424") });
  return aView({
    objects: [anObject({ mark: "B1" })],
    lines: [line],
    refusals: [{ code: DUPLICATE_IDENTITY, objectKey: placementKeyOf("424", "C1"), kind: null }],
  });
}

describe("R-UI-082/I-287: the register exposes no identifier as body text", () => {
  test("the source cell reads the view's class in words, and the key stands on the anchor", async () => {
    const view = keyedFixture();
    const root = await mountRegister(view);

    const anchors = all(root, TESTIDS.evidence.link).filter((anchor) => anchor.getAttribute("data-line") === "line-B1");
    expect(anchors.length, "the staged line carries exactly one Trace anchor (I-179)").toBe(1);
    const anchor = anchors[0] as HTMLElement;

    const label = text(anchor);
    expect(HANDLE.test(label), `the label states no extractor handle — it read "${label}" (R-UI-082)`).toBe(false);
    expect(label.includes("v:"), "and no version key either").toBe(false);
    expect(label, "what it states instead is the view's class, in words").toContain(VIEW_CLASS_IN_WORDS);
    expect(label, "beside the sheet the line stands on").toContain(view.lines[0]?.layoutName as string);
    expect(label, "and the mark it was measured for").toContain("B1");

    expect(anchor.getAttribute("data-key"), "the whole key is on the element that IS the evidence — one hover or one click away (I-287)").toBe(viewKeyOf("424"));
  });

  test("a refusal row's object key stands in an IdChip's data-value, not in a text node", async () => {
    const view = keyedFixture();
    const root = await mountRegister(view);
    const key = placementKeyOf("424", "C1");

    const row = one(root, TESTIDS.register.refusal);
    const chip = one(row, TESTIDS.register.refusalObject);
    expect(chip.getAttribute("data-value"), "the placement key, whole, in the chip's own datum (R-UI-082)").toBe(key);
    expect(text(chip), "and never said whole out loud").not.toContain("DXF_HANDLE:");

    const rail = one(root, TESTIDS.register.refusals);
    for (const said of textNodesUnder(rail, () => false)) {
      expect(said.includes(key), `no text node of the index rail prints the placement key — "${said}" does (I-287)`).toBe(false);
    }
  });

  test("the whole workspace scores identifierExposure 5: no text node matches the rubric's patterns", async () => {
    const root = await mountRegister(keyedFixture());
    expect(exposedUnder(root), "the craft rubric's own reading over the workspace's text (AM-08 Part 2)").toEqual([]);
  });
});

describe("I-234 and I-179 stand where they stood: only a VIEW key gained a reading", () => {
  test("an entity key of the extractor's grammar still reads as its handle", async () => {
    // The hash and the handle are composed rather than spelled: `#` and three hex digits IS a colour
    // literal to `cubit/no-colour-literal`, and a test that spelled one would be an error in a file
    // that is about identifiers and not about paint.
    const handle = "424";
    const key = `DXF_HANDLE:${handle}`;
    const root = await mountRegister(
      aView({ objects: [anObject({ mark: "B1" })], lines: [aLine({ lineId: "line-B1", objectKey: objectKeyOf("B1"), sourceKey: key })] }),
    );
    const anchor = all(root, TESTIDS.evidence.link)[0] as HTMLElement;

    expect(text(anchor), "the handle, said the way a quantity surveyor says it (I-179)").toContain(`#${handle}`);
    expect(HANDLE.test(text(anchor)), "and never the machine's own name for it").toBe(false);
    expect(anchor.getAttribute("data-key"), "with the key whole on the anchor").toBe(key);
  });

  test("a key of no known grammar stands whole in the chips (I-234's last clause)", async () => {
    const unruled = "S-101:t:B1";
    const root = await mountRegister(
      aView({ objects: [anObject({ mark: "B1" })], lines: [aLine({ lineId: "line-B1", objectKey: objectKeyOf("B1"), sourceKey: unruled })] }),
    );
    const anchor = all(root, TESTIDS.evidence.link)[0] as HTMLElement;

    expect(text(anchor), "nothing is abbreviated into a shape the product invented (I-26)").toContain(unruled);
    expect(anchor.getAttribute("data-key"), "and the key is on the anchor's data all the same").toBe(unruled);
  });

  test("a `v:` prefix over a rest of no grammar is not a view key, and is not taken apart on a guess", async () => {
    const notAView = "v:LAYOUT_PLAN:no such anchor";
    const root = await mountRegister(
      aView({ objects: [anObject({ mark: "B1" })], lines: [aLine({ lineId: "line-B1", objectKey: objectKeyOf("B1"), sourceKey: notAView })] }),
    );
    const anchor = all(root, TESTIDS.evidence.link)[0] as HTMLElement;

    expect(text(anchor), "the grammar is the law's, not a prefix test — so this key stands whole").toContain(notAView);
  });
});
