// GET /api/viewer/{drawing}/{layout} — R-UI-043's progressive feed. The head answers what a screen
// needs before any geometry arrives (the layer roster with its counts and swatches, the sheet's
// extents, its digest and the facts its reading recorded), and each layer is asked for by index
// afterwards, so first paint is the first layer rather than the whole sheet.
//
// The manifest is deliberately not carried into the page as a server prop: a 100 000-entity sheet in
// an RSC payload would be paid for before anything could be drawn (PB-2).
//
// Three unhappy answers, told apart (ARCH-03, B-21): no live session is SIGNED_OUT at 401, a person
// the guard does not admit to the drawing's own project is WORKSPACE_PERMISSION_NOT_HELD at 403 —
// existence, membership and standing are one answer, so a stranger learns nothing about somebody
// else's drawings (Q-12) — and a failure of ours is recorded at the fault seam and answered with
// its id.
//
// The admission is `authorize()`'s and no longer this file's (B-17, ARCH-02). It used to stop at
// `holdsWorkspace`, which is the half-question: every member of a workspace was served every sheet
// of every project in it, whatever they stood in relation to the project the sheet belongs to. The
// door names the drawing's own project and asks whether this person is ON it — a READ is what a
// participant does, and no permission in L-ACT-03's enum is cut on seeing a sheet.
import { z } from "zod";
import { REFUSALS } from "@/core/errors";
import { appStorage } from "@/core/storage/app";
import { drawingAddress, renderManifestOf } from "@/modules/takeoff/viewer";
import { partitionOverlayOfSheet } from "@/modules/takeoff/viewer-partition-overlay/server";
import { snapCalibrationsOfSheet } from "@/modules/takeoff/viewer-snap/server";
import type { RenderLayer, ViewerHead } from "@/modules/takeoff/viewer";
import { authorize } from "@/server/authorize";
import { json, routeHandler } from "@/server/call";

/** A sheet is served from live state; nothing about this route may be built or cached. */
export const dynamic = "force-dynamic";

/** The route the fault seam records this handler's failures under (ARCH-03). */
const ROUTE = "GET /api/viewer/[drawing]/[layout]";

/** The status each refusal this door can answer is given. */
const STATUS: Readonly<Record<"SIGNED_OUT" | "WORKSPACE_PERMISSION_NOT_HELD", number>> = Object.freeze({
  SIGNED_OUT: 401,
  WORKSPACE_PERMISSION_NOT_HELD: 403,
});

/** What a caller is told when the address asks for a part of a sheet that is not one. */
const NOT_A_PART = "a sheet is asked for as ?part=head, ?part=layer&index=<n>, ?part=partition or ?part=calibration";

/**
 * What a caller is told when the part is one this feed serves but the index beside it is not a
 * place in a roster. Its own sentence: a client answered with the part's copy is told to ask for
 * exactly what it did ask for, and learns nothing about which half of the address was wrong.
 */
const NOT_AN_INDEX = "?index= is a layer's place in the roster the head published: a whole number from 0 upwards";

/**
 * What the address asks for, read once by the one reading this tier has (`@/server/call`): the head,
 * one layer by its place in the roster the head published, the stored partition this sheet's overlay
 * is drawn from (R-TO-014), or the scale of record over its views. The partition and the calibration
 * stand BESIDE the head rather than inside it — a screen asks for them once the head is a manifest,
 * so a sheet's first paint is never delayed by a reading of the store it does not need yet
 * (R-UI-043).
 *
 * `?part=` and `?index=` stay two different questions, and each carries its own sentence: a client
 * answered with the part's copy for an unreadable index would be told to ask for exactly what it did
 * ask for. The index is judged as text rather than by `Number`, which reads a blank string as zero
 * and would serve the first layer to an address that named no layer at all.
 */
const ASKED = z.object({
  address: z
    .object({
      drawing: z.string(),
      layout: z.string(),
      tenant: z.string().optional(),
      // A stated part is one of the four this feed serves; an address that names none asks for the
      // head, which is what a screen wants first.
      part: z
        .string()
        .optional()
        .transform((stated) => stated ?? "head")
        .pipe(z.enum(["head", "layer", "partition", "calibration"], { error: NOT_A_PART })),
      index: z.string().optional(),
    })
    .superRefine((stated, ctx) => {
      if (stated.part !== "layer") return;
      if (/^\d+$/.test(stated.index ?? "")) return;
      ctx.addIssue({ code: "custom", message: NOT_AN_INDEX, path: ["index"] });
    })
    .transform((stated) => ({ ...stated, index: stated.index === undefined ? null : Number(stated.index) })),
});

/** A registered refusal, carried whole so the screen renders the register's copy (R-SPINE-062). */
function refusalAnswer(code: keyof typeof STATUS): Response {
  return json({ refusal: REFUSALS[code] }, STATUS[code]);
}

