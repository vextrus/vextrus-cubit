/**
 * AC-4(e), AC-4(f) — the two colour readings of the viewer, each with one home and no silent
 * fallback.
 *
 * `alphaOf` reads `rgb(0 0 0 / 50%)` as fully opaque because it takes the alpha as a bare number and
 * a percentage is not one (debt-src-modules-8a86pe): a half-transparent overlay paints solid over the
 * drawing beneath it. The two notations readers are `alphaOf` and `channelsOf`, and they belong in a
 * module of their own that the painter imports, because a reading no test can reach is a reading
 * nobody has checked (B-17, ARCH-02).
 *
 * `swatchOf` carries an unreachable `[0, 0, 0]` fallback for a layer with no records
 * (debt-src-modules-1ezd0gb) — black, which is a colour a drawing really uses, standing in for "we
 * had nothing to read". A layer of the manifest is a layer something is drawn on, so the reading
 * takes a non-empty list and the fallback goes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { productModule, repoRoot } from "./support/viewer-support";

const COLOUR_NOTATION_MODULE = "src/modules/takeoff/viewer/colour-notation.ts";
const MANIFEST_MODULE = "src/modules/takeoff/viewer/manifest.ts";
const PAINTER_MODULE = "src/modules/takeoff/viewer/painter.ts";

type Channels = readonly [number, number, number];
type NotationSeam = { alphaOf: (colour: string) => number; channelsOf: (colour: string) => Channels };
type ManifestSeam = { buildRenderManifest: (graph: unknown, layoutName: string) => { layers: readonly { name: string; rgb: Channels }[] } };

/** The colour notations, in the one home the criterion names. */
async function notation(): Promise<NotationSeam> {
  const module = await productModule<Record<string, unknown>>(COLOUR_NOTATION_MODULE);
  for (const call of ["alphaOf", "channelsOf"]) {
    expect(typeof module[call], `${COLOUR_NOTATION_MODULE} exports ${call} — the notations reachable from a test (AC-4(f))`).toBe("function");
  }
  return module as unknown as NotationSeam;
}

/** One layer's worth of records, all drawn in the colours given, in the order given. */
function layer(name: string, colours: readonly Channels[]): Record<string, unknown>[] {
  return colours.map((rgb, index) => ({
    key: `${name}-${index}`,
    type: "LINE",
    space: "Model",
    layer: name,
    points: [[index, 0], [index, 1]],
    colour: { rgb, source: "bylayer" },
  }));
}

/** A model space drawn on two layers: one with a majority colour, one where two colours tie. */
function sheet(): unknown {
  const entities = [
    ...layer("MAJORITY", [[255, 0, 0], [0, 0, 255], [255, 0, 0]]),
    ...layer("TIED", [[0, 255, 0], [0, 0, 255]]),
  ];
  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Model", kind: "model", bbox: { min: [0, 0], max: [10, 10] }, strays_rejected: 0 }],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  };
}

test("AC-4(f): a percentage alpha is read as the fraction it states", async () => {
  const { alphaOf } = await notation();

  expect(alphaOf("rgb(0 0 0 / 50%)"), "half transparent is half, not opaque").toBe(0.5);
});

test("AC-4(f): the numeric and the bare notations are unmoved", async () => {
  const { alphaOf } = await notation();

  expect(alphaOf("rgba(0, 0, 0, 0.25)"), "a fraction stated as a number is that fraction").toBe(0.25);
  expect(alphaOf("#000000"), "a colour that states no alpha is opaque").toBe(1);
});

test("AC-4(f): an alpha stated past the whole is the whole", async () => {
  const { alphaOf } = await notation();

  expect(alphaOf("rgb(0 0 0 / 150%)"), "more than all of it is all of it — never a multiplier past opacity").toBe(1);
});

test("AC-4(f): the channels reader moved with it and answers the same channels", async () => {
  const { channelsOf } = await notation();

  expect([...channelsOf("#0a0b0c")], "a hex colour's three channels, as written").toEqual([10, 11, 12]);
});

// white-box: AC-4(f) — B-17 one home. That a reading exists in ONE place is a property of the text:
// a second copy left in the painter answers every behavioural probe above identically.
test("AC-4(f): the painter states no second copy of either reading", () => {
  // white-box: AC-4(f) — B-17 one home: a second copy left in the painter answers every behavioural
  // probe above identically, so only the text can show there is none.
  const painter = readFileSync(join(repoRoot(), PAINTER_MODULE), "utf8");

  for (const call of ["alphaOf", "channelsOf"]) {
    expect(new RegExp(`function\\s+${call}\\s*\\(`).test(painter), `${PAINTER_MODULE} defines no ${call} of its own — it imports the one home (B-17)`).toBe(false);
  }
  expect(painter.includes("colour-notation"), `${PAINTER_MODULE} reads the notations from ${COLOUR_NOTATION_MODULE}`).toBe(true);
});

// white-box: AC-4(e) — an unreachable branch answers no probe. That `swatchOf` can no longer be
// asked about nothing, and that no black stands in for an answer it did not have, is a property of
// the text alone: every behavioural reading below is identical with the fallback still there.
test("AC-4(e): the swatch reading takes a non-empty list and states no colour of its own", () => {
  // white-box: AC-4(e) — an unreachable branch answers no probe: that swatchOf can no longer be
  // asked about nothing, and that no black stands in for a reading, is a property of the text.
  const source = readFileSync(join(repoRoot(), MANIFEST_MODULE), "utf8");

  const declared = /function\s+swatchOf\s*\(([\s\S]*?)\)\s*:/.exec(source);
  expect(declared, `${MANIFEST_MODULE} declares swatchOf`).toBeTruthy();
  expect(
    (declared?.[1] ?? "").includes("..."),
    "a first record and the rest — a list that cannot be empty, so there is nothing to fall back from",
  ).toBe(true);

  const body = source.slice(source.indexOf("function swatchOf"));
  const ends = body.indexOf("\n}");
  expect(
    /\[\s*0\s*,\s*0\s*,\s*0\s*\]/.test(body.slice(0, ends === -1 ? undefined : ends)),
    "no [0, 0, 0] stands in for a reading that was never taken — black is a colour drawings really use",
  ).toBe(false);
});

test("AC-4(e): a layer wears the colour most of its records are drawn in", async () => {
  const manifest = await productModule<ManifestSeam>(MANIFEST_MODULE);

  const built = manifest.buildRenderManifest(sheet(), "Model");

  const majority = built.layers.find((found) => found.name === "MAJORITY");
  expect(majority, "the layer something is drawn on is a layer of the manifest").toBeTruthy();
  expect([...(majority?.rgb ?? [])], "two records red against one blue makes the layer red").toEqual([255, 0, 0]);
});

test("AC-4(e): a tie goes to the colour that appeared first, and never to black by default", async () => {
  const manifest = await productModule<ManifestSeam>(MANIFEST_MODULE);

  const built = manifest.buildRenderManifest(sheet(), "Model");

  const tied = built.layers.find((found) => found.name === "TIED");
  expect(tied, "the tied layer is a layer of the manifest").toBeTruthy();
  expect([...(tied?.rgb ?? [])], "one green and one blue: the first appearance wins, and nothing is invented").toEqual([0, 255, 0]);
});
