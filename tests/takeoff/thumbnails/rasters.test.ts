/**
 * AC-1 … AC-3 — sheet rasters end to end (R-SPINE-022, R-SPINE-021, SEAM-JOBS, Q-12).
 *
 * One job renders every sheet an ingest record's EntityGraph carries, at every tier the seam
 * declares; every raster BEARS THAT SHEET'S OWN GEOMETRY; every raster is stored at its own address
 * and recorded once; one read door answers the signed URLs a sheet card will render from; and the
 * door that asks for the work refuses what is not this workspace's and what has never been ingested.
 *
 * WHAT A RASTER IS. R-SPINE-022 spends these on the sheet index and the viewer background, and a
 * raster is OF a sheet: a PNG of the right size at the right address depicts nothing on its own, so
 * AC-1 decodes the stored bytes and holds the ink to where the record's own artifact says that
 * sheet's geometry reaches. Two limits on that, both deliberate: the Bible fixes no palette, so the
 * paper is derived from each raster (the colour most of it is) and ink is simply "not the paper" —
 * never a colour spelled here; and every number the ink is judged against comes from the corpus, so
 * there is no golden hash, no transcribed pixel count and no snapshot of today's bytes (B-19).
 *
 * Everything is driven through names the increment publishes. The ingest record the rasters are of
 * is written by the shipped ingest job over the committed `<fixture>.entitygraph.json` artifact
 * (`stageIngested`), so the sheets under test are the corpus's own rather than an invention here.
 *
 * READING RECORDED HERE (AC-3's "whose payload is …"): a queued job's payload is not readable
 * through SEAM-JOBS' log — `jobEvents` carries the kind, the key, the steps and the ending, never
 * the payload. It IS readable at the one place the seam hands a payload over: the handler a process
 * registers for the kind (`registerJobHandler`, SEAM-JOBS' published door). This file registers a
 * stand-in handler for the thumbnails kind and reads the payload the runtime delivers to it. The
 * stand-in holds the attempt open until it is released, which is what makes "a second request while
 * that job is queued" a settled state to ask about rather than a race. The rendering itself is
 * judged by AC-1, which runs the shipped `runThumbnailsJob` directly.
 */
import { afterAll, describe, expect, test } from "vitest";
import { waitUntil } from "../../jobs/support/jobs-acceptance";
import { closeStage, type Person } from "../../spine/uploads/support/upload-stage";
import { cadFixture, productModule, sha256Of, stageDrawing, tempDir, unique, type IngestRecord, type ProgressLike, type StagedDrawing } from "../support/ingest-stage";
import {
  artifactOf,
  bboxSpansOf,
  byCodePoint,
  drawnExtentOf,
  ERRORS_MODULE,
  fittedCanvas,
  inkOf,
  inRasterOrder,
  JOBS_MODULE,
  openThumbnailsStage,
  pngHeader,
  RASTER_NOT_AVAILABLE,
  RASTER_STEPS,
  rasterKey,
  stageIngested,
  stagePerson,
  stepOrder,
  storageOf,
  THUMBNAILS_HANDLER_MODULE,
  THUMBNAILS_MODULE,
  WORKSPACE_PERMISSION_NOT_HELD,
  type ArtifactGraph,
  type ArtifactLayout,
  type Ink,
  type JobsLike,
  type SheetRasterRecord,
  type StorageLike,
  type ThumbnailsHandlerModule,
  type ThumbnailsSeam,
  type UnitBox,
} from "../support/thumbnails-stage";

/** The tiers and their long edges, as the test contract fixes them (C-05: constants). */
const TIERS = ["thumb", "preview", "full"] as const;
const LONG_EDGE: Readonly<Record<string, number>> = Object.freeze({ thumb: 256, preview: 1024, full: 2048 });
const KIND = "thumbnails";
const LIFETIME_SECONDS = 900;

/** How long one staged case may take: a scratch database, a sign-up and an ingest of a committed artifact. */
const CASE_BUDGET_MS = 300_000;

/** How long the queue has to hand a job it accepted to the process consuming its kind. */
const DELIVERY_BUDGET_MS = 120_000;

/** What the stand-in handler was handed, in the order the runtime handed it over. */
type Delivered = { jobId: string; payload: unknown };

const delivered: Delivered[] = [];
const gates = new Map<string, () => void>();

/**
 * Record what the queue delivered, and hold a real request's attempt open until this file releases
 * it. A key probe (whose payload names no record to render) is let go at once, so nothing of this
 * file's making is still holding the kind's one slot when the runtime is stopped.
 */
