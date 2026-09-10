"use server";
// The Trace's two reads for this route (R-UI-022, R-TO-011, X-2): the evidence of the line an address
// named, and the published lines citing what a reader holds on the sheet.
//
// The shapes are `scale-actions.ts`'s, verbatim: one dialect for a read door in this route, not a
// second per region (B-17). There is no browser tRPC client, so the screen reaches the module through
// these actions while the lane's own `takeoff.lineEvidence` / `takeoff.linesCiting` procedures answer
// the same module — one reading, two doors, exactly as the scale already is (risk note 4).
//
// The actor is derived here and never taken from the caller: `projectActorFor` is the one place that
// turns a session and a project into a workspace-scoped actor (B-17, ARCH-02). A registered refusal
// is carried back to the screen that asked, never turned into a fault and never swallowed
// (ARCH-03, B-21). A line this project does not hold is neither: the module answers `null` and this
// door carries that null, which is the Trace's `missing` cell (I-88's idiom).
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { lineEvidence, linesCiting, type LineEvidence } from "@/modules/takeoff/trace";
import { projectActorFor } from "@/server/routers/spine";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";

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

export async function readLineEvidence(request: LineEvidenceRequest): Promise<EvidenceAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { read: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, null, MEASURE);
    return { read: true, evidence: await lineEvidence({ tenantId: actor.tenantId, projectId: request.projectId }, request.lineId) };
  } catch (thrown) {
    return { read: false, refusal: refused(thrown) };
  }
}

export async function readLinesCiting(request: LinesCitingRequest): Promise<CitingAnswer> {
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { read: false, refusal: REFUSALS.SIGNED_OUT.code };
  try {
    const actor = await projectActorFor(session.userId, request.projectId, null, MEASURE);
    const lines = await linesCiting({ tenantId: actor.tenantId, projectId: request.projectId }, { drawingId: request.drawingId, sourceKeys: request.sourceKeys });
    return { read: true, lines };
  } catch (thrown) {
    return { read: false, refusal: refused(thrown) };
  }
}

/**
 * The registered code a failure travels with, or the failure itself. A refusal is an answer and is
 * carried back; anything else is a fault, and re-throwing it is what puts it on the error boundary
 * with a recorded fault id rather than on this screen as a sentence nobody registered (ARCH-03).
 */
function refused(thrown: unknown): RefusalCode {
  const code = refusalCodeOf(thrown);
  // A marker carrying a code the register does not hold is not a refusal the product can answer
  // with, so it travels as what it is (R-SPINE-062, B-06).
  if (code === null || !Object.hasOwn(REFUSALS, code)) throw thrown;
  return code as RefusalCode;
}
