"use server";
// What the command palette asks the server for (R-SPINE-050). The read itself is
// `src/server/spine/search.ts` — the same one `spine.search` answers on the wire, so the browser and
// the transport can never disagree about what a workspace holds (B-17).
//
// The three answers are kept apart (ARCH-03, B-21): rows when the read succeeded, a registered code
// when it was refused, and a report id when it faulted. Nothing is swallowed and nothing is turned
// into the wrong kind of answer — a refusal carried back as a fault would put a retry button in
// front of a person whose session has ended.
import type { RefusalCode } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { reportFault } from "@/core/faults/report";
import { presentedSessionToken } from "@/server/shell/session";
import { holdsWorkspace } from "@/server/shell/workspace";
import { sessionOf } from "@/server/shell/resolve";
import { searchWorkspace, type SearchHit } from "@/server/spine/search";

/** The route a fault of this read is recorded against. */
const ROUTE = "palette.search";
const ACTOR = "web";

/** What the palette is answered with — one of the three, never two at once. */
export type PaletteSearchAnswer =
  | { readonly hits: readonly SearchHit[] }
  | { readonly refusal: RefusalCode }
  | { readonly fault: { readonly reportId: string } };

export async function paletteSearchAction(input: { tenantId: string; query: string }): Promise<PaletteSearchAnswer> {
  try {
    // The workspace is named by the address the palette stands over, and a name is not an admission:
    // the session's own membership is what opens it, and a session that has ended is told so rather
    // than answered with an empty list (R-SPINE-003, ARCH-03).
    const session = await sessionOf(await presentedSessionToken());
    if (session === null) return { refusal: "SIGNED_OUT" };
    if (!(await holdsWorkspace(session.userId, input.tenantId))) return { refusal: "WORKSPACE_PERMISSION_NOT_HELD" };
    return await searchWorkspace({ tenantId: input.tenantId }, input.query);
  } catch (failure) {
    const code = refusalCodeOf(failure);
    if (code !== null) return { refusal: code as RefusalCode };
    const { faultId } = reportFault({ requestId: requestId(), actor: ACTOR, route: ROUTE, cause: failure });
    return { fault: { reportId: faultId } };
  }
}

/** The thread a read the browser started is recorded under, so the record and the screen quote one. */
function requestId(): string {
  return globalThis.crypto.randomUUID();
}
