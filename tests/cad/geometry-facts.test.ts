// AC-5 — rendering and geometry facts (L-CAD-05, L-CAD-01).
//
// Colour is graded as numeric channel triples: R-UI-001's ban on colour literals binds the whole
// tree, so the expected value for a BYLAYER entity is resolved independently — the layer's index
// is read out of the committed DXF's LAYER table and turned into channels through the fixed
// AutoCAD Color Index, never read back off the artifact it is judging.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ACI_PALETTE } from "./support/aci-palette";
import {
  allDrawnEntities,
  asArray,
  asNumber,
  asObject,
  asString,
  committedArtifactNames,
  dxfLayerTable,
  type DxfRecord,
  dxfRecordsByHandle,
  FLATTEN_CAP_TRIP_DXF,
  FLATTEN_POINT_CAP,
  dxfPairs,
  fixtureDxfPath,
  handleOfKey,
  type JsonValue,
  normaliseHandle,
  pointsOf,
  readCommittedArtifact,
  records,
  requireCadPackage,
  runIngest,
  shoelaceArea,
  unpackTrueColour,
} from "./support/artifact";

const COLOUR_SOURCES = ["truecolor", "explicit", "bylayer", "byblock"];

/** The colour indices that do not name a palette entry: 0 is BYBLOCK, 256 is BYLAYER. */
const BYBLOCK_INDEX = 0;
const BYLAYER_INDEX = 256;

const scratchDirs: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), "cubit-cad-ac5-"));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/**
 * Every original entity of every committed artifact, paired with the record its source key names in
 * its own DXF. The pairing is what makes a colour assertion bind: the expected value is decoded from
 * the drawing's group codes, never read back off the artifact being judged.
 */
function originalsAgainstTheirDxf(): { what: string; entity: Record<string, JsonValue>; record: DxfRecord }[] {
  const paired: { what: string; entity: Record<string, JsonValue>; record: DxfRecord }[] = [];
  for (const name of committedArtifactNames()) {
    const table = dxfRecordsByHandle(readFileSync(fixtureDxfPath(name), "utf8"));
    for (const [i, entity] of records(readCommittedArtifact(name).graph, "entities").entries()) {
      const what = `${name}.entities[${i}]`;
      const handle = handleOfKey(asString(entity["key"], `${what}.key`));
      const record = handle === null ? undefined : table.get(handle);
      if (record === undefined) continue;
      paired.push({ what, entity, record });
    }
  }
  return paired;
}

/** The entity's colour, read only as far as the contract describes it. */
function colourOf(entity: Record<string, JsonValue>, what: string): { channels: number[]; source: string } {
  const colour = asObject(entity["colour"], `${what}.colour`);
  const channels = asArray(colour["rgb"], `${what}.colour channels`).map((c, i) =>
    asNumber(c, `${what}.colour channel ${i}`),
  );
  return { channels, source: asString(colour["source"], `${what}.colour.source`) };
}

/**
 * Every handle-bearing record in a committed DXF's ENTITIES and BLOCKS sections, with every group
 * code it states — the independent read the v3 facts below are bound to. First value per code, as
 * the colour reads take them: a record's own groups come before any of its subclass repeats.
 */
function dxfGroupsByHandle(text: string): Map<string, { type: string; groups: Map<number, string> }> {
  const pairs = dxfPairs(text);
  const table = new Map<string, { type: string; groups: Map<number, string> }>();
  let section: string | null = null;
  for (let i = 0; i < pairs.length; i += 1) {
    const head = pairs[i]!;
    if (head.code !== 0) continue;
    if (head.value === "SECTION") {
      const next = pairs[i + 1];
      section = next !== undefined && next.code === 2 ? next.value : null;
      continue;
    }
    if (section !== "ENTITIES" && section !== "BLOCKS") continue;
    const groups = new Map<number, string>();
    for (let j = i + 1; j < pairs.length && pairs[j]!.code !== 0; j += 1) {
      const { code, value } = pairs[j]!;
      if (!groups.has(code)) groups.set(code, value);
    }
    const handle = groups.get(5);
    if (handle !== undefined) table.set(normaliseHandle(handle), { type: head.value, groups });
  }
  return table;
}

