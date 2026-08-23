'use client';

/**
 * `ShellAreaState` — the seven states R-UI-050 requires of every screen, in one component
 * (docs/design/shell.md §6).
 *
 * R-UI-050: "Every screen defines and renders: loading (skeleton), empty (teaches next
 * action), error (retry + report id), refusal (code + remedy), partial (some rows refused:
 * shown, not hidden), offline (banner; read-only), permission-denied (what permission, who
 * holds it)."
 *
 * Nothing here re-implements a state. Six of them are the `src/ui/patterns` components the
 * pattern layer already decided — one wording of "this could not be loaded", one anatomy for
 * a refusal — and the seventh, loading, is the Skeleton primitive taken at the shape of the
 * content it stands in for. What this component adds is the roster: a screen holding one of
 * these can render any of the seven without inventing the six it is not showing today, and
 * the state it is in is a value rather than a branch spread across a page.
 *
 * The props are a union on `state`, so the substance each state needs is the substance the
 * compiler asks for: an error with no report id and a permission denial with no holder are
 * both things R-UI-050 forbids, and neither one compiles.
 */
import type { ReactElement, ReactNode } from 'react';
import type { RefusalCode } from '../../core/errors';
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  PartialNotice,
  PermissionDenied,
  RefusalState,
} from '../patterns';
import { Skeleton } from '../primitives';
import { SHELL_SHAPES } from './contract';
import type { ShellSkeletonShape } from './contract';
import { sh } from './strings';

/** ARIA's own vocabulary, which is not copy (R-SPINE-060). */
const BUSY = 'true';
const STATUS = 'status';

/** §6: the area shape stands in for a heading and four rows; the inspector's for less. */
const AREA_BARS = Object.freeze([0, 1, 2, 3]);
const INSPECTOR_BARS = Object.freeze([0, 1]);

interface LoadingProps {
  readonly state: 'loading';
  /** Which column is waiting: the area's, or the inspector's narrower one. */
  readonly shape?: ShellSkeletonShape;
}

interface EmptyProps {
  readonly state: 'empty';
  /** What is not here, in this screen's words. */
  readonly title: string;
  /** The next action, in one sentence (R-UI-033). */
  readonly teach: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

interface ErrorProps {
  readonly state: 'error';
  /** The id a reader quotes back — the runtime's digest, or the screen's stand-in code. */
  readonly reportId: string;
  readonly onRetry: () => void;
}

interface RefusalProps {
  readonly state: 'refusal';
  /** A registered code: the message and remedy are the register's (L-QTY-04). */
  readonly code: RefusalCode;
  /** The evidence or setting that resolves it (R-UI-020). */
  readonly evidenceHref: string;
  readonly evidenceLabel?: string;
}

interface PartialProps {
  readonly state: 'partial';
  /** How many rows were refused. They stay on screen; this says how many to look for. */
  readonly refusedCount: number;
  /** The rows themselves — shown, not hidden. */
  readonly children?: ReactNode;
}

interface OfflineProps {
  readonly state: 'offline';
  /** What the reader may still read while the connection is gone. */
  readonly children?: ReactNode;
}

interface PermissionDeniedProps {
  readonly state: 'permission-denied';
  /** The permission that is missing, by its own name. */
  readonly permission: string;
  /** Who holds it — somebody to ask, not a support address. */
  readonly holder: string;
}

export type ShellAreaStateProps =
  | LoadingProps
  | EmptyProps
  | ErrorProps
  | RefusalProps
  | PartialProps
  | OfflineProps
  | PermissionDeniedProps;

/**
 * The loading skeleton at one of §6's two shapes.
 *
 * The bars are `aria-hidden` — the Skeleton primitive says so itself — and the wrapper is
 * `aria-busy` with a visually hidden status line, because a screen reader met by four
 * decorative rectangles is a screen reader told the area is empty.
 */
function ShellSkeleton({ shape }: { readonly shape: ShellSkeletonShape }): ReactElement {
  const inspector = shape === SHELL_SHAPES.inspector;
  const bars = inspector ? INSPECTOR_BARS : AREA_BARS;
  return (
    <div
      data-testid="shell-skeleton"
      data-shape={shape}
      aria-busy={BUSY}
      className="shell-skeleton"
    >
      <span role={STATUS} className="shell-visually-hidden">
        {sh('shell.loading')}
      </span>
      <Skeleton className="shell-skeleton-head" />
      {bars.map((bar) => (
        <Skeleton key={bar} className="shell-skeleton-bar" />
      ))}
    </div>
  );
}

export function ShellAreaState(props: ShellAreaStateProps): ReactElement {
  switch (props.state) {
    case 'loading':
      return <ShellSkeleton shape={props.shape ?? SHELL_SHAPES.area} />;
    case 'empty':
      return (
        <EmptyState
          title={props.title}
          teach={props.teach}
          {...(props.actionLabel === undefined ? {} : { actionLabel: props.actionLabel })}
          {...(props.onAction === undefined ? {} : { onAction: props.onAction })}
        />
      );
    case 'error':
      return <ErrorState reportId={props.reportId} onRetry={props.onRetry} />;
    case 'refusal':
      return (
        <RefusalState
          code={props.code}
          evidenceHref={props.evidenceHref}
          {...(props.evidenceLabel === undefined ? {} : { evidenceLabel: props.evidenceLabel })}
        />
      );
    case 'partial':
      // R-UI-050: "some rows refused: shown, not hidden" — the notice sits above the rows it
      // is counting, and the rows stay exactly where they were.
      return (
        <div className="shell-area-state">
          <PartialNotice refusedCount={props.refusedCount} />
          {props.children}
        </div>
      );
    case 'offline':
      return (
        <div className="shell-area-state">
          <OfflineBanner />
          {props.children}
        </div>
      );
    case 'permission-denied':
      return <PermissionDenied permission={props.permission} holder={props.holder} />;
  }
}