async function standIn(payload: unknown, progress: ProgressLike): Promise<void> {
  const jobId = progress.jobId ?? "";
  delivered.push({ jobId, payload });
  const asks = typeof payload === "object" && payload !== null && "ingestId" in payload;
  if (asks) await new Promise<void>((open) => gates.set(jobId, open));
}

/** Let a held attempt finish. */
function release(jobId: string): void {
  gates.get(jobId)?.();
  gates.delete(jobId);
}

interface Staged {
  thumbnails: ThumbnailsSeam;
  jobs: JobsLike;
  storage: StorageLike;
  person: Person;
  projectId: string;
  root: string;
}

let staging: Promise<Staged> | undefined;
let stopRuntime: (() => Promise<unknown>) | undefined;

/** Staged lazily and memoised: a throwing hook leaves every case skipped, and judges nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    for (const declared of [THUMBNAILS_MODULE, THUMBNAILS_HANDLER_MODULE]) await productModule(declared);

    const { urlMigrate, root } = await openThumbnailsStage();
    const { person, projectId } = await stagePerson("thumbnails");

    const thumbnails = await productModule<ThumbnailsSeam>(THUMBNAILS_MODULE);
    const handler = await productModule<ThumbnailsHandlerModule>(THUMBNAILS_HANDLER_MODULE);
    expect(typeof handler.registerThumbnailsHandler, `${THUMBNAILS_HANDLER_MODULE} exports registerThumbnailsHandler — it is the composition root the worker calls`).toBe("function");

    const jobs = await productModule<JobsLike>(JOBS_MODULE);
    jobs.registerJobHandler(thumbnails.THUMBNAILS_KIND, standIn);
    await jobs.startJobsRuntime(urlMigrate);
    stopRuntime = jobs.stopJobsRuntime;

    return { thumbnails, jobs, storage: await storageOf(), person, projectId, root };
  })());
}

afterAll(async () => {
  for (const open of [...gates.values()]) open();
  gates.clear();
  // Let a released attempt write its own ending before the store it writes to is closed.
  await new Promise((settle) => setTimeout(settle, 1000));
  await stopRuntime?.().catch(() => undefined);
  await closeStage();
}, 120_000);

/** The drawing AC-1 renders, its record, its sheets and what one run of the job reported. */
interface Rendered {
  drawing: StagedDrawing;
  record: IngestRecord;
  graph: ArtifactGraph;
  layouts: ArtifactLayout[];
  steps: string[];
  jobId: string;
}

let rendering: Promise<Rendered> | undefined;

/**
 * One run of `runThumbnailsJob` over a drawing ingested from `cad/tests/fixtures/layouts.*` —
 * memoised, because AC-1 and AC-2 judge the same single run from two sides.
 */
function rendered(): Promise<Rendered> {
  return (rendering ??= (async () => {
    const stage = await staged();
    const { drawing, record } = await stageIngested(stage.person, stage.projectId, "layouts");
    const graph = await artifactOf(stage.storage, stage.person.tenantId, record);
    const layouts = graph.layouts;

    const steps: string[] = [];
    const jobId = unique("raster-job");
    await stage.thumbnails.runThumbnailsJob(
      { tenantId: stage.person.tenantId, drawingId: drawing.drawingId, ingestId: record.ingestId, requestedBy: stage.person.userId },
      {
        jobId,
        tempDir: tempDir("rasters"),
        step: async (name: string): Promise<void> => {
          steps.push(name);
        },
      },
      { storage: stage.storage },
    );
    return { drawing, record, graph, layouts, steps, jobId };
  })());
}

/**
 * How far a raster's ink may stand from where the corpus says the sheet's geometry reaches, as a
 * fraction of the canvas: a fiftieth of it, and never less than two pixels. A rasteriser rounds a
 * scaled coordinate either way and lays a stroke of some width around it, and that is all the
 * latitude the placement of a sheet's own geometry is granted.
 */
function placementTolerance(pixels: number): number {
  return Math.max(2 / pixels, 0.02);
}

/** How far apart two boxes stand, as the widest disagreement between their edges. */
function boxGap(seen: UnitBox, want: UnitBox): { x: number; y: number } {
  return { x: Math.max(Math.abs(seen.x0 - want.x0), Math.abs(seen.x1 - want.x1)), y: Math.max(Math.abs(seen.y0 - want.y0), Math.abs(seen.y1 - want.y1)) };
}

/**
 * The same box read the other way up. A drawing's `y` climbs and an image's rows descend, and
 * nothing in R-SPINE-022 says which way round a raster is written — so a sheet's derived extent is
 * matched against whichever reading it is written in, and it is the placement and the scale that
 * are judged rather than the seam's choice of origin.
 */
