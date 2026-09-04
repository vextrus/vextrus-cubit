// S-Viewer's address (R-UI-031): the workspace, the project, the drawing, the sheet — and the camera
// in `v`, so a sheet at a viewport is one link. The screen is the client's; this component reads the
// four segments and hands them over, and the membership guard is the workspace layout's (I-77).
//
// Nothing of the sheet is read here on purpose: a 100 000-entity manifest carried into the page would
// be paid for before anything could be drawn, so the client asks the feed for the head and then for
// each layer (R-UI-043, PB-2).
import { fill, strings } from "../../../../../../../../../ui/strings";
import { ViewerScreen } from "./viewer-screen";

export async function generateMetadata({ params }: { params: Promise<{ layout: string }> }): Promise<{ title: string }> {
  const { layout } = await params;
  return { title: fill(strings.viewer_canvas_label, { layout: decodeURIComponent(layout) }) };
}

export default async function ViewerSheet({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string; drawing: string; layout: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project, drawing, layout } = await params;
  const asked = await searchParams;
  const viewport = asked["v"];

  return (
    <ViewerScreen
      tenantId={tenant}
      projectId={project}
      drawingId={drawing}
      layoutName={decodeURIComponent(layout)}
      initialViewport={typeof viewport === "string" ? viewport : null}
    />
  );
}
