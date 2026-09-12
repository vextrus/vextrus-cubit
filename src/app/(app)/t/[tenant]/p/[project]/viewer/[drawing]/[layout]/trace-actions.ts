"use server";
// The Trace's two reads for this route (R-UI-022, R-TO-011, X-2): the evidence of the line an address
// named, and the published lines citing what a reader holds on the sheet.
//
// The shapes are `scale-actions.ts`'s, verbatim: one dialect for a read door in this route, not a
// second per region (B-17). There is no browser tRPC client, so the screen reaches the module through
// these actions while the lane's own `takeoff.lineEvidence` / `takeoff.linesCiting` procedures answer
// the same module — one reading, two doors, exactly as the scale already is (risk note 4).
//
// Both doors are opened through the one server-call seam (`@/server/call`): it reads what the screen
// stated against the schemas below and resolves the presented session ONCE for the action. The actor
// is derived here and never taken from the caller: `projectActorFor` is the one place that turns a
// session and a project into a workspace-scoped actor (B-17, ARCH-02). A registered refusal is
// carried back to the screen that asked, never turned into a fault and never swallowed (ARCH-03,
// B-21). A line this project does not hold is neither: the module answers `null` and this door
// carries that null, which is the Trace's `missing` cell (I-88's idiom).
import { z } from "zod";
import type { RefusalCode } from "@/core/errors";
import { lineEvidence, linesCiting, type LineEvidence } from "@/modules/takeoff/trace";
import { serverCall } from "@/server/call";
import { projectActorFor } from "@/server/routers/spine";

/** The permission reading a project's measurements stands on (L-ACT-03's read side). */
const MEASURE = "MEASURE" as const;

/** Which line is being traced, in which project. */
export interface LineEvidenceRequest {
  projectId: string;
  lineId: string;
}

/** Which sheet's lines are being asked for, and which of its keys are held. */
export interface LinesCitingRequest {
  projectId: string;
  drawingId: string;
  sourceKeys: readonly string[];
}

/** What the Trace's read answered: the evidence, the fact that there is none, or the refusal. */
export type EvidenceAnswer = { read: true; evidence: LineEvidence | null } | { read: false; refusal: RefusalCode };

/** What the other direction answered: the citing lines — possibly none — or the refusal. */
export type CitingAnswer = { read: true; lines: LineEvidence[] } | { read: false; refusal: RefusalCode };

/** What the screen may state at these two doors: an address inside one project, and nothing wider. */
const EVIDENCE: z.ZodType<LineEvidenceRequest> = z.object({ projectId: z.string(), lineId: z.string() });

const CITING: z.ZodType<LinesCitingRequest> = z.object({ projectId: z.string(), drawingId: z.string(), sourceKeys: z.array(z.string()) });

const evidence = serverCall(
  EVIDENCE,
  async (request, session): Promise<EvidenceAnswer> => {
    const actor = await projectActorFor(session.userId, request.projectId, null, MEASURE);
    return { read: true, evidence: await lineEvidence({ tenantId: actor.tenantId, projectId: request.projectId }, request.lineId) };
  },
  (refusal): EvidenceAnswer => ({ read: false, refusal }),
);

const citing = serverCall(
  CITING,
  async (request, session): Promise<CitingAnswer> => {
    // The sheet this read is about is a value the screen stated, so it is BOUND to the project at
    // the guard rather than merely scoped to the workspace: the row policy is a tenant boundary, and
    // every project of one workspace reads under it, so a drawing id from one project's screen
    // reached a sibling project's sheet and the policy handed it over (R-SPINE-004).
    const actor = await projectActorFor(session.userId, request.projectId, null, MEASURE, request.drawingId);
    const lines = await linesCiting({ tenantId: actor.tenantId, projectId: request.projectId }, { drawingId: request.drawingId, sourceKeys: request.sourceKeys });
    return { read: true, lines };
  },
  (refusal): CitingAnswer => ({ read: false, refusal }),
);

export async function readLineEvidence(request: LineEvidenceRequest): Promise<EvidenceAnswer> {
  return evidence(request);
}

export async function readLinesCiting(request: LinesCitingRequest): Promise<CitingAnswer> {
  return citing(request);
}
