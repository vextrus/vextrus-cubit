/**
 * `/t/{tenantSlug}/p/{projectId}/audit/jobs` — the job history (R-SPINE-081's "job history";
 * docs/design/s-audit.md §5).
 *
 * No job runner exists in M0 and no run has a store, so the pane is the teaching empty state:
 * which of this project's work runs as a job, and where its outcome will read (R-UI-033). When
 * jobs exist (M1, R-UI-024) the run list replaces the block inside this same wrapper, which is
 * why the wrapper and the block are two elements and not one.
 *
 * The guard is the segment layout's, as on the ledger beside it.
 */
import { ten } from '../../../../../strings';

export default function ProjectAuditJobsPage() {
  return (
    <div>
      <h1 className="tenant-title">{ten('project.audit.nav.jobs')}</h1>
      <p className="tenant-lead">{ten('project.audit.jobs.lead')}</p>

      {/* Interpretation 7: a labelled tab stop, the ruleset params-table precedent. */}
      <section
        aria-label={ten('project.audit.nav.jobs')}
        className="project-audit-pane datum-focus-ring"
        data-testid="job-history"
        tabIndex={0}
      >
        <div className="datum-state-block" data-testid="job-history-empty">
          <p className="datum-state-title">{ten('project.audit.jobs.empty.title')}</p>
          <p className="datum-state-body">{ten('project.audit.jobs.empty.teach')}</p>
        </div>
      </section>
    </div>
  );
}
