// AC-5 — rendering and geometry facts (L-CAD-05, L-CAD-01).
//
// Colour is graded as numeric channel triples: R-UI-001's ban on colour literals binds the whole
// tree, so the expected value for a BYLAYER entity is resolved independently — the layer's index
// is read out of the committed DXF's LAYER table and turned into channels through the fixed
// AutoCAD Color Index, never read back off the artifact it is judging.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACI_PALETTE } from "./support/aci-palette";
import {
  allDrawnEntities,
  asArray,
  asNumber,
  asObject,
  asString,
  committedArtifactNames,
  dxfLayerTable,
  FLATTEN_POINT_CAP,
  fixtureDxfPath,
  type JsonValue,
  pointsOf,
  readCommittedArtifact,
  records,
  shoelaceArea,
} from "./support/artifact";

const COLOUR_SOURCES = ["truecolor", "explicit", "bylayer", "byblock"];

/** The entity's colour, read only as far as the contract describes it. */
function colourOf(entity: Record<string, JsonValue>, what: string): { channels: number[]; source: string } {
  const colour = asObject(entity["colour"], `${what}.colour`);
  const channels = asArray(colour["rgb"], `${what}.colour channels`).map((c, i) =>
    asNumber(c, `${what}.colour channel ${i}`),
  );
  return { channels, source: asString(colour["source"], `${what}.colour.source`) };
}

/** Every colour source present anywhere in an artifact. */
function sourcesIn(name: string): Set<string> {
  const { graph } = readCommittedArtifact(name);
  return new Set(allDrawnEntities(graph).map((e, i) => colourOf(e, `${name}#${i}`).source));
}

