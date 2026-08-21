/**
 * The R-UI-050 roster, minus the two that live elsewhere (refusal.tsx, consequence-dialog.tsx).
 *
 * R-UI-050: "Every screen defines and renders: loading (skeleton), empty (teaches next
 * action), error (retry + report id), refusal (code + remedy), partial (some rows refused:
 * shown, not hidden), offline (banner; read-only), permission-denied (what permission, who
 * holds it)."
 *
 * Loading is deliberately absent: it is the Skeleton primitive, consumed by the screen at the
 * shape of the content it is waiting for. A second loading component here would be a skeleton
 * that does not know what it is standing in for.
 *
 * What these five have in common is that the copy *is* the design (§6): no icons, no
 * illustrations, no tint carrying a meaning the words do not (R-UI-060). The words come from
 * the module's table, decided in docs/design/datum-patterns.md §7 — except EmptyState's, which
 * is the composing screen's, because only that screen knows what the next action is.
 */
import type { ReactElement } from 'react';
import { Button } from '../primitives/button';
import { cx } from '../primitives/class-names';
import { formatNumber } from '../../core/format';
import { around, fill, ps } from './strings';

/** ARIA's own vocabulary for a region that announces without stealing focus. */
const STATUS = 'status';

/** A whole number as the document writes it (R-SPINE-061), through the seam (L-FMT-01). */
function countText(value: number): string {
  return formatNumber(String(value), 'count');
}

export interface EmptyStateProps {
  /** What is not here, in the screen's words. */
  readonly title: string;
  /** The next action, in one sentence — an empty screen that teaches nothing is a dead end. */
  readonly teach: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function EmptyState({
  title,
  teach,
  actionLabel,
  onAction,
}: EmptyStateProps): ReactElement {
  return (
    <div data-testid="empty-state" className="datum-state-block">
      <p className="datum-state-title">{title}</p>
      <p className="datum-state-body">{teach}</p>
      {actionLabel === undefined ? null : (
        <div className="datum-state-actions">
          <Button variant="secondary" data-testid="empty-state-action" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  /** The id a reader quotes back — rendered verbatim, because that is its whole use. */
  readonly reportId: string;
  readonly onRetry: () => void;
}

export function ErrorState({ reportId, onRetry }: ErrorStateProps): ReactElement {
  return (
    <div data-testid="error-state" className="datum-state-block">
      <p className="datum-state-title">{ps('patterns.error.title')}</p>
      <p className="datum-state-body">{ps('patterns.error.body')}</p>
      <p className="datum-state-body">
        {ps('patterns.error.reportLabel')}{' '}
        <span data-testid="error-state-report-id" className={cx('datum-report-id', 'numeric')}>
          {reportId}
        </span>
      </p>
      <div className="datum-state-actions">
        <Button variant="secondary" data-testid="error-state-retry" onClick={onRetry}>
          {ps('patterns.error.retry')}
        </Button>
      </div>
    </div>
  );
}

export interface PartialNoticeProps {
  /** How many rows were refused. They stay in the list; this says how many to look for. */
  readonly refusedCount: number;
}

export function PartialNotice({ refusedCount }: PartialNoticeProps): ReactElement {
  const [before, after] = around('patterns.partial.text', 'count');
  return (
    <p data-testid="partial-notice" role={STATUS} className={cx('datum-bar', 'datum-bar-warn')}>
      {before}
      <span className="numeric">{countText(refusedCount)}</span>
      {after}
    </p>
  );
}

export function OfflineBanner(): ReactElement {
  // No dismiss control: the banner leaves when the connection returns, not when it is waved
  // away (§7). A reader who dismissed it would be reading stale data with nothing saying so.
  return (
    <p data-testid="offline-banner" role={STATUS} className={cx('datum-bar', 'datum-bar-info')}>
      {ps('patterns.offline')}
    </p>
  );
}

export interface PermissionDeniedProps {
  /** The permission that was missing — an identifier, rendered as one. */
  readonly permission: string;
  /** Who holds it: R-UI-050's "who holds it" is a person to ask, not a support address. */
  readonly holder: string;
}

export function PermissionDenied({ permission, holder }: PermissionDeniedProps): ReactElement {
  const [before, after] = around('patterns.permission.body', 'permission');
  return (
    <div data-testid="permission-denied" className="datum-state-block">
      <p className="datum-state-title">{ps('patterns.permission.title')}</p>
      <p className="datum-state-body">
        {before}
        <span className="datum-permission">{permission}</span>
        {after}
      </p>
      {/* The remedy is a person, not a button (§7). */}
      <p className="datum-state-body">{fill('patterns.permission.remedy', 'holder', holder)}</p>
    </div>
  );
}
