// L-CAD-06's framed regions, stated: a paper sheet's window is a region of model space, the text
// under that window's frame titles it, and a typed caption drawn IN model space outranks the title.
//
// Every artifact here is hand-built and small enough to read: the windows are stated as VIEWPORT
// records the way an inventory states one (L-CAD-05), so what is graded is the rule rather than a
// fixture's arithmetic. The last cases are the freeze: a drawing with no windows mints the same
// views under the same keys as it did before regions were read at all, every entity drawn from
// points of its own lands where it always landed, and the ONE movement AM-01 admits is the original
// the extractor gave no points — which stands with its paint now, wherever it is asked. All of that
// is asserted against the pre-change reading written out in full rather than against a number.
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { REFUSALS } from "@/core/errors";
import { partitionArtifact } from "../assign";
import { VIEW_TYPE, type ViewType } from "../law";

const MODEL_SPACE = "Model";
const SHEET = "S-10 COLUMN LAYOUT PLAN";
const OTHER_SHEET = "S-26 BAR BENDING SCHEDULE";
const LAYER = "S-ANNO";
const CHANNELS = { rgb: [0, 0, 0], source: "explicit" };
const UNREADABLE = REFUSALS.CAPTION_UNCLASSIFIABLE.code;

/** The titles this suite quotes, verbatim as F-RCC6-BNBC's own sheets letter them. */
const PLAN_TITLE = "COLUMN LAYOUT PLAN  SCALE 1:100";
const SECTION_TITLE = "C1 SECTION  SCALE 1:20 (DRAWN x5, DIMLFAC 0.2)";
const UNREADABLE_TITLE = "PILE SET-OUT TABLE  SCALE 1:100";

/** A text of one space: what it says, how tall it stands and where its first point is. */
function text(key: string, space: string, said: string, height: number, at: readonly [number, number]): Record<string, unknown> {
  return { key, type: "TEXT", space, layer: LAYER, colour: CHANNELS, text: said, height, points: [at] };
}

/** A drawn line of model space. */
function line(key: string, from: readonly [number, number], to: readonly [number, number]): Record<string, unknown> {
  return { key, type: "LINE", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, points: [from, to] };
}

/** A block instance: an original the extractor gave no geometry of its own (L-CAD-03). */
function instance(key: string): Record<string, unknown> {
  return { key, type: "INSERT", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS };
}

/** Paint an instance painted, carried by the original it came out of. */
function paint(src: string, points: readonly (readonly [number, number])[]): Record<string, unknown> {
  return { src, type: "LWPOLYLINE", space: MODEL_SPACE, layer: LAYER, colour: CHANNELS, points };
}

/**
 * One window as an inventory states one. The frame is given as the paper rectangle it fills and the
 * model rectangle it looks at, and the VIEWPORT's own fields are derived from those — so a case
 * reads as the two boxes it is about rather than as a centre and a view height (L-CAD-05).
 */
function window(handle: string, paper: readonly [number, number, number, number], model: readonly [number, number, number, number]): Record<string, unknown> {
  return {
    handle,
    on: true,
    twist: 0,
    clipped: false,
    centre: [(paper[0] + paper[2]) / 2, (paper[1] + paper[3]) / 2],
    size: [paper[2] - paper[0], paper[3] - paper[1]],
    view_centre: [(model[0] + model[2]) / 2, (model[1] + model[3]) / 2],
    view_height: model[3] - model[1],
  };
}

/** One paper layout of the built artifact, with the windows it opens. */
function sheet(name: string, viewports: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { name, kind: "paper", bbox: { min: [0, 0], max: [400, 300] }, strays_rejected: 0, viewports };
}

/** An artifact of these layouts, originals and paint — the whole of what a partition reads. */
function artifactOf(layouts: readonly Record<string, unknown>[], entities: readonly Record<string, unknown>[], derived: readonly Record<string, unknown>[] = []): EntityGraph {
  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "regions-test", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: MODEL_SPACE, kind: "model", bbox: { min: [0, 0], max: [1000, 1000] }, strays_rejected: 0 }, ...layouts],
    dropped_layouts: [],
    entities,
    derived,
    block_attributes: [],
    counters: [],
  } as unknown as EntityGraph;
}