function flipped(box: UnitBox): UnitBox {
  return { x0: box.x0, x1: box.x1, y0: 1 - box.y1, y1: 1 - box.y0 };
}

/** The gap to whichever way up the raster was written — the smaller disagreement of the two. */
function placementGap(seen: UnitBox, want: UnitBox): { x: number; y: number } {
  const upright = boxGap(seen, want);
  const inverted = boxGap(seen, flipped(want));
  return upright.y <= inverted.y ? upright : inverted;
}

/** How much of a canvas a box covers. */
function coverage(box: UnitBox): number {
  return Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);
}

/**
 * How much ink a raster carries per pixel of its long edge.
 *
 * Ink is strokes, so its area grows with the length of what is drawn — one dimension — while the
 * canvas grows with two. The share of a canvas that is ink therefore falls as the canvas grows,
 * and it is this quantity, not the share, that the three tiers of one sheet have in common.
 */
function inkDensity(ink: { ratio: number }, longEdge: number): number {
  return ink.ratio * longEdge;
}

/**
 * How far two tiers' densities may stand apart: a factor of four. Strokes hold a width in pixels
 * while the drawing shrinks under them, so neighbouring lines merge into one at the cheap tiers and
 * count once instead of twice. The bound is loose because the thing it exists to catch is not
 * loose: a tier that is left blank, or drawn from something other than this sheet, is off by
 * everything rather than by a factor.
 */
const DENSITY_FACTOR = 4;

