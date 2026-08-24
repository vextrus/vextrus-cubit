'use server';

/**
 * Creating a project, as a server action (R-SPINE-010, docs/design/s-home.md §5).
 *
 * It guards for itself. A client component's call is a request like any other — the session can
 * end and the slug in the URL is whatever the browser said — so the act re-derives the tenant
 * context from the cookie rather than trusting an id the page was rendered with, exactly as the
 * tenant-settings actions do.
 *
 * The answer is a value, never an exception: what the screen renders is either the project's own
 * pane or §5's alert line, and both are outcomes the reader is shown.
 */
import { createProject, projectContext } from '../../../../../modules/spine/projects';
import { tenantContext } from '../../../../../server/session';

/** What creating answers with: the project, or nothing that could be created. */
export type CreateProjectOutcome =
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false };

/** Every value s-home §5's form holds, as the wire carries it — strings throughout (B-07). */
export interface CreateProjectInput {
  readonly name: string;
  readonly code: string;
  readonly client: string;
  readonly siteAddress: string;
  readonly district: string;
  readonly buildingType: string;
  readonly storeys: string;
  readonly gfaM2: string;
  readonly notes: string;
}

export async function createProjectAction(
  tenantSlug: string,
  input: CreateProjectInput,
): Promise<CreateProjectOutcome> {
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out' || context === 'not-found') return { ok: false };
  try {
    const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
    const { projectId } = await createProject(ctx, {
      name: input.name,
      code: input.code,
      client: input.client,
      siteAddress: input.siteAddress,
      district: input.district,
      buildingType: input.buildingType,
      storeys: input.storeys,
      targetGfaM2: input.gfaM2,
      notes: input.notes,
    });
    return { ok: true, projectId };
  } catch {
    // §5: "A request that never completes renders `project.form.failed` … nothing was created,
    // the entries stand." The founding is one transaction, so that sentence is literally true.
    return { ok: false };
  }
}
