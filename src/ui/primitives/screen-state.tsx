import { strings } from '../strings/common';

/**
 * R-UI-050 — two of the states every screen defines, in the shape the owned
 * screens render them.
 *
 * Loading is a skeleton that keeps the layout (R-UI-004: never a spinner, and
 * never a jump when the content lands). Error carries a retry and a report id,
 * so the person has something to do and something to quote.
 */

export function LoadingSkeleton() {
  return (
    <div className="page" data-testid="loading-state" aria-busy="true">
      <span className="visually-hidden" role="status">
        {strings.loadingLabel}
      </span>
      <section className="panel" aria-hidden="true">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-block" />
      </section>
    </div>
  );
}

export interface ErrorStateProps {
  /** What to quote when reporting it: Next's digest where there is one. */
  reportId: string;
  onRetry: () => void;
}

export function ErrorState({ reportId, onRetry }: ErrorStateProps) {
  return (
    <div className="page">
      <section className="panel" data-testid="error-state" role="alert">
        <h1>{strings.errorTitle}</h1>
        <p className="auth-lede">{strings.errorLede}</p>
        <p className="row-meta">
          <span>{strings.errorReportLabel}</span>{' '}
          <span className="slug" data-testid="error-report-id">
            {reportId}
          </span>
        </p>
        <button
          type="button"
          className="button button-primary"
          data-testid="error-retry"
          onClick={onRetry}
        >
          {strings.retry}
        </button>
      </section>
    </div>
  );
}