describe("AC-1 — every sheet, at every tier, stored at its own address and recorded once", () => {
  test(
    "AC-1: one run leaves one PNG per sheet per tier, sized by the tier's long edge, shaped by its sheet and bearing that sheet's own geometry, and walks resolve → render → store → record",
    async () => {
      const stage = await staged();
      const { record, drawing, graph, layouts, steps, jobId } = await rendered();

      // The vocabulary the test contract fixes (C-05), read from the seam so no caller re-spells it.
      expect([...stage.thumbnails.RASTER_TIERS], "RASTER_TIERS is the three zoom tiers R-SPINE-022 names").toEqual([...TIERS]);
      expect({ ...stage.thumbnails.RASTER_TIER_LONG_EDGE }, "and each tier's long edge in pixels").toStrictEqual({ ...LONG_EDGE });
      expect(stage.thumbnails.THUMBNAILS_KIND, "the job kind is the one the test contract spells").toBe(KIND);
      expect(stage.thumbnails.RASTER_URL_LIFETIME_SECONDS, "and the lifetime its signed URLs are minted for").toBe(LIFETIME_SECONDS);

      // The premise the criterion states about the corpus, asked of the corpus rather than assumed.
      expect(layouts.length, "layouts.dxf carries at least two sheets, which is what makes 3 × N a number worth counting").toBeGreaterThanOrEqual(2);

      const rows = await stage.thumbnails.sheetRasterRecords({ tenantId: stage.person.tenantId, ingestId: record.ingestId });
      expect(rows.length, "one row per sheet per tier — 3 × N, and nothing besides").toBe(layouts.length * stage.thumbnails.RASTER_TIERS.length);

      // The roster is derived from the artifact's own sheets crossed with the seam's own tiers: a
      // corpus that grows a layout, or a seam that grows a tier, grows this expectation with it.
      const expected = byCodePoint(layouts.flatMap((layout) => stage.thumbnails.RASTER_TIERS.map((tier) => rasterKey({ layoutName: layout.name, tier }))));
      expect(inRasterOrder(rows).map(rasterKey), "exactly one raster per (sheet, tier), each sheet of the record's own artifact").toEqual(expected);

      /** What each stored raster actually depicts, kept so the tiers and the sheets can be compared. */
      const inks = new Map<string, Ink>();

      for (const row of rows) {
        const what = `the ${row.tier} raster of sheet ${JSON.stringify(row.layoutName)}`;
        expect(row.ingestId, `${what} is recorded against the ingest it was rendered from`).toBe(record.ingestId);
        expect(row.drawingId, `${what} names the drawing that ingest is of`).toBe(drawing.drawingId);
        expect(row.jobId, `${what} names the job that rendered it`).toBe(jobId);
        expect(Date.parse(row.createdAt), `${what} carries the instant it was recorded at`).not.toBeNaN();

        const bytes = await stage.storage.get(stage.person.tenantId, row.sha256);
        expect(bytes, `${what} is held by SEAM-STORAGE at the address its row names — a row pointing at nothing is not a raster`).not.toBeNull();
        const held = bytes as Uint8Array;
        expect(sha256Of(held), `${what} is addressed by the sha256 of its own bytes (R-SPINE-021: content addressing)`).toBe(row.sha256);

        const header = pngHeader(held, what);
        expect(header, `${what}'s own header agrees with the size its row records`).toStrictEqual({ width: row.width, height: row.height });
        const longEdge = stage.thumbnails.RASTER_TIER_LONG_EDGE[row.tier] as number;
        expect(Math.max(header.width, header.height), `${what}'s long edge is the tier's (RASTER_TIER_LONG_EDGE.${row.tier})`).toBe(longEdge);

        // A raster of a sheet carries that sheet's own shape. The proportions are taken from the
        // record's artifact at the moment it is judged — a corpus whose sheets change shape changes
        // this expectation with them — so nothing here would accept a canvas the layout's extent
        // played no part in.
        const sheet = layouts.find((candidate) => candidate.name === row.layoutName);
        expect(sheet, `${what} names a sheet the record's artifact carries`).toBeDefined();
        const spans = bboxSpansOf(sheet as ArtifactLayout);

        // What the bytes DEPICT. A raster is of a sheet — R-SPINE-022 spends these on the sheet
        // index and the viewer background, and a background showing nothing is not a background of
        // the drawing. The paper is whichever colour the raster is mostly made of, read off the
        // raster itself: the Bible fixes no palette, so ink is "not the paper" and never a colour
        // spelled here.
        const ink = inkOf(held, what);
        expect({ width: ink.width, height: ink.height }, `${what}'s pixels fill the canvas its own header declares`).toStrictEqual({ width: header.width, height: header.height });
        inks.set(rasterKey(row), ink);

        // Which sheets are drawn on, and how far over each the drawing reaches, is asked of the
        // record's own artifact — the same corpus the roster above was derived from (B-19).
        const geometry = drawnExtentOf(graph, row.layoutName);
        if (geometry === null) {
          expect(ink.count, `${what} is of a sheet the record's artifact puts no path on, and a sheet with nothing drawn on it rasterises blank`).toBe(0);
        } else {
          const reaches = `${what} carries ink over ${JSON.stringify(ink.box)} of its canvas, where the artifact puts ${geometry.drawn} path records reaching ${JSON.stringify(geometry.box)} of the sheet`;
          expect(ink.count, `${reaches}: it is blank, and a blank canvas is not a raster of a sheet that has ${geometry.drawn} paths on it (R-SPINE-022)`).toBeGreaterThan(0);
          expect(ink.ratio, `${reaches}: it is one flat colour edge to edge, which depicts a sheet no better than a blank one does`).toBeLessThan(1);

          const seen = ink.box as UnitBox;
          const gap = placementGap(seen, geometry.box);
          const room = { x: placementTolerance(ink.width), y: placementTolerance(ink.height) };
          expect(gap.x, `${reaches}: along x that is out by ${gap.x.toFixed(4)} of the canvas, past the ${room.x.toFixed(4)} a rasteriser's rounding and stroke width are granted`).toBeLessThanOrEqual(room.x);
          expect(gap.y, `${reaches}: along y that is out by ${gap.y.toFixed(4)} of the canvas, past the ${room.y.toFixed(4)} a rasteriser's rounding and stroke width are granted`).toBeLessThanOrEqual(room.y);
          expect(coverage(seen), `${reaches}: what it marks covers too little of what that geometry spans — a dot, or one path of many, is not the sheet`).toBeGreaterThanOrEqual(coverage(geometry.box) / 2);
        }

        if (spans === null) {
          expect({ width: header.width, height: header.height }, `${what} is of a sheet with no bounding box, and that is the one square canvas`).toStrictEqual({
            width: longEdge,
            height: longEdge,
          });
          continue;
        }

        const fitted = fittedCanvas(spans, longEdge);
        const shape = `${what} is ${header.width}×${header.height} px for a sheet reaching ${spans.x}×${spans.y} in its own units, whose raster stands at ${fitted.width.toFixed(1)}×${fitted.height.toFixed(1)} px (a pixel either way for rounding)`;
        for (const axis of ["width", "height"] as const) {
          expect(header[axis], `${shape}: its ${axis} is short of that`).toBeGreaterThanOrEqual(Math.max(1, Math.floor(fitted[axis])));
          expect(header[axis], `${shape}: its ${axis} overruns that`).toBeLessThanOrEqual(Math.max(1, Math.ceil(fitted[axis])));
        }

        // Said plainly for the case the shape rule exists to refuse: a sheet the artifact says is
        // not square is never rendered as the tier's square.
        if (Math.max(1, Math.ceil(fitted.width)) < longEdge || Math.max(1, Math.ceil(fitted.height)) < longEdge) {
          expect(Math.min(header.width, header.height), `${shape}: a sheet that is not square is not rendered square`).toBeLessThan(Math.max(header.width, header.height));
        }
      }

      // Two sheets are two drawings, and the three tiers of one sheet are three zooms of one. Both
      // are asked of the decoded ink rather than of the addresses: content addressing makes two
      // addresses differ the moment one byte does, so distinct addresses come free and say nothing
      // about what was drawn (R-SPINE-021).
      const drawnSheets = layouts.filter((layout) => drawnExtentOf(graph, layout.name) !== null);
      expect(drawnSheets.length, "the record's artifact puts geometry on at least two of its sheets, which is what makes the two comparisons below comparisons of something").toBeGreaterThanOrEqual(2);

      for (const tier of stage.thumbnails.RASTER_TIERS) {
        for (let first = 0; first < drawnSheets.length; first += 1) {
          for (let second = first + 1; second < drawnSheets.length; second += 1) {
            const one = (drawnSheets[first] as ArtifactLayout).name;
            const other = (drawnSheets[second] as ArtifactLayout).name;
            const here = inks.get(rasterKey({ layoutName: one, tier })) as Ink;
            const there = inks.get(rasterKey({ layoutName: other, tier })) as Ink;
            expect(
              here.signature,
              `the ${tier} rasters of sheets ${JSON.stringify(one)} and ${JSON.stringify(other)} carry their ink in exactly the same places, so they depict the same thing — a renderer answering one image for every sheet satisfies every count, size and address above`,
            ).not.toBe(there.signature);
          }
        }
      }

      for (const layout of drawnSheets) {
        const perTier = stage.thumbnails.RASTER_TIERS.map((tier) => ({ tier, ink: inks.get(rasterKey({ layoutName: layout.name, tier })) as Ink, longEdge: stage.thumbnails.RASTER_TIER_LONG_EDGE[tier] as number }));
        const finest = perTier.reduce((left, right) => (right.longEdge > left.longEdge ? right : left));
        for (const at of perTier) {
          if (at.tier === finest.tier) continue;
          const shown = `sheet ${JSON.stringify(layout.name)} at ${at.tier} beside the same sheet at ${finest.tier}`;
          const gap = boxGap(at.ink.box as UnitBox, finest.ink.box as UnitBox);
          const room = { x: placementTolerance(at.ink.width), y: placementTolerance(at.ink.height) };
          expect(
            Math.max(gap.x - room.x, gap.y - room.y),
            `${shown}: the two mark different parts of their canvases (out by ${gap.x.toFixed(4)} along x and ${gap.y.toFixed(4)} along y), so they are not two zooms of one drawing`,
          ).toBeLessThanOrEqual(0);
          const density = inkDensity(at.ink, at.longEdge);
          const against = inkDensity(finest.ink, finest.longEdge);
          expect(
            Math.max(density, against) / Math.min(density, against),
            `${shown}: it carries ${density.toFixed(1)} of ink per pixel of long edge to the other's ${against.toFixed(1)} — the cheap tiers are the same drawing seen smaller, never blanks or something else`,
          ).toBeLessThanOrEqual(DENSITY_FACTOR);
        }
      }

      const reached = stepOrder(steps, RASTER_STEPS);
      expect(reached, `the job's steps stand in the order it takes them (it reported: ${steps.join(" → ")})`).toEqual([...reached].sort((left, right) => left - right));
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-1: renderSheet draws the sheet it is handed at the long edge it is given, and answers a blank square for a sheet with no bounding box",
    async () => {
      const stage = await staged();
      const { graph } = await rendered();

      // The cheapest tier the seam declares, taken from the seam rather than named here.
      const longEdge = Math.min(...stage.thumbnails.RASTER_TIERS.map((tier) => stage.thumbnails.RASTER_TIER_LONG_EDGE[tier] as number));

      // The sheet of the corpus that carries the most geometry — the one a renderer that drops
      // entities has the most to answer for.
      const drawn = graph.layouts
        .map((layout) => ({ layout, geometry: drawnExtentOf(graph, layout.name) }))
        .filter((candidate): candidate is { layout: ArtifactLayout; geometry: NonNullable<ReturnType<typeof drawnExtentOf>> } => candidate.geometry !== null)
        .reduce((left, right) => (right.geometry.drawn > left.geometry.drawn ? right : left));

      const sheet = stage.thumbnails.renderSheet(graph, drawn.layout.name, longEdge);
      const what = `renderSheet over sheet ${JSON.stringify(drawn.layout.name)} at a long edge of ${longEdge}`;
      const drawnInk = inkOf(sheet.png, what);
      expect({ width: drawnInk.width, height: drawnInk.height }, `${what} answers a PNG of the canvas it reports`).toStrictEqual({ width: sheet.width, height: sheet.height });
      expect(Math.max(sheet.width, sheet.height), `${what} stands at that long edge`).toBe(longEdge);

      const spans = bboxSpansOf(drawn.layout);
      const fitted = fittedCanvas(spans as { x: number; y: number }, longEdge);
      for (const axis of ["width", "height"] as const) {
        expect(sheet[axis], `${what} is ${sheet.width}×${sheet.height} px where the sheet's own extent fits ${fitted.width.toFixed(1)}×${fitted.height.toFixed(1)} px: its ${axis} is short of that`).toBeGreaterThanOrEqual(Math.max(1, Math.floor(fitted[axis])));
        expect(sheet[axis], `${what} is ${sheet.width}×${sheet.height} px where the sheet's own extent fits ${fitted.width.toFixed(1)}×${fitted.height.toFixed(1)} px: its ${axis} overruns that`).toBeLessThanOrEqual(Math.max(1, Math.ceil(fitted[axis])));
      }

      expect(drawnInk.count, `${what} draws nothing, though the artifact puts ${drawn.geometry.drawn} path records on that sheet (R-SPINE-022)`).toBeGreaterThan(0);
      const gap = placementGap(drawnInk.box as UnitBox, drawn.geometry.box);
      expect(
        Math.max(gap.x - placementTolerance(drawnInk.width), gap.y - placementTolerance(drawnInk.height)),
        `${what} marks ${JSON.stringify(drawnInk.box)} of its canvas where that geometry reaches ${JSON.stringify(drawn.geometry.box)} of the sheet (out by ${gap.x.toFixed(4)} along x and ${gap.y.toFixed(4)} along y)`,
      ).toBeLessThanOrEqual(0);

      // The other branch the interface publishes: a sheet the artifact states no extent for. The
      // layout is built here out of the vocabulary the artifact itself uses, so the branch is asked
      // for through the published interface rather than read out of the rasteriser.
      const blankName = unique("no-extent-sheet");
      const withoutExtent: ArtifactGraph = { ...graph, layouts: [...graph.layouts, { name: blankName, kind: "paper", bbox: null, strays_rejected: 0 } as unknown as ArtifactLayout] };
      const blank = stage.thumbnails.renderSheet(withoutExtent, blankName, longEdge);
      const blankInk = inkOf(blank.png, `renderSheet over a sheet with no bounding box at a long edge of ${longEdge}`);
      expect({ width: blank.width, height: blank.height }, "a sheet the artifact states no bounding box for renders as the tier's square").toStrictEqual({ width: longEdge, height: longEdge });
      expect(blankInk.count, "and that square is blank — there is no extent to draw anything within").toBe(0);
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-2 — one read door, per sheet and per tier, signed and expiring", () => {
  test(
    "AC-2: sheetRastersOf answers a signed URL per tier per sheet, vouched for now and expired a lifetime later",
    async () => {
      const stage = await staged();
      const { record, drawing, layouts } = await rendered();
      const scope = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId };

      const rows = await stage.thumbnails.sheetRasterRecords({ tenantId: scope.tenantId, ingestId: record.ingestId });
      const sheets = await stage.thumbnails.sheetRastersOf(scope);

      expect(byCodePoint(sheets.map((sheet) => sheet.layoutName)), "one entry per sheet of the drawing's current ingest record").toEqual(
        byCodePoint(layouts.map((layout) => layout.name)),
      );

      // Judged at a single instant, a whole lifetime and one second after the URLs were minted: the
      // mint happened no later than this, so the expiry is settled rather than raced (Q-12).
      const afterwards = new Date(Date.now() + (stage.thumbnails.RASTER_URL_LIFETIME_SECONDS + 1) * 1000);

      for (const sheet of sheets) {
        const layout = layouts.find((candidate) => candidate.name === sheet.layoutName);
        expect(layout, `sheet ${JSON.stringify(sheet.layoutName)} is one of the artifact's own layouts`).toBeDefined();
        expect(sheet.kind, `sheet ${JSON.stringify(sheet.layoutName)} is served as the space the artifact says it is`).toBe(layout?.kind);
        expect(byCodePoint(Object.keys(sheet.tiers)), `sheet ${JSON.stringify(sheet.layoutName)} carries every tier and no other`).toEqual(byCodePoint([...stage.thumbnails.RASTER_TIERS]));

        for (const tier of stage.thumbnails.RASTER_TIERS) {
          const what = `the ${tier} URL of sheet ${JSON.stringify(sheet.layoutName)}`;
          const served = sheet.tiers[tier] as { url: string; width: number; height: number; sha256: string };
          const row = rows.find((candidate) => candidate.layoutName === sheet.layoutName && candidate.tier === tier) as SheetRasterRecord;
          expect(row, `${what} has a recorded raster behind it`).toBeDefined();
          expect({ width: served.width, height: served.height, sha256: served.sha256 }, `${what} serves the raster that was recorded`).toStrictEqual({
            width: row.width,
            height: row.height,
            sha256: row.sha256,
          });

          expect(stage.storage.verify(served.url), `${what} is one SEAM-STORAGE minted, for this tenant and this address (Q-12)`).toStrictEqual({
            ok: true,
            tenantId: scope.tenantId,
            sha256: row.sha256,
          });
          expect(stage.storage.verify(served.url, afterwards), `${what} is expired a lifetime and a second later — a download URL that never expires is not signed evidence`).toStrictEqual({
            ok: false,
            reason: "expired",
          });
        }
      }

      const unrecorded = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("never-ingested.dxf"), format: "dxf" });
      expect(await stage.thumbnails.sheetRastersOf({ tenantId: scope.tenantId, drawingId: unrecorded.drawingId }), "a drawing with no ingest record has no sheets to serve, which is an empty answer rather than a refusal").toEqual([]);
    },
    CASE_BUDGET_MS,
  );
});

