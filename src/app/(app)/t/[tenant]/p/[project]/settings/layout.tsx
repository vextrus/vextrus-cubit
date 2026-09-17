// Every project settings screen is drawn in one frame (Design Direction 00 §3.6): the project's
// settings areas on the left, the screen's own content on the right. The frame is HERE rather than
// in each page, so `PROJECT_SETTINGS_AREAS` has one reader and a screen that lands tomorrow arrives
// inside the nav by existing (I-RSA-3, B-17).
//
// The layout guards nothing: each page below it opens its own door with the participation and the
// permission that screen's read asks for (AM-11), and a layout that authorized as well would be a
// second guard answering for reads it cannot see.
import type { ReactNode } from "react";
import { ProjectSettingsFrame } from "./project-settings-frame";

export default async function ProjectSettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string; project: string }>;
}) {
  const { tenant, project } = await params;
  return (
    <ProjectSettingsFrame tenantId={tenant} projectId={project}>
      {children}
    </ProjectSettingsFrame>
  );
}
