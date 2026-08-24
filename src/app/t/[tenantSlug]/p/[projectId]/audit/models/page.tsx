/**
 * `/t/{tenantSlug}/p/{projectId}/audit/models` — the model-call ledger (R-SPINE-081's "model-call
 * ledger per project (calls, cost, outcome)", L-AI-03; docs/design/s-audit.md §4).
 *
 * M0 records no model call — the model seam and its ledger are a later increment's — so the
 * pane's whole content is the teaching empty state: what will appear here, and why nothing does
 * yet (R-UI-033). No action button, because nothing a reader does today makes a model call.
 *
 * The guard is the segment layout's: it has already answered `tenantContext` and 404'd a project
 * this workspace cannot see, and a pane that reads nothing has nothing further to ask.
 */
import { ten } from '../../../../../strings';

export default function ProjectAuditModelsPage() {
  return (
    <div>
      <h1 className="tenant-title">{ten('project.audit.nav.models')}</h1>
      <p className="tenant-lead">{ten('project.audit.models.lead')}</p>

      {/* Interpretation 7: the pane's read-only region is a labelled tab stop, so the shell's
          scrolling main region holds something a keyboard reader can reach. */}
      <section
        aria-label={ten('project.audit.nav.models')}
        className="project-audit-pane datum-focus-ring"
        data-testid="model-ledger"
        tabIndex={0}
      >
        <div className="datum-state-block" data-testid="model-ledger-empty">
          <p className="datum-state-title">{ten('project.audit.models.empty.title')}</p>
          <p className="datum-state-body">{ten('project.audit.models.empty.teach')}</p>
        </div>
      </section>
    </div>
  );
}