describe("AC-3 — the door enqueues once, and refuses what is not its to render", () => {
  test(
    "AC-3: an in-scope ingested drawing is enqueued once, under its own key, carrying the record it is of",
    async () => {
      const stage = await staged();
      const { drawing, record } = await stageIngested(stage.person, stage.projectId, "basic");
      const request = { tenantId: stage.person.tenantId, drawingId: drawing.drawingId, requestedBy: stage.person.userId };

      const answer = await stage.thumbnails.requestThumbnails(request);
      expect("refusal" in answer ? answer.refusal : null, "a drawing of this workspace with an ingest record is not refused").toBeNull();
      const accepted = answer as { jobId: string | null; deduplicated: boolean };
      expect(typeof accepted.jobId, "the door answers the id of the job it enqueued").toBe("string");
      expect(accepted.deduplicated, "the first request deduplicated nothing").toBe(false);
      const jobId = accepted.jobId ?? "";

      // The payload, read where SEAM-JOBS hands one over: the registered handler for the kind.
      await waitUntil(() => delivered.some((job) => job.jobId === jobId), `the queue handed job ${jobId} to the process consuming its kind`, DELIVERY_BUDGET_MS);
      expect(delivered.find((job) => job.jobId === jobId)?.payload, "the job carries the tenant, the drawing, the record it renders and who asked for it").toStrictEqual({
        tenantId: request.tenantId,
        drawingId: request.drawingId,
        ingestId: record.ingestId,
        requestedBy: request.requestedBy,
      });

      // The attempt is held open by the stand-in, so the job is demonstrably still under way while
      // both questions below are asked of it.
      const key = stage.thumbnails.thumbnailsJobKey(request.tenantId, record.ingestId);
      expect(key, "the key is the one the seam spells, so no caller re-spells it").toBe(`${stage.thumbnails.THUMBNAILS_KIND}:${request.tenantId}:${record.ingestId}`);
      expect(await stage.thumbnails.requestThumbnails(request), "a second request while that job is running is the same job, said again").toStrictEqual({
        jobId,
        deduplicated: true,
      });
      expect(
        await stage.jobs.enqueue(stage.thumbnails.THUMBNAILS_KIND, { ...request, ingestId: record.ingestId }, { key }),
        "and the job the door made stands under that kind and that key — enqueueing it again is answered with the job that is already there (SEAM-JOBS)",
      ).toStrictEqual({ jobId, deduplicated: true });

      release(jobId);
    },
    CASE_BUDGET_MS,
  );

  test(
    "AC-3: a drawing another workspace holds, and one that has never been ingested, are refused with nothing enqueued",
    async () => {
      const stage = await staged();
      const register = await productModule<{ REFUSALS: Readonly<Record<string, { code: string }>> }>(ERRORS_MODULE);
      expect(register.REFUSALS[RASTER_NOT_AVAILABLE]?.code, `${RASTER_NOT_AVAILABLE} is registered in ${ERRORS_MODULE} (Q-07: the register is a code's one home)`).toBe(RASTER_NOT_AVAILABLE);

      // Somebody else's workspace, with an ingest record of its own — so the only thing wrong with
      // the request is whose drawing it is (R-SPINE-004).
      const stranger = await stagePerson("stranger");
      const theirs = await stageIngested(stranger.person, stranger.projectId, "basic");
      expect(
        await stage.thumbnails.requestThumbnails({ tenantId: stage.person.tenantId, drawingId: theirs.drawing.drawingId, requestedBy: stage.person.userId }),
        "a drawing this tenant scope cannot see is not a drawing this workspace may render",
      ).toStrictEqual({ refusal: WORKSPACE_PERMISSION_NOT_HELD });

      // That request DID name a record, so there is a key the door could have used, and asking
      // whether it is free is a question about the door. Both spellings are asked: the workspace
      // that was refused and the workspace that owns the record.
      const earlier: string[] = [];
      for (const tenantId of [stage.person.tenantId, stranger.person.tenantId]) {
        earlier.push(await expectKeyFree(stage, stage.thumbnails.thumbnailsJobKey(tenantId, theirs.record.ingestId), "the refused cross-workspace request"));
      }

      // In scope, and nothing has ever been taken from it: there is no record to render sheets of.
      const unrecorded = await stageDrawing(stage.person, stage.projectId, cadFixture("basic"), { name: unique("unrendered.dxf"), format: "dxf" });

      // What the whole kind had handed over before the door was asked. Read at the one place the
      // seam hands a payload over — the handler this file registered for the kind — which is the
      // only key-agnostic view there is: this process consumes the thumbnails queue, so a job of
      // that kind under ANY spelling of key arrives here. The probes above are waited for first, so
      // the snapshot is a settled state rather than a moment in a race.
      await waitUntil(() => earlier.every((probe) => delivered.some((job) => job.jobId === probe)), "the probes the arm above cost were handed over before this arm's snapshot", DELIVERY_BUDGET_MS);
      const before = delivered.length;

      expect(
        await stage.thumbnails.requestThumbnails({ tenantId: stage.person.tenantId, drawingId: unrecorded.drawingId, requestedBy: stage.person.userId }),
        "a drawing with no ingest record is answered by name, not by an empty job",
      ).toStrictEqual({ refusal: RASTER_NOT_AVAILABLE });

      // A marker of this file's own, enqueued after the refusal and then waited for. The queue hands
      // its work over oldest first, so once the marker has arrived anything the door had enqueued
      // ahead of it has arrived too — which is what makes "nothing arrived" a settled state rather
      // than a race. The key it is enqueued under is the only thing the key helper can be asked here
      // and mean anything: a drawing with no ingest record has no ingestId, so no key of that shape
      // is one the door could ever have minted, and its being free guards the narrow conflation of a
      // drawingId for an ingestId — never "nothing was enqueued", which the line below proves.
      const marker = await expectKeyFree(stage, stage.thumbnails.thumbnailsJobKey(stage.person.tenantId, unrecorded.drawingId), "the refused un-ingested request took a drawing id for an ingest id");
      await waitUntil(() => delivered.some((job) => job.jobId === marker), `the queue handed this file's marker job ${marker} over`, DELIVERY_BUDGET_MS);

      expect(
        delivered.slice(before).map((job) => job.jobId),
        "an un-ingested request queues nothing for the thumbnails kind — not merely nothing under one key: everything the queue handed over across the refusal is this file's own marker",
      ).toStrictEqual([marker]);
    },
    CASE_BUDGET_MS,
  );
});

/**
 * Nothing of the thumbnails kind stands under this key. Asked of the seam rather than assumed from
 * the refusal's shape: enqueueing a key again is answered `deduplicated: false` only when no job of
 * it is queued or active, which is exactly what "no job under this key" means (SEAM-JOBS'
 * idempotency).
 *
 * What it proves is bounded by what a key is: a key the door could have minted, left free, says the
 * door minted nothing under it. It says nothing about any other spelling — which is why the arms
 * that need "nothing at all" read the handler the kind is delivered to instead. The probe job the
 * question costs names no record, so the stand-in lets it go at once; its id is answered so a caller
 * can wait for it and tell it apart from anything else the queue hands over.
 */
async function expectKeyFree(stage: Staged, key: string, what: string): Promise<string> {
  const probe = await stage.jobs.enqueue(stage.thumbnails.THUMBNAILS_KIND, { key }, { key });
  expect(probe.deduplicated, `${what} left no job under the key ${key}: it was free for this probe to take`).toBe(false);
  return probe.jobId;
}
