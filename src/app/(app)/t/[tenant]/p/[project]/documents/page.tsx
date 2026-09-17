// S-Documents (R-SPINE-040): every document this project has issued, newest first.
//
// Thin by design: the reading is `listDocuments`' own, the link on each row is the store's own mint,
// and this file asks for both once and hands them to the screen (ARCH-01, B-17). There is no
// procedure and no server action — nothing on this screen is interactive, so a door would be a
// second way to ask a question the render already answered.
import { forTenant } from "@/core/db";
import { documentDownloadUrl, listDocuments } from "@/core/documents/store";
import { reportFault } from "@/core/faults/report";
import { appStorage } from "@/core/storage/app";
import { authorizePage } from "@/server/authorize-page";
import { strings } from "@/ui/strings";
import { uiInstrumentArmed } from "@/app/theme-resolver";
import { demonstrationOf, type Demonstration } from "./demonstration";
import { DocumentsScreen, type DocumentsRowView } from "./documents-screen";
import { DOCUMENT_LINK_TTL_SECONDS } from "./links";

export const metadata = { title: strings.documents_title };

/** The file route this screen answers at, as the fault seam and the state matrix both key it. */
const ROUTE = "/t/[tenant]/p/[project]/documents";

/**
 * The evidence instrument's state door (`?__state=`, `theme-resolver.ts`): what the address asked
 * this screen to stand in, or null for the ordinary read. The names it answers to are the SCREEN's
 * own — `DOCUMENTS_STATES`, the vocabulary `documents-screen[data-state]` wears — so every cell a
 * reviewer is told about is a cell they can open. The door is armed by name and shut everywhere
 * else, so an installation that never opted in cannot be talked into it (the schedules precedent).
 */
function demanded(asked: string | readonly string[] | undefined): Demonstration | null {
  if (!uiInstrumentArmed() || typeof asked !== "string" || asked === "") return null;
  return demonstrationOf(asked);
}

export default async function ProjectDocuments({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (ARCH-02, B-17): session, then the workspace the
  // PROJECT is really in, then the read. The tenant the read is scoped by is the guard's answer and
  // never the segment a caller typed.
  const { tenantId, userId } = await authorizePage({ tenant, project });

  /** The link a row carries, minted for that row and for this render alone (I-264). */
  const linked = (listing: { id: string; sha256: string }): string =>
    documentDownloadUrl(appStorage(), { id: listing.id, tenantId, sha256: listing.sha256 }, { expiresInSeconds: DOCUMENT_LINK_TTL_SECONDS });

  // Asked for a state by name, on an installation that armed the instrument: the screen stands in
  // that state instead of in the one the read would put it in. The door is INSIDE authorization — an
  // address nobody may open opens nothing here either — and it reads no document: what it hands over
  // is listings of its own, minted into links by the same one mint the ordinary rows use (B-17).
  const demonstration = demanded((await searchParams)["__state"]);
  if (demonstration !== null) {
    const demonstrated = demonstration.listings.map((listing) => ({ ...listing, href: linked(listing) }));
    return <DocumentsScreen rows={demonstrated} tenantId={tenantId} projectId={project} reportId={demonstration.reportId} />;
  }

  // A read that fails is a fault, not an empty list: it is recorded once, at the one seam that mints
  // a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let rows: readonly DocumentsRowView[] | null = null;
  let reportId: string | null = null;
  try {
    const listed = await forTenant({ tenantId }).transaction((tx) => listDocuments(tx, project));
    // The link is minted per render and per row (I-264): what the reader is handed is signed for the
    // document the row names, and it goes stale on its own rather than being held anywhere.
    rows = listed.map((listing) => ({ ...listing, href: linked(listing) }));
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: ROUTE, cause }).faultId;
  }

  return <DocumentsScreen rows={rows} tenantId={tenantId} projectId={project} reportId={reportId} />;
}