/** A group's number, or the DXF default the drawing leaves it at when it states none. */
function groupNumber(groups: Map<number, string>, code: number, fallback: number): number {
  const stated = groups.get(code);
  return stated === undefined ? fallback : Number(stated);
}

/** An angle in counter-clockwise degrees, normalised to [0, 360) as the artifact spells one. */
function turn(degrees: number): number {
  const turned = Math.round((((degrees % 360) + 360) % 360) * 1e9) / 1e9;
  return turned >= 360 ? 0 : turned;
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

  it("AC-5: a true-colour entity resolves to the 24-bit colour its own DXF record carries", () => {
    // The classification alone is cheap to fake — a resolver can read group 420's *presence*, label
    // the entity "truecolor" and emit any in-range triple. So the expected channels are decoded from
    // the packed group-420 integer in the committed DXF, the same independent read the BYLAYER check
    // makes of the LAYER table.
    let graded = 0;

    for (const { what, entity, record } of originalsAgainstTheirDxf()) {
      const { channels, source } = colourOf(entity, what);
      if (source !== "truecolor") continue;
      expect(
        record.trueColour,
        `${what}: resolved as "truecolor", but its DXF ${record.type} carries no group-420 true colour`,
      ).not.toBeNull();
      expect(channels, `${what}: a true-colour entity wears the 24-bit colour packed in its own group 420`).toEqual([
        ...unpackTrueColour(record.trueColour!),
      ]);
      graded += 1;
    }

    expect(graded, "no true-colour entity was bound to its own group 420 — the basic fixture must carry one").toBeGreaterThan(0);
  });

  it("AC-5: an explicit-ACI entity resolves through the AutoCAD Color Index its own group 62 names", () => {
    let graded = 0;

    for (const { what, entity, record } of originalsAgainstTheirDxf()) {
      const { channels, source } = colourOf(entity, what);
      if (source !== "explicit") continue;
      expect(record.aci, `${what}: resolved as "explicit", but its DXF ${record.type} carries no group-62 colour index`).not.toBeNull();
      const index = record.aci!;
      expect(
        index !== BYBLOCK_INDEX && index !== BYLAYER_INDEX,
        `${what}: colour index ${index} is BYBLOCK/BYLAYER, not an explicit colour`,
      ).toBe(true);
      expect(index < ACI_PALETTE.length, `${what}: colour index ${index} is outside the AutoCAD Color Index`).toBe(true);
      expect(channels, `${what}: an explicitly indexed entity wears index ${index}'s colour`).toEqual([...ACI_PALETTE[index]!]);
      graded += 1;
    }

    expect(graded, "no explicitly indexed entity was resolved through the palette — the basic fixture must carry one").toBeGreaterThan(0);
  });

  it("AC-5: a BYBLOCK entity wears the resolved colour of the instance that painted it", () => {
    // BYBLOCK is the last link of L-CAD-05's chain: it names no colour of its own, so it takes the
    // colour of the block reference it was painted by — the entity its `src` names, whose own colour
    // the true-colour / explicit / BYLAYER checks above have already bound to the drawing.
    let graded = 0;

    for (const name of committedArtifactNames()) {
      const { graph } = readCommittedArtifact(name);
      const originals = records(graph, "entities");
      const byKey = new Map(originals.map((e, i) => [asString(e["key"], `${name}.entities[${i}].key`), e]));

      for (const [i, entity] of allDrawnEntities(graph).entries()) {
        const what = `${name}#${i}`;
        const { channels, source } = colourOf(entity, what);
        if (source !== "byblock") continue;

        const src = entity["src"];
        expect(typeof src, `${what}: a BYBLOCK entity is painted by an instance, so it carries that instance's key in src`).toBe("string");
        const parent = byKey.get(src as string);
        expect(parent, `${what}: src ${String(src)} names no original entity to inherit a colour from`).toBeDefined();
        expect(
          channels,
          `${what}: BYBLOCK resolves to the colour of the instance ${String(src)}, not to a colour of its own`,
        ).toEqual(colourOf(parent!, `${what}.parent`).channels);
        graded += 1;
      }
    }

    expect(graded, "no BYBLOCK entity was resolved — the blocks fixture must carry a BYBLOCK-coloured child").toBeGreaterThan(0);
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

  it("AC-5 (v3): a text carries the rotation and alignment its own DXF record states", () => {
    // Bound to the group codes, never read back off the artifact: TEXT states its angle in group 50
    // and its alignment in 72/73; MTEXT its angle in 50 or, outranking it, its direction in 11/21,
    // and its attachment point in 71. Every committed drawing is extruded +Z, so the OCS is the world.
    const graded = { TEXT: 0, MTEXT: 0 };
    for (const name of committedArtifactNames()) {
      const table = dxfGroupsByHandle(readFileSync(fixtureDxfPath(name), "utf8"));
      for (const [i, entity] of records(readCommittedArtifact(name).graph, "entities").entries()) {
        const what = `${name}.entities[${i}]`;
        const type = asString(entity["type"], `${what}.type`);
        if (type !== "TEXT" && type !== "MTEXT") continue;
        const handle = handleOfKey(asString(entity["key"], `${what}.key`));
        const stated = handle === null ? undefined : table.get(handle);
        expect(stated, `${what}: its handle names no record in ${name}.dxf`).toBeDefined();
        const groups = stated!.groups;

        if (type === "TEXT") {
          expect(entity["rotation"], `${what}: group 50, counter-clockwise, in [0, 360)`).toBe(turn(groupNumber(groups, 50, 0)));
          expect(entity["halign"], `${what}: group 72`).toBe(groupNumber(groups, 72, 0));
          expect(entity["valign"], `${what}: group 73`).toBe(groupNumber(groups, 73, 0));
        } else {
          const directed = groups.has(11);
          const expected = directed ? (Math.atan2(groupNumber(groups, 21, 0), groupNumber(groups, 11, 1)) * 180) / Math.PI : groupNumber(groups, 50, 0);
          expect(entity["rotation"], `${what}: ${directed ? "the direction in 11/21" : "group 50"}`).toBe(turn(expected));
          expect(entity["attachment"], `${what}: group 71`).toBe(groupNumber(groups, 71, 1));
        }
        graded[type] += 1;
      }
    }
    expect(graded.TEXT, "no TEXT was graded — the basic fixture must carry one").toBeGreaterThan(0);
    expect(graded.MTEXT, "no MTEXT was graded — the basic fixture must carry one").toBeGreaterThan(0);
  });

  it("AC-5 (v3): a block reference carries the block and the placement its own DXF record states", () => {
    let graded = 0;
    for (const name of committedArtifactNames()) {
      const table = dxfGroupsByHandle(readFileSync(fixtureDxfPath(name), "utf8"));
      for (const [i, entity] of records(readCommittedArtifact(name).graph, "entities").entries()) {
        if (entity["type"] !== "INSERT") continue;
        const what = `${name}.entities[${i}]`;
        const groups = table.get(handleOfKey(asString(entity["key"], `${what}.key`)) ?? "")?.groups;
        expect(groups, `${what}: its handle names no record in ${name}.dxf`).toBeDefined();
        const block = asObject(entity["block"], `${what}.block`);
        const [sx, sy] = [groupNumber(groups!, 41, 1), groupNumber(groups!, 42, 1)];
        // Canonical: a negative x scale is the block's x axis turned half a turn, mirrored.
        const rotation = turn(groupNumber(groups!, 50, 0) + (sx < 0 ? 180 : 0));
        expect(block["name"], `${what}: group 2`).toBe(groups!.get(2));
        expect(block["at"], `${what}: groups 10/20`).toEqual([groupNumber(groups!, 10, 0), groupNumber(groups!, 20, 0)]);
        expect(block["rotation"], `${what}: group 50`).toBe(rotation);
        expect(block["scale"], `${what}: groups 41/42, as lengths`).toEqual([Math.abs(sx), Math.abs(sy)]);
        expect(block["mirrored"], `${what}: a reference mirrors its block where its scales disagree in sign`).toBe(sx * sy < 0);
        graded += 1;
      }
    }
    expect(graded, "no block reference was graded — the blocks fixture must carry one").toBeGreaterThan(0);
  });

  it("AC-5 (v3): the layer table travels as the drawing states it — on, frozen, plotted", () => {
    // Group 62 negative is a layer switched off; group 70 bit 1 is frozen; group 290 0 is not plotted.
    let unplotted = 0;
    for (const name of committedArtifactNames()) {
      const pairs = dxfPairs(readFileSync(fixtureDxfPath(name), "utf8"));
      const stated = new Map<string, { on: boolean; frozen: boolean; plot: boolean }>();
      for (let i = 0; i < pairs.length; i += 1) {
        if (pairs[i]!.code !== 0 || pairs[i]!.value !== "LAYER") continue;
        const groups = new Map<number, string>();
        for (let j = i + 1; j < pairs.length && pairs[j]!.code !== 0; j += 1) if (!groups.has(pairs[j]!.code)) groups.set(pairs[j]!.code, pairs[j]!.value);
        const layerName = groups.get(2);
        if (layerName === undefined) continue;
        stated.set(layerName, { on: groupNumber(groups, 62, 7) >= 0, frozen: (groupNumber(groups, 70, 0) & 1) === 1, plot: groupNumber(groups, 290, 1) !== 0 });
      }
      const carried = records(readCommittedArtifact(name).graph, "layers");
      expect(carried.map((layer) => layer["name"]), `${name}: the layer table, in its own order`).toEqual([...stated.keys()]);
      for (const layer of carried) {
        const layerName = asString(layer["name"], `${name}.layers[].name`);
        expect({ on: layer["on"], frozen: layer["frozen"], plot: layer["plot"] }, `${name}: layer ${layerName}`).toEqual(stated.get(layerName));
        if (layer["plot"] === false) unplotted += 1;
      }
    }
    expect(unplotted, "Defpoints is never plotted, and every committed drawing carries it").toBeGreaterThan(0);
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

  it("AC-5: a curve that outruns the pinned point cap is truncated at it, and the trip is counted", () => {
    // The rule above is only exercised if some curve actually reaches the cap, and nothing obliges
    // the committed corpus to hold one. So this drives the shipped CLI over a drawing written here
    // for the purpose: one 359° arc of radius 1e7, which cannot be described within 0.01 units in
    // 5000 points. The trip must both truncate the geometry and be counted (L-CAD-05, R-TO-001).
    requireCadPackage();
    const dir = scratch();
    const input = join(dir, "flatten-cap.dxf");
    writeFileSync(input, FLATTEN_CAP_TRIP_DXF, "utf8");
    const out = join(dir, "flatten-cap.entitygraph.json");

    const run = runIngest(input, out);
    expect(run.status, `ingest of the cap-trip drawing exited ${run.status}\n${run.stdout}\n${run.stderr}`).toBe(0);
    const graph = asObject(JSON.parse(readFileSync(out, "utf8")) as JsonValue, "the cap-trip artifact");

    const flattened = allDrawnEntities(graph)
      .map((entity, i) => ({ entity, points: pointsOf(entity, `cap-trip#${i}`) }))
      .filter((f): f is { entity: Record<string, JsonValue>; points: [number, number][] } => f.points !== null);
    expect(flattened.length, "the arc must reach the artifact as flattened geometry").toBeGreaterThan(0);

    const longest = flattened.reduce((a, b) => (b.points.length > a.points.length ? b : a));
    expect(
      longest.points.length,
      `flattening produced ${longest.points.length} points, past the pinned cap of ${FLATTEN_POINT_CAP}`,
    ).toBeLessThanOrEqual(FLATTEN_POINT_CAP);
    expect(
      longest.points.length,
      `an arc needing tens of thousands of points at the pinned 0.01 tolerance flattened to only ${longest.points.length} — the cap truncates at ${FLATTEN_POINT_CAP}`,
    ).toBeGreaterThanOrEqual(FLATTEN_POINT_CAP - 1);

    const space = asString(longest.entity["space"], "the capped entity's space");
    const here = records(graph, "counters").filter((counter) => counter["space"] === space);
    expect(here.length, `counters carries ${here.length} records for space "${space}"`).toBe(1);
    const capped = Object.entries(asObject(here[0]!["flatten_capped"], `counters(${space}).flatten_capped`)).reduce(
      (total, [type, value]) => total + asNumber(value, `counters(${space}).flatten_capped.${type}`),
      0,
    );
    expect(capped, `a curve truncated at the point cap must be counted in space "${space}"'s flatten_capped`).toBeGreaterThan(0);
  }, 600_000);
});
