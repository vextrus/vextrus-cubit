/**
 * `/t/{tenantSlug}/p/{projectId}/settings/project` — the R-SPINE-010 fields, edit and archive
 * (R-SPINE-010, J-003; panes file §2).
 *
 * Server-rendered whole: nothing streams under `/t`, the guard answers before any byte, and one
 * seam read fills the pane — which is what makes a saved edit true on the next reload without
 * the screen holding anything of its own. The sft display is derived here, from the *saved* m²,
 * so what a reader sees converted is what the row holds (panes file Interpretation 9).
 *
 * The project itself is resolved by the segment layout above (a project of another workspace is
 * not a row this scope can see, so it 404s there); this page reads it again because a layout's
 * answer is not a page's, and both are one indexed read.
 */
import { notFound, redirect } from 'next/navigation';
import { ProjectFieldsPane } from './fields-pane';
import { gfaSft, projectContext, readProject } from '../../../../../../../modules/spine/projects';
import { SIGN_IN_PATH, tenantContext } from '../../../../../../../server/session';

export default async function ProjectFieldsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
  const project = await readProject(ctx, { projectId });
  if (project === null) notFound();

  return (
    <ProjectFieldsPane
      tenantSlug={context.slug}
      project={{
        id: project.id,
        name: project.name,
        code: project.code,
        client: project.client ?? '',
        siteAddress: project.siteAddress ?? '',
        district: project.district ?? '',
        buildingType: project.buildingType ?? '',
        storeys: project.storeys === null ? '' : String(project.storeys),
        gfaM2: project.targetGfaM2 ?? '',
        notes: project.notes ?? '',
        archived: project.archived,
      }}
      gfaSftText={gfaSft(project.targetGfaM2)}
    />
  );
}
