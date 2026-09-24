// S-Ask (R-AI-003, X-7, J-043): ask the drawings a question and read an answer whose every figure
// links back to what it was read from — the seventh tab of the takeoff lane (docs/design/s-ask.md).
//
// Thin by design: what the page stands on is `askArrivalOf`'s (the campaign, the stamp answers are
// kept with, the empty state's example), whether the reader may ask is the one participation reading
// (I-406), and every answer is the `ai.ask` door's, asked from the browser (`./actions`).
import "./ask.css";

import { participatesIn } from "@/core/acts";
import { forTenant } from "@/core/db";
import { reportFault } from "@/core/faults/report";
import { askArrivalOf } from "@/modules/takeoff/ask/arrival";
import { authorizePage } from "@/server/authorize-page";
import { strings } from "@/ui/strings";
import { uiInstrumentArmed } from "@/app/theme-resolver";
import { askTheDrawings } from "./actions";
import { AskScreen, type AskArrivalView } from "./ask-screen";
import { demonstrationOf, type Demonstrated } from "./demonstration";
import { QUESTION_PARAM } from "./route-address";

export const metadata = { title: strings.takeoff_nav_ask };

/** The file route this screen answers at, as the fault seam and the state matrix both key it. */
const ROUTE = "/t/[tenant]/p/[project]/takeoff/ask";

/**
 * The evidence instrument's state door (`?__state=`, `theme-resolver.ts`): what the address asked
 * this screen to stand in, or null for the ordinary read (R-UI-050, AM-09 §4).
 */
function demanded(asked: string | readonly string[] | undefined): Demonstrated | null {
  if (!uiInstrumentArmed() || typeof asked !== "string" || asked === "") return null;
  return demonstrationOf(asked);
}

export default async function ProjectAsk({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in, then the read.
  const { tenantId, userId } = await authorizePage({ tenant, project });
  const query = await searchParams;

  const demonstration = demanded(query["__state"]);
  if (demonstration !== null) {
    return (
      <AskScreen
        tenantId={tenantId}
        projectId={project}
        userId={userId}
        arrival={demonstration.arrival}
        participant={demonstration.participant}
        reportId={demonstration.reportId}
        question={null}
        door={askTheDrawings}
        demonstration={demonstration.demonstration}
      />
    );
  }

  // `authorizePage` admits any member of the workspace; asking needs a place on the project (I-406),
  // and a member with none is the screen's denied cell rather than a not-found — so the page asks the
  // participation reading itself, as the bar schedule asks its permission. The door refuses by name
  // regardless. A read that fails is a fault, recorded once, and the screen quotes its id (B-21).
  // `participant` starts true so a failure to answer it leaves the screen in `error`, not `denied`.
  let participant = true;
  let arrival: AskArrivalView | null = null;
  let reportId: string | null = null;
  try {
    participant = await forTenant({ tenantId }).transaction((tx) => participatesIn(tx, project, userId));
    if (participant) arrival = await askArrivalOf({ tenantId, projectId: project });
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: ROUTE, cause }).faultId;
  }

  const asked = query[QUESTION_PARAM];
  return (
    <AskScreen
      tenantId={tenantId}
      projectId={project}
      userId={userId}
      arrival={arrival}
      participant={participant}
      reportId={reportId}
      question={typeof asked === "string" && asked.trim() !== "" ? asked.trim() : null}
      door={askTheDrawings}
    />
  );
}
