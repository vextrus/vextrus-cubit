"use client";
// The seam the palette asks, as a browser reaches it: one GET against the tRPC mount, and the one
// envelope the pattern reads back (risk note 3). Normalising every transport shape into that
// envelope is this layer's whole job — `src/ui` never learns what a procedure or a status code is
// (ARCH-01), and the pattern recognises a refusal by the envelope's `refusal` field and nothing
// else, so no surface has to guess at a shape again.
import type { SearchHit } from "@/server/spine/search";

export type { SearchHit };

/** What the palette asks for: the workspace it stands in, and what was typed into it. */
export interface SearchRequest {
  readonly tenantId: string;
  readonly query: string;
}

/**
 * The ONLY carrier the pattern reads: hits, plus at most one registered refusal code or one fault
 * id beside them. A rejected promise is a fault (ARCH-03) — never a refusal.
 */
export interface SearchAnswer {
  readonly hits: readonly SearchHit[];
  readonly refusal?: string | null;
  readonly faultId?: string | null;
}

export type SearchFn = (request: SearchRequest) => Promise<SearchAnswer>;

/** The mount `src/app/api/trpc/[trpc]/route.ts` serves, and the door under it. */
const DOOR = "/api/trpc/spine.search";

/** The envelope tRPC answers with: a result, or the error the formatter shaped (src/server/trpc.ts). */
interface Envelope {
  result?: { data?: { hits?: readonly SearchHit[] } };
  error?: { data?: { kind?: string; refusalCode?: string; faultId?: string } };
}

/**
 * Ask the workspace. A refusal and a fault are both answers here, told apart by what the server
 * decided rather than by a status code this layer re-reads; a body that is no envelope at all is a
 * server that answered something else, which is a fault carrying no id to quote.
 */
export const searchWorkspaceAction: SearchFn = async (request: SearchRequest): Promise<SearchAnswer> => {
  const response = await fetch(`${DOOR}?input=${encodeURIComponent(JSON.stringify(request))}`, { method: "GET", credentials: "same-origin" });
  const body = await response.text();
  let envelope: Envelope;
  try {
    envelope = JSON.parse(body) as Envelope;
  } catch {
    // A body that is not the tRPC envelope — Next's own 500 page, a proxy's error page, a 404 from
    // a mount that moved — is still a server that answered, so it is a fault and never a refusal
    // (ARCH-03). It carries no id to quote, which is what the null says (the auth transport's I-12).
    throw Object.assign(new Error(`the server answered ${response.status} with a body that is not a tRPC envelope`), {
      data: { kind: "fault", faultId: null },
    });
  }

  const failure = envelope.error;
  if (failure !== undefined) {
    const stated = failure.data ?? {};
    if (stated.kind === "refusal" && typeof stated.refusalCode === "string") return { hits: [], refusal: stated.refusalCode };
    return { hits: [], faultId: typeof stated.faultId === "string" ? stated.faultId : "" };
  }
  return { hits: envelope.result?.data?.hits ?? [] };
};
