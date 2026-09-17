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
import { DocumentsScreen, type DocumentsRowView } from "./documents-screen";
import { DOCUMENT_LINK_TTL_SECONDS } from "./links";

export const metadata = { title: strings.documents_title };

/** The file route this screen answers at, as the fault seam and the state matrix both key it. */
const ROUTE = "/t/[tenant]/p/[project]/documents";

export default async function ProjectDocuments({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (ARCH-02, B-17): session, then the workspace the
  // PROJECT is really in, then the read. The tenant the read is scoped by is the guard's answer and
  // never the segment a caller typed.
  const { tenantId, userId } = await authorizePage({ tenant, project });

  // A read that fails is a fault, not an empty list: it is recorded once, at the one seam that mints
  // a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let rows: readonly DocumentsRowView[] | null = null;
  let reportId: string | null = null;
  try {
    const listed = await forTenant({ tenantId }).transaction((tx) => listDocuments(tx, project));
    // The link is minted per render and per row (I-264): what the reader is handed is signed for the
    // document the row names, and it goes stale on its own rather than being held anywhere.
    rows = listed.map((listing) => ({
      ...listing,
      href: documentDownloadUrl(appStorage(), { id: listing.id, tenantId, sha256: listing.sha256 }, { expiresInSeconds: DOCUMENT_LINK_TTL_SECONDS }),
    }));
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: ROUTE, cause }).faultId;
  }

  return <DocumentsScreen rows={rows} tenantId={tenantId} projectId={project} reportId={reportId} />;
}