/** The one window every simple case is drawn in: paper [10,20]–[110,120] onto model [0,0]–[1000,1000]. */
const PAPER_FRAME = [10, 20, 110, 120] as const;
const MODEL_FRAME = [0, 0, 1000, 1000] as const;

/** The band a title stands in, and the floor it has to reach — stated here as the cases use them. */
const IN_BAND: readonly [number, number] = [20, 16];
const TITLE_HEIGHT = 4;

/** An artifact of one window on one sheet, with whatever else the case draws. */
function oneWindow(entities: readonly Record<string, unknown>[], derived: readonly Record<string, unknown>[] = []): EntityGraph {
  return artifactOf([sheet(SHEET, [window("VP1", PAPER_FRAME, MODEL_FRAME)])], entities, derived);
}

describe("the title rule: what a sheet's own window is captioned by", () => {
  test("the text in the band under a window's frame titles it, and the region owns what the window shows", () => {
    const graph = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND), line("m:1", [400, 400], [600, 600])]);
    const partition = partitionArtifact(graph);

    expect(partition.views.map((view) => view.viewKey), "the window is one view, keyed by the class its title says and the title's own source key").toEqual([`${VIEW_TYPE.LAYOUT_PLAN}:t:1`]);
    expect(partition.views[0], "the view is anchored on the paper text, captioned in the artifact's own words").toMatchObject({
      type: VIEW_TYPE.LAYOUT_PLAN,
      caption: PLAN_TITLE,
      anchorKey: "t:1",
      reason: null,
    });
    expect(partition.assignments.get("m:1"), "the line the window frames belongs to the window's view").toBe(`${VIEW_TYPE.LAYOUT_PLAN}:t:1`);
    expect(partition.framed, "and the stage reports that one view was read off a frame").toBe(1);
  });

  test("two texts in the band: the TALLER titles the window, whatever order they were drawn in", () => {
    const graph = oneWindow([
      // The sheet's own name, lettered smaller and drawn FIRST, so only height can be what decides.
      text("t:1", SHEET, "S-26  BAR BENDING SCHEDULE (SAMPLE)", 3.6, [30, 16]),
      text("t:2", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND),
      line("m:1", [400, 400], [600, 600]),
    ]);
    expect(partitionArtifact(graph).views[0]?.caption, "a sheet titles its windows at one size — the taller of two texts in the band is the title").toBe(PLAN_TITLE);
  });

  test("two texts of the same height in the band: the lower source key, so the reading never drifts", () => {
    const graph = oneWindow([text("t:2", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND), text("t:1", SHEET, UNREADABLE_TITLE, TITLE_HEIGHT, [30, 16]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(graph).views[0]?.anchorKey, "ties go to the lower key: an identical re-derivation reproduces the identical key (L-REG-04)").toBe("t:1");
  });

  test("a text lettered under the title floor titles nothing — it is title-block furniture", () => {
    // The model-frames twin of F-RCC6-BNBC is drawn exactly this way: one window, one paper text at
    // height 3, and nothing on the sheet that titles the frame.
    const graph = oneWindow([text("t:1", SHEET, "F-RCC6-BNBC  MODEL-SPACE FRAMES", 3, IN_BAND), line("m:1", [400, 400], [600, 600])]);
    const partition = partitionArtifact(graph);

    expect(partition.framed, "nothing captions the window, so the window frames no region").toBe(0);
    expect(partition.assignments.get("m:1"), "and what it shows falls to the view no caption anchors").toBe(VIEW_TYPE.UNASSIGNED);
  });

  test("the band has no horizontal pad: a title stands within the width of the frame it titles", () => {
    const outside = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, [PAPER_FRAME[0] - 1, 16]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(outside).framed, "a text beyond the left edge of the frame belongs to whatever stands beside it").toBe(0);

    const inside = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, [PAPER_FRAME[0], 16]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(inside).framed, "and a text on the edge itself is within it").toBe(1);
  });

  test("the band runs under the frame and nowhere else", () => {
    const below = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, [20, PAPER_FRAME[1] - 9]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(below).framed, "a text deeper than the band is the NEXT window's business, not this one's").toBe(0);

    const within = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, [20, PAPER_FRAME[1] - 8]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(within).framed, "a text at the bottom of the band titles the frame above it").toBe(1);

    const above = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, [20, PAPER_FRAME[1] + 1]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(above).framed, "and a text drawn INSIDE the frame is paint of the sheet, not a title of it").toBe(0);
  });

  test("a block attribute never titles a window, however it is lettered", () => {
    const graph = artifactOf([sheet(SHEET, [window("VP1", PAPER_FRAME, MODEL_FRAME)])], [{ key: "t:1", type: "INSERT", space: SHEET, layer: LAYER, colour: CHANNELS, points: [IN_BAND] }, line("m:1", [400, 400], [600, 600])]);
    const withAttribute = { ...graph, block_attributes: [{ src: "t:1", tag: "SHEETTITLE", text: PLAN_TITLE, height: TITLE_HEIGHT }] } as unknown as EntityGraph;
    expect(partitionArtifact(withAttribute).framed, "a title block's own name is not the name of any one window on the sheet (L-CAD-03)").toBe(0);
  });
});

