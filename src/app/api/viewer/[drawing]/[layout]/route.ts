// GET /api/viewer/{drawing}/{layout} — R-UI-043's progressive feed. The head answers what a screen
// needs before any geometry arrives (the layer roster with its counts and swatches, the sheet's
// extents, its digest and the facts its reading recorded), and each layer is asked for by index
// afterwards, so first paint is the first layer rather than the whole sheet.
//
// The manifest is deliberately not carried into the page as a server prop: a 100 000-entity sheet in
// an RSC payload would be paid for before anything could be drawn (PB-2).
//
// Three unhappy answers, told apart (ARCH-03, B-21): no live session is SIGNED_OUT at 401, a person
// who does not hold the drawing's workspace is WORKSPACE_PERMISSION_NOT_HELD at 403 — existence and
// membership are one answer, so a stranger learns nothing about somebody else's drawings (Q-12) —
// and a failure of ours is recorded at the fault seam and answered with its id.
import { randomUUID } from "node:crypto";
import { REFUSALS } from "../../../../../core/errors";
import { reportFault } from "../../../../../core/faults/report";
import { appStorage } from "../../../../../core/storage/app";
import { renderManifestOf, workspaceOfDrawing } from "../../../../../modules/takeoff/viewer";
import type { RenderLayer, ViewerHead } from "../../../../../modules/takeoff/viewer";
import { createContext, type AppContext } from "../../../../../server/context";
import { holdsWorkspace } from "../../../../../server/shell/workspace";

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
const NOT_A_PART = "a sheet is asked for as ?part=head or ?part=layer&index=<n>";

/**
 * What a caller is told when the part is one this feed serves but the index beside it is not a
 * place in a roster. Its own sentence: a client answered with the part's copy is told to ask for
 * exactly what it did ask for, and learns nothing about which half of the address was wrong.
 */
const NOT_AN_INDEX = "?index= is a layer's place in the roster the head published: a whole number from 0 upwards";

/** What the address asks for: the head, or one layer by its place in the roster the head published. */
type Asked = { readonly part: "head" } | { readonly part: "layer"; readonly index: number };

/**
 * The address's question, or the sentence saying which half of it this feed cannot read. The index
 * is judged as text rather than by `Number`, which reads a blank string as zero and would serve the
 * first layer to an address that named no layer at all.
 */
function askedFor(query: URLSearchParams): Asked | { readonly error: string } {
  const part = query.get("part") ?? "head";
  if (part === "head") return { part };
  if (part !== "layer") return { error: NOT_A_PART };
  const asked = query.get("index") ?? "";
  if (!/^\d+$/.test(asked)) return { error: NOT_AN_INDEX };
  return { part, index: Number(asked) };
}

/** A JSON answer, uncached. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

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

export async function GET(request: Request, route: { params: Promise<{ drawing: string; layout: string }> }): Promise<Response> {
  // The context is minted from the request itself, which is what every transport and every harness
  // that drives this door hands it: the presented session is resolved once, by the seam that owns
  // that question, and the id a fault would be recorded under comes from the same mint (R-SPINE-001).
  let context: AppContext | null = null;
  try {
    const { drawing, layout } = await route.params;
    const asked = new URL(request.url).searchParams;
    // `?part=` and `?index=` are two different questions, and both are about the address rather than
    // about the caller: they are judged together, before anybody is asked who is calling, so a
    // signed-out client with an unreadable index learns which of the two it got wrong instead of
    // being told to sign in first (ARCH-03).
    const wanted = askedFor(asked);
    if ("error" in wanted) return json({ error: wanted.error }, 400);

    context = await createContext({ req: request });
    if (context.session === null) return refusalAnswer("SIGNED_OUT");

    // The workspace the address is inside, as the screen asking knows it. A caller who holds that
    // workspace is told the truth about a drawing it does not hold — an absence, which is the empty
    // cell that teaches — while everybody else is told only that they do not hold the workspace, so
    // a stranger still learns nothing about somebody else's drawings (Q-12).
    const asking = asked.get("tenant");
    const owner = await workspaceOfDrawing(drawing);
    const tenantId = owner ?? asking;
    if (tenantId === null || tenantId === undefined || (asking !== null && asking !== tenantId))
      return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");
    if (!(await holdsWorkspace(context.session.userId, tenantId))) return refusalAnswer("WORKSPACE_PERMISSION_NOT_HELD");

    // The segment Next resolved is the sheet's name: it arrives decoded, and reading it again would
    // collide two addresses and fault on a name carrying a bare `%` (R-UI-031).
    const head = await renderManifestOf({ tenantId, drawingId: drawing, layoutName: layout }, { storage: appStorage() });
    if (wanted.part === "head") return headAnswer(head);
    return layerAnswer(head, wanted.index);
  } catch (failure) {
    const { faultId } = reportFault({
      requestId: context?.requestId ?? randomUUID(),
      actor: context?.actor ?? "viewer",
      route: ROUTE,
      cause: failure,
    });
    return json({ faultId }, 500);
  }
}
