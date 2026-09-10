// REPUDIATE (R-TO-051: a person judges a register object to be nothing), rendered as L-ACT-02's pair.
//
// Nothing is updated and nothing is deleted (L-ACT-01): the object stands, its readings stand, and
// every quantity line measured off it stands. What the act writes is one `repudiated_objects` row —
// a table no bill can join — and that row is what a reader is told about them (I-173).
//
// An object the pinned revision does not hold, and one a person has already struck, are both acts
// that would leave every subject exactly as they found it, so the seam's own code says so by name.
import type { TenantTx } from "../db";
import { isRepudiatedIn, registerObjectIn, registerScopeIn, repudiateObjectIn, type RegisterObjectRow, type RegisterScope } from "../register/store";
import type { Consequence, ConsequenceSubject } from "./consequence";
import { actChangesNothing } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const REPUDIATE = "REPUDIATE" as const;

/** How the object stands before the act, and how it stands after — the words the dialog shows. */
const REGISTERED = "REGISTERED";
const REPUDIATED = "REPUDIATED";

/** The act's input: one project, and the one object a person judges to be nothing. */
export type RepudiateInput = {
  readonly type: typeof REPUDIATE;
  readonly projectId: string;
  readonly objectKey: string;
};

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  readonly scope: RegisterScope;
  readonly object: RegisterObjectRow;
};

/** The act, applied to the state this transaction read. */
async function derive(ctx: ActorCtx, input: RepudiateInput, tx: TenantTx): Promise<Derived> {
  const scope = await registerScopeIn(tx, ctx.tenantId, input.projectId);
  if (scope === null) throw actChangesNothing(REPUDIATE, [input.objectKey]);

  const object = await registerObjectIn(tx, scope, input.objectKey);
  if (object === undefined) throw actChangesNothing(REPUDIATE, [input.objectKey]);
  if (await isRepudiatedIn(tx, scope, input.objectKey)) throw actChangesNothing(REPUDIATE, [input.objectKey]);

  return { scope, object };
}

/** The one subject the act judges: the object, named by the mark a reader knows it by. */
function subjectOf(input: RepudiateInput, derived: Derived): ConsequenceSubject {
  return { subjectId: input.objectKey, subjectLabel: derived.object.mark, before: [REGISTERED], after: [REPUDIATED] };
}

export const repudiate: ActRendering<RepudiateInput> = {
  async preview(ctx: ActorCtx, input: RepudiateInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: REPUDIATE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: [subjectOf(input, derived)],
    };
  },

  async commit(ctx: ActorCtx, input: RepudiateInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    await repudiateObjectIn(tx, derived.scope, input.objectKey, act.actId);
  },
};