describe("the anchor precedence: what a region is titled BY", () => {
  test("a typed model caption inside the window outranks the title, and its key does not move", () => {
    const graph = oneWindow([
      text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND),
      text("m:cap", MODEL_SPACE, "COLUMN SCHEDULE", 400, [500, 900]),
      text("m:mark", MODEL_SPACE, "C1", 40, [400, 400]),
      line("m:1", [400, 400], [600, 600]),
    ]);
    const partition = partitionArtifact(graph);

    expect(partition.views.map((view) => view.viewKey), "the draughtsman wrote the title into the drawing itself; the frame only decides how far it carries").toEqual([`${VIEW_TYPE.SCHEDULE}:m:cap`]);
    expect(partition.views[0], "so the view is the one the caption competition already read, unmoved").toMatchObject({ type: VIEW_TYPE.SCHEDULE, caption: "COLUMN SCHEDULE", anchorKey: "m:cap" });
    expect(partition.assignments.get("m:1"), "and the window's contents are its own").toBe(`${VIEW_TYPE.SCHEDULE}:m:cap`);
  });

  test("the tallest typed model caption in a window titles it, then the higher, then the lower key", () => {
    const tallest = oneWindow([text("m:a", MODEL_SPACE, "COLUMN SCHEDULE", 400, [500, 900]), text("m:b", MODEL_SPACE, "SECTION A-A", 340, [500, 100]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(tallest).views[0]?.anchorKey, "a sheet titles its views at one size, and the biggest text on it is the title").toBe("m:a");

    const higher = oneWindow([text("m:a", MODEL_SPACE, "SECTION A-A", 400, [500, 100]), text("m:b", MODEL_SPACE, "COLUMN SCHEDULE", 400, [500, 900]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(higher).views[0]?.anchorKey, "two of one size: the higher up the drawing is the one that titles it").toBe("m:b");

    const tied = oneWindow([text("m:b", MODEL_SPACE, "SECTION A-A", 400, [500, 900]), text("m:a", MODEL_SPACE, "COLUMN SCHEDULE", 400, [400, 900]), line("m:1", [400, 400], [600, 600])]);
    expect(partitionArtifact(tied).views[0]?.anchorKey, "and two at one height on one line: the lower source key, forever").toBe("m:a");
  });

  test("an UNTYPED model caption inside a titled region anchors nothing and is content of it", () => {
    const graph = oneWindow([text("t:1", SHEET, SECTION_TITLE, TITLE_HEIGHT, IN_BAND), text("m:mark", MODEL_SPACE, "C1", 400, [500, 900]), line("m:1", [400, 400], [600, 600])]);
    const partition = partitionArtifact(graph);

    expect(partition.views.map((view) => view.viewKey), "an unclassifiable caption TYPES nothing, so the sheet's own title is what says what the view is").toEqual([`${VIEW_TYPE.MEMBER_SECTION}:t:1`]);
    expect(partition.assignments.get("m:mark"), "and the mark itself is a thing drawn in the view, like every other thing in it").toBe(`${VIEW_TYPE.MEMBER_SECTION}:t:1`);
  });

  test("a title the grammar cannot read mints an honestly untyped view, never residue", () => {
    const graph = oneWindow([text("t:1", SHEET, UNREADABLE_TITLE, TITLE_HEIGHT, IN_BAND), line("m:1", [400, 400], [600, 600])]);
    const partition = partitionArtifact(graph);

    expect(partition.views[0], "the window is titled and the grammar is silent about what it says — which is a view, honestly untyped").toMatchObject({
      viewKey: `${VIEW_TYPE.UNTYPED}:t:1`,
      type: VIEW_TYPE.UNTYPED,
      caption: UNREADABLE_TITLE,
      anchorKey: "t:1",
      reason: UNREADABLE,
    });
    expect(partition.assignments.get("m:1"), "and what it frames belongs to it rather than falling to the view nobody could name").toBe(`${VIEW_TYPE.UNTYPED}:t:1`);
  });

  test("a window with no title and no typed model caption frames no region at all", () => {
    const graph = oneWindow([text("m:mark", MODEL_SPACE, "C1", 400, [500, 900]), line("m:1", [400, 400], [600, 600])]);
    const partition = partitionArtifact(graph);

    expect(partition.framed, "nothing captions the window, so the sheet says nothing about this piece of model space").toBe(0);
    expect(partition.assignments.get("m:1"), "and its interior is read the way an untitled drawing has always been read — by the caption nearest it").toBe(`${VIEW_TYPE.UNTYPED}:m:mark`);
  });
});

describe("where an entity stands, and which frame shows it", () => {
  test("an original with no points of its own stands at the CENTRE OF THE BOX its paint occupies", () => {
    // The paint is one long run west and a dense blob east: its vertex MEAN sits in the blob, its
    // box centre sits between the two. Only one of those readings is inside the window.
    const blob = Array.from({ length: 100 }, (_, index) => [1000, index / 100] as const);
    const graph = artifactOf(
      [sheet(SHEET, [window("VP1", PAPER_FRAME, [400, -100, 600, 100])])],
      [text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND), instance("m:ins")],
      [paint("m:ins", [[0, 0], [1000, 0]]), paint("m:ins", blob)],
    );
    expect(partitionArtifact(graph).assignments.get("m:ins"), "a flattened circle's vertices are an artefact of a tolerance; a box has no such opinion (L-CAD-02)").toBe(`${VIEW_TYPE.LAYOUT_PLAN}:t:1`);
  });

  test("an original with no points and no paint stands nowhere, and is honestly unassigned", () => {
    const graph = oneWindow([text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND), instance("m:ins")]);
    const partition = partitionArtifact(graph);

    expect(partition.assignments.get("m:ins"), "nothing in the artifact says where it was drawn, so no frame can be said to show it").toBe(VIEW_TYPE.UNASSIGNED);
    expect(partition.views.some((view) => view.viewKey === VIEW_TYPE.UNASSIGNED), "and the view with no caption exists, because something is really in it").toBe(true);
  });

  test("two windows showing one point: the tighter frame, then the lower viewport handle", () => {
    const wide = window("VP2", [200, 20, 300, 120], [0, 0, 1000, 1000]);
    const tight = window("VP1", [10, 20, 110, 120], [400, 400, 600, 600]);
    const graph = artifactOf(
      [sheet(SHEET, [wide, tight])],
      [text("t:1", SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND), text("t:2", SHEET, UNREADABLE_TITLE, TITLE_HEIGHT, [210, 16]), line("m:1", [490, 490], [510, 510])],
    );
    expect(partitionArtifact(graph).assignments.get("m:1"), "the tighter of two frames is the closest the sheet comes to saying 'this one'").toBe(`${VIEW_TYPE.LAYOUT_PLAN}:t:1`);

    const twinned = artifactOf(
      [sheet(SHEET, [window("VP2", [200, 20, 300, 120], [400, 400, 600, 600])]), sheet(OTHER_SHEET, [window("VP1", [10, 20, 110, 120], [400, 400, 600, 600])])],
      [text("t:2", SHEET, UNREADABLE_TITLE, TITLE_HEIGHT, [210, 16]), text("t:1", OTHER_SHEET, PLAN_TITLE, TITLE_HEIGHT, IN_BAND), line("m:1", [490, 490], [510, 510])],
    );
    expect(partitionArtifact(twinned).assignments.get("m:1"), "and two frames of one size are told apart by the handle, so the same artifact partitions the same way forever").toBe(`${VIEW_TYPE.LAYOUT_PLAN}:t:1`);
  });
});

/* ------------------------------------------------------- the freeze: a drawing with no windows */

/** How tall a text has to stand, as a share of the tallest in model space, to be a caption. */
const CAPTION_HEIGHT_SHARE = 0.8;

/** How far a caption reaches at least, in multiples of its own height. */
const CAPTION_REACH_IN_HEIGHTS = 30;

type Point = readonly [number, number];
type Drawn = EntityGraph["entities"][number];

/** Where an entity stands, as the reading before regions read it: the mean of its own points. */
function centreOf(entity: Drawn): Point | null {
  const points = entity.points ?? [];
  if (points.length === 0) return null;
  const summed = points.reduce<[number, number]>((held, point) => [held[0] + point[0], held[1] + point[1]], [0, 0]);
  return [summed[0] / points.length, summed[1] / points.length];
}

/**
 * The partition as this module read one BEFORE regions were read: every caption of model space
 * mints a view, every other entity joins the view whose caption stands nearest within that
 * caption's reach, and whatever no caption reaches joins the view with no caption.
 *
 * Written out in full rather than imported, because what AM-01 needs held is the BEHAVIOUR of the
 * reading F-RCC6 was frozen under — an assertion against today's code, whatever today's code is,
 * would hold nothing at all.
 */
function partitionedTheOldWay(graph: EntityGraph): { views: { viewKey: string; type: ViewType; reason: string | null; caption: string; anchorKey: string | null }[]; assignments: Map<string, string> } {
  const modelSpace = graph.layouts.find((layout) => layout.kind === "model")?.name;
  if (modelSpace === undefined) return { views: [], assignments: new Map() };
  const standing = graph.entities.filter((entity) => entity.space === modelSpace);

  const texts = standing.filter((entity) => (entity.text ?? "").trim() !== "" && (entity.height ?? 0) > 0 && (entity.points ?? []).length > 0);
  const tallest = texts.reduce((held, entity) => Math.max(held, entity.height ?? 0), 0);
  const captions = tallest === 0 ? [] : texts.filter((entity) => (entity.height ?? 0) >= tallest * CAPTION_HEIGHT_SHARE);

  const views = new Map<string, { viewKey: string; type: ViewType; reason: string | null; caption: string; anchorKey: string | null }>();
  const placed: { viewKey: string; at: Point; height: number }[] = [];
  for (const caption of captions) {
    const said = classifiedBySpellings(caption.text ?? "");
    const viewKey = `${said.type}:${caption.key}`;
    views.set(viewKey, { viewKey, type: said.type, reason: said.reason, caption: (caption.text ?? "").trim(), anchorKey: caption.key });
    const at = centreOf(caption);
    if (at !== null) placed.push({ viewKey, at, height: caption.height ?? 0 });
  }
  const anchors = placed.map((caption) => {
    const floor = caption.height * CAPTION_REACH_IN_HEIGHTS;
    const neighbours = placed.filter((other) => other !== caption).map((other) => Math.hypot(caption.at[0] - other.at[0], caption.at[1] - other.at[1]));
    return { viewKey: caption.viewKey, at: caption.at, reach: neighbours.length === 0 ? floor : Math.max(floor, Math.min(...neighbours)) };
  });

  const assignments = new Map<string, string>();
  let anchorless = false;
  for (const entity of standing) {
    const at = centreOf(entity);
    let held: { viewKey: string; distance: number } | null = null;
    for (const anchor of at === null ? [] : anchors) {
      const distance = Math.hypot((at as Point)[0] - anchor.at[0], (at as Point)[1] - anchor.at[1]);
      if (distance > anchor.reach) continue;
      if (held === null || distance < held.distance || (distance === held.distance && anchor.viewKey < held.viewKey)) held = { viewKey: anchor.viewKey, distance };
    }
    if (held === null) anchorless = true;
    assignments.set(entity.key, held?.viewKey ?? VIEW_TYPE.UNASSIGNED);
  }
  if (anchorless) views.set(VIEW_TYPE.UNASSIGNED, { viewKey: VIEW_TYPE.UNASSIGNED, type: VIEW_TYPE.UNASSIGNED, reason: null, caption: "", anchorKey: null });

  return { views: [...views.values()].sort((left, right) => (left.viewKey < right.viewKey ? -1 : left.viewKey > right.viewKey ? 1 : 0)), assignments };
}

/** The classes this freeze's own captions say, read off the words — the grammar's own answer. */
function classifiedBySpellings(caption: string): { type: ViewType; reason: string | null } {
  const words = new Set(caption.toUpperCase().split(/[^A-Z0-9]+/u).filter((word) => word !== ""));
  if (words.has(VIEW_TYPE.SCHEDULE)) return { type: VIEW_TYPE.SCHEDULE, reason: null };
  if (words.has("NOTES")) return { type: VIEW_TYPE.LEGEND_NOTES, reason: null };
  if (words.has("PLAN")) return { type: VIEW_TYPE.LAYOUT_PLAN, reason: null };
  if (words.has("SECTION")) return { type: VIEW_TYPE.MEMBER_SECTION, reason: null };
  return { type: VIEW_TYPE.UNTYPED, reason: UNREADABLE };
}

describe("AM-01: a drawing with no windows, against the reading it was frozen under", () => {
  /**
   * F-RCC6's shape: several captioned clusters in model space, one stray no caption reaches, one
   * original the extractor gave no points of its own but real paint — F-RCC6 carries 29 of those,
   * every one of them a DIMENSION — paper layouts that carry their own title texts, and, the whole
   * point, no VIEWPORT anywhere. Its artifact really is drawn this way: 9 layouts, 8 paper titles,
   * zero windows.
   */
  const FROZEN = artifactOf(
    [
      { name: "S-01", kind: "paper", bbox: { min: [0, 0], max: [400, 300] }, strays_rejected: 0, viewports: [] },
      { name: "S-02", kind: "paper", bbox: { min: [0, 0], max: [400, 300] }, strays_rejected: 0 },
    ],
    [
      text("m:a", MODEL_SPACE, "FOUNDATION PLAN", 60, [0, 0]),
      text("m:b", MODEL_SPACE, "COLUMN SCHEDULE", 60, [4000, 0]),
      text("m:c", MODEL_SPACE, "GENERAL NOTES", 50, [8000, 0]),
      text("m:d", MODEL_SPACE, "C1", 10, [100, -100]),
      line("m:1", [100, -100], [200, -200]),
      line("m:2", [4100, -100], [4200, -200]),
      line("m:3", [40000, 40000], [40100, 40100]),
      instance("m:ins"),
      // The paper sheets letter their own titles, tall, exactly as F-RCC6 does — and title nothing,
      // because no window on either sheet frames any of it.
      text("p:1", "S-01", "FOUNDATION PLAN", 6, [20, 16]),
      text("p:2", "S-02", "COLUMN SCHEDULE", 6, [20, 16]),
    ],
    [paint("m:ins", [[100, -100], [120, -120]])],
  );

  test("AM-01: the views and their keys are the pre-change reading's, and every entity drawn from its own points lands where it always did", () => {
    const partition = partitionArtifact(FROZEN);
    const before = partitionedTheOldWay(FROZEN);

    expect(partition.views, "a drawing with no windows frames no region, so its views are the views the reading it was frozen under mints — the same keys, the same captions, the same classes").toEqual(
      before.views,
    );

    const pointed = FROZEN.entities.filter((entity) => entity.space === MODEL_SPACE && (entity.points ?? []).length > 0).map((entity) => entity.key);
    expect(pointed.length, "and the artifact really is mostly drawn from points: a freeze over one entity would hold nothing").toBeGreaterThan(5);
    expect(
      pointed.map((key) => `${key} → ${partition.assignments.get(key)}`),
      "an entity with points of its own is judged at the same centroid it was always judged at, so it lands in the view it has always landed in — AM-01 is a statement about the ANSWER, not about a count",
    ).toEqual(pointed.map((key) => `${key} → ${before.assignments.get(key)}`));

    expect(partition.framed, "nothing was framed").toBe(0);
  });

  test("AM-01: the one movement — the original with no points of its own stands with its paint, and nothing else moves", () => {
    const partition = partitionArtifact(FROZEN);
    const before = partitionedTheOldWay(FROZEN);

    const moved = [...partition.assignments.entries()].filter(([key, viewKey]) => before.assignments.get(key) !== viewKey);
    expect(
      moved.map(([key, viewKey]) => `${key}: ${before.assignments.get(key)} → ${viewKey}`),
      "the caption competition reads an entity where the frame test reads it, so exactly one entity moves: the instance the extractor gave no geometry of its own (L-CAD-03, L-CAD-06)",
    ).toEqual([`m:ins: ${VIEW_TYPE.UNASSIGNED} → ${VIEW_TYPE.LAYOUT_PLAN}:m:a`]);

    // Its paint is drawn [100,-100]–[120,-120], whose box centre stands 156 units from FOUNDATION
    // PLAN and 3,892 from COLUMN SCHEDULE — both within reach, and the nearer is the one it joins.
    expect(partition.assignments.get("m:ins"), "the instance joins the view whose caption stands nearest the centre of the box its paint occupies").toBe(`${VIEW_TYPE.LAYOUT_PLAN}:m:a`);
    expect(partition.assignments.get("m:1"), "which is the view the line drawn through that same piece of the drawing belongs to").toBe(`${VIEW_TYPE.LAYOUT_PLAN}:m:a`);
    expect(
      partition.views.some((view) => view.viewKey === VIEW_TYPE.UNASSIGNED),
      "and the anchorless view is still here, because the stray no caption reaches is still really in it — it is the pointless original that left, not the view that was abolished",
    ).toBe(true);
  });

  test("AM-01: an original with no points and no paint stays unassigned — nothing says where it is", () => {
    const withBare = artifactOf(
      [],
      [text("m:a", MODEL_SPACE, "FOUNDATION PLAN", 60, [0, 0]), text("m:b", MODEL_SPACE, "COLUMN SCHEDULE", 60, [4000, 0]), instance("m:painted"), instance("m:bare")],
      // The paint runs west from [200,0] to [3000,0] with a dense blob at its east end: its box
      // centre is [1600,0] and its vertex MEAN is [2972.5,…], and the two stand on opposite sides of
      // the halfway line between the captions. Only the BOX reading puts it in FOUNDATION PLAN.
      [paint("m:painted", [[200, 0], [3000, 0]]), paint("m:painted", Array.from({ length: 100 }, (_unused, index) => [3000, index / 100] as const))],
    );
    const partition = partitionArtifact(withBare);

    expect(partition.assignments.get("m:painted"), "where an instance STANDS is where its paint stands, read as a box: a flattened circle's vertices are an artefact of a tolerance (L-CAD-02, L-CAD-03)").toBe(
      `${VIEW_TYPE.LAYOUT_PLAN}:m:a`,
    );
    expect(partition.assignments.get("m:bare"), "and an original with no points and no paint stands nowhere at all, so no caption can be said to reach it").toBe(VIEW_TYPE.UNASSIGNED);
    expect(partition.views.some((view) => view.viewKey === VIEW_TYPE.UNASSIGNED), "the view with no caption exists, because something is really in it").toBe(true);
  });

  test("AM-01: a tall paper title with no window under it captions nothing", () => {
    const partition = partitionArtifact(FROZEN);
    expect(partition.views.map((view) => view.anchorKey).filter((key) => key !== null && key.startsWith("p:")), "a region is read off a FRAME; a sheet with no window onto model space frames none").toEqual([]);
  });
});
