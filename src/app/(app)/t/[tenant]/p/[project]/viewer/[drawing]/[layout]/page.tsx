// S-Viewer's address (R-UI-031): the workspace, the project, the drawing, the sheet — and the camera
// in `v`, so a sheet at a viewport is one link. The screen is the client's; this component reads the
// four segments and hands them over — through the project's choke point, which it asks for itself.
//
// It used to ask nothing ("the membership guard is the workspace layout's"): the layout answers the
// WORKSPACE question and never sees the project, so a member of the workspace who is on none of its
// projects got the screen and a canvas whose every fetch 403s — a blank viewer rather than a "you
// may not". The page asks the same question the feed behind it asks, so the refusal has a surface.
//
// Nothing of the sheet is read here on purpose: a 100 000-entity manifest carried into the page would
// be paid for before anything could be drawn, so the client asks the feed for the head and then for
// each layer (R-UI-043, PB-2).
import { LINE_PARAM } from "@/modules/takeoff/trace/address";
import { authorizePage } from "@/server/authorize-page";
import { SELECTION_PARAM } from "@/modules/takeoff/viewer-inspector/selection";
import { fill, strings } from "@/ui/strings";
import { layoutNameOf } from "./route-address";
import { ViewerScreen } from "./viewer-screen";

// Next hands a dynamic segment over already decoded, so the segment IS the sheet's name: decoding it
// a second time would make `/viewer/{d}/%256Dodel` and `/viewer/{d}/model` one address, leave a sheet
// whose own name carries a percent sequence unaddressable, and throw `URIError` on a name like `50%`
// (R-UI-031).
export async function generateMetadata({ params }: { params: Promise<{ layout: string }> }): Promise<{ title: string }> {
  const { layout } = await params;
  return { title: fill(strings.viewer_canvas_label, { layout: layoutNameOf(layout) }) };
}

export default async function ViewerSheet({
  params,
  searchParams,
}: {
  params: Promise<{
    tenant: string;
    project: string;
    drawing: string;
    layout: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project, drawing, layout } = await params;
  // The same question the feed asks, so a caller the feed will refuse meets a refusal here instead
  // of an empty canvas (R-UI-050: each state says the true thing).
  const { tenantId } = await authorizePage({ tenant, project, participation: true });
  const asked = await searchParams;
  const viewport = asked["v"];
  const selection = asked[SELECTION_PARAM];
  // The row a Trace was followed from, where the address names one (R-UI-022): what the selection
  // tab reads its Trace block from, and the way back the block links.
  const line = asked[LINE_PARAM];

  return (
    <ViewerScreen
      tenantId={tenantId}
      projectId={project}
      drawingId={drawing}
      layoutName={layout}
      initialViewport={typeof viewport === "string" ? viewport : null}
      initialSelection={typeof selection === "string" ? selection : null}
      initialLine={typeof line === "string" && line.length > 0 ? line : null}
    />
  );
}