/** The head as the feed answers it: everything but the records, which are asked for one layer at a time. */
function headAnswer(head: ViewerHead): Response {
  if (head.kind === "absent") return json(head, 404);
  if (head.kind === "refusal") return json(head, 200);
  const { manifest } = head;
  return json(
    {
      kind: head.kind,
      cache: head.cache,
      facts: head.facts,
      layoutName: manifest.layoutName,
      extents: manifest.extents,
      insunits: manifest.insunits,
      digest: manifest.digest,
      version: manifest.version,
      layers: manifest.layers.map((layer: RenderLayer) => ({
        name: layer.name,
        rgb: layer.rgb,
        entityCount: layer.entityCount,
      })),
    },
    200,
  );
}

/** One layer's geometry, by its place in the roster the head published. */
function layerAnswer(head: ViewerHead, index: number): Response {
  if (head.kind === "absent") return json(head, 404);
  if (head.kind === "refusal") return json(head, 200);
  const layer = head.manifest.layers[index];
  if (layer === undefined) return json({ error: `the sheet holds no layer at ${index}` }, 404);
  return json(
    {
      index,
      name: layer.name,
      rgb: layer.rgb,
      entityCount: layer.entityCount,
      records: layer.records,
    },
    200,
  );
}

/**
 * The door itself. What the caller stated is read before it is called, by the one reading this tier
 * has, so `?part=` and `?index=` — both questions about the address rather than about the caller —
 * are still answered before anybody is asked who is calling: a signed-out client with an unreadable
 * index learns which of the two it got wrong instead of being told to sign in first (ARCH-03). The
 * context is minted by the same seam, so the presented session is resolved exactly once whatever
 * this door goes on to do with it (R-SPINE-001).
 */
export const GET = routeHandler({ route: ROUTE, actor: "viewer", schema: ASKED, sentence: NOT_A_PART }, async ({ input, context }) => {
  const { drawing, layout, part, index, tenant } = input.address;
  if (context.session === null) return refusalAnswer("SIGNED_OUT");

  // Where the drawing really stands, read as the system before any tenant handle is opened: a
  // `?tenant=` that disagrees with it is a caller naming somebody else's workspace and names none.
  // A caller the guard admits is told the truth about a sheet it does not hold — an absence, which
  // is the empty cell that teaches — and everybody else gets the one refusal above (Q-12).
  const address = await drawingAddress(drawing);
  if (address === null || (tenant !== undefined && tenant !== address.tenantId)) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");
  const tenantId = address.tenantId;
  // The guard is asked about the drawing's own project and the permission this feed stands on. Its
  // refusal is carried as this door's own closed answer: the register's codes are unchanged, and a
  // caller still cannot tell "not yours" from "not there" (Q-12).
  const answer = await authorize({
    userId: context.session.userId,
    tenantId,
    projectId: address.projectId,
    drawingId: drawing,
    // Participation, not MEASURE. READING a sheet is what every participant does — the REVIEWER
    // reviews the measurements taken off it, the LEAD pins sets and sets the bill boundary off these
    // very sheets — and MEASURE is the right to CHANGE measurements, which four of the six shipped
    // roles do not hold (REVIEWER, LEAD, ESTIMATOR, BID_MANAGER). A feed that named it served a
    // stranger and a colleague the same 403 (L-ACT-03's role table; the adversary's F1/F2).
    participation: true,
  });
  if (!answer.authorized) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");

  // The stored partition of this sheet, for the overlay drawn over it. A drawing nothing has
  // partitioned yet answers `null` at 200: an absence is an answer, not a refusal and not a fault,
  // and the panel teaches rather than alarming (R-UI-050, R-TO-014).
  if (part === "partition") {
    return json({ overlay: await partitionOverlayOfSheet({ tenantId, drawingId: drawing, layoutName: layout }) }, 200);
  }

  // The scale of record over this sheet's views, for the readout that states metres beside the
  // drawing's own units (R-UI-041, I-150). It stands beside the head for the same reason the
  // partition does — a sheet's first paint is never delayed by a reading of the store — and a
  // drawing nothing has partitioned answers `null` at 200 rather than a refusal.
  if (part === "calibration") {
    return json({ calibration: await snapCalibrationsOfSheet({ tenantId, drawingId: drawing, layoutName: layout }) }, 200);
  }

  // The segment Next resolved is the sheet's name: it arrives decoded, and reading it again would
  // collide two addresses and fault on a name carrying a bare `%` (R-UI-031).
  const head = await renderManifestOf({ tenantId, drawingId: drawing, layoutName: layout }, { storage: appStorage() });
  if (part === "head") return headAnswer(head);
  return layerAnswer(head, index ?? 0);
});