describe("AC-5: rendering and geometry facts", () => {
  it("AC-5: every drawn entity resolves to a well-formed colour drawn from the closed source enum", () => {
    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const drawn = allDrawnEntities(graph);
      expect(drawn.length, `${name}: nothing to colour`).toBeGreaterThan(0);

      for (const [i, entity] of drawn.entries()) {
        const { channels, source } = colourOf(entity, `${name}#${i}`);
        expect(COLOUR_SOURCES, `${name}#${i}: colour.source "${source}" is outside the closed enum`).toContain(source);
        expect(channels.length, `${name}#${i}: a colour is three channels`).toBe(3);
        for (const channel of channels) {
          expect(Number.isInteger(channel) && channel >= 0 && channel <= 255, `${name}#${i}: channel ${channel} is out of range`).toBe(true);
        }
      }
    }
  });

  it("AC-5: the basic fixture resolves true colour, explicit ACI and BYLAYER; the blocks fixture resolves BYBLOCK", () => {
    const basic = sourcesIn("basic");
    for (const expected of ["truecolor", "explicit", "bylayer"]) {
      expect([...basic], `the basic fixture must carry a ${expected}-resolved entity`).toContain(expected);
    }
    expect([...sourcesIn("blocks")], "the blocks fixture must carry a BYBLOCK-coloured child").toContain("byblock");
  });

  it("AC-5: a BYLAYER entity resolves to its layer's own colour", () => {
    let graded = 0;

    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const layers = dxfLayerTable(readFileSync(fixtureDxfPath(name), "utf8"));

      for (const [i, entity] of allDrawnEntities(graph).entries()) {
        const { channels, source } = colourOf(entity, `${name}#${i}`);
        if (source !== "bylayer") continue;

        const layerName = asString(entity["layer"], `${name}#${i}.layer`);
        const layer = layers.get(layerName);
        expect(layer, `${name}#${i}: layer "${layerName}" is not in the committed DXF's LAYER table`).toBeDefined();

        let expected: readonly number[];
        if (layer!.trueColour !== null) {
          const packed = layer!.trueColour;
          expected = [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
        } else {
          const index = layer!.aci ?? 7;
          expect(index >= 0 && index < ACI_PALETTE.length, `${name}#${i}: layer "${layerName}" has colour index ${index}`).toBe(true);
          expected = ACI_PALETTE[index]!;
        }
        expect(channels, `${name}#${i}: a BYLAYER entity must wear layer "${layerName}"'s own colour`).toEqual([...expected]);
        graded += 1;
      }
    }

    expect(graded, "no BYLAYER entity was graded — the corpus must resolve one (L-CAD-05)").toBeGreaterThan(0);
  });

  it("AC-5: text crosses the seam raw and carries a world height", () => {
    let withEscape = 0;
    let graded = 0;

    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      for (const [i, entity] of allDrawnEntities(graph).entries()) {
        const text = entity["text"];
        if (typeof text !== "string") continue;
        graded += 1;
        const height = asNumber(entity["height"], `${name}#${i}.height`);
        expect(height, `${name}#${i}: text carries a world height`).toBeGreaterThan(0);
        if (text.includes("%%")) withEscape += 1;
      }
    }

    expect(graded, "no text entity was graded — the basic fixture must carry one").toBeGreaterThan(0);
    expect(withEscape, "an AutoCAD %%-escape must survive the seam unstripped (L-CAD-01)").toBeGreaterThan(0);
  });

  it("AC-5: a closed polyline carries closed true and its own shoelace area", () => {
    let graded = 0;

    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      for (const [i, entity] of allDrawnEntities(graph).entries()) {
        if (entity["closed"] !== true || entity["area"] === undefined || entity["area"] === null) continue;
        const points = pointsOf(entity, `${name}#${i}`);
        if (points === null || points.length < 3) continue;
        const area = asNumber(entity["area"], `${name}#${i}.area`);
        const shoelace = shoelaceArea(points);
        expect(shoelace, `${name}#${i}: a degenerate ring cannot prove the area rule`).toBeGreaterThan(0);
        expect(
          Math.abs(area - shoelace) / Math.max(1, shoelace),
          `${name}#${i}: area ${area} is not the shoelace area ${shoelace} of its own points`,
        ).toBeLessThan(1e-9);
        graded += 1;
      }
    }

    expect(graded, "no closed polyline was graded — the basic fixture must carry one").toBeGreaterThan(0);
  });

  it("AC-5: flattening honours the pinned point cap, and a trip is counted in that space", () => {
    let graded = 0;

    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const cappedPerSpace = new Map<string, number>();

      for (const [i, entity] of allDrawnEntities(graph).entries()) {
        const points = pointsOf(entity, `${name}#${i}`);
        if (points === null) continue;
        graded += 1;
        expect(points.length, `${name}#${i}: flattening exceeded the pinned cap of ${FLATTEN_POINT_CAP}`).toBeLessThanOrEqual(
          FLATTEN_POINT_CAP,
        );
        if (points.length === FLATTEN_POINT_CAP) {
          const space = asString(entity["space"], `${name}#${i}.space`);
          cappedPerSpace.set(space, (cappedPerSpace.get(space) ?? 0) + 1);
        }
      }

      for (const [j, counter] of records(graph, "counters").entries()) {
        const space = asString(counter["space"], `${name}.counters[${j}].space`);
        const capped = asObject(counter["flatten_capped"], `${name}.counters[${j}].flatten_capped`);
        let counted = 0;
        for (const [type, value] of Object.entries(capped)) {
          const n = asNumber(value, `${name}.counters[${j}].flatten_capped.${type}`);
          expect(Number.isInteger(n) && n >= 0, `${name}: flatten_capped.${type} is ${n}`).toBe(true);
          counted += n;
        }
        expect(counted, `${name}: space "${space}" flattened ${cappedPerSpace.get(space) ?? 0} entities to the cap but counted ${counted}`).toBeGreaterThanOrEqual(
          cappedPerSpace.get(space) ?? 0,
        );
        cappedPerSpace.delete(space);
      }

      expect([...cappedPerSpace.keys()], `${name}: spaces flattened to the cap with no counters record`).toEqual([]);
    }

    expect(graded, "no flattened geometry was graded — the corpus must carry a curve").toBeGreaterThan(0);
  });
});
