'use client';

/**
 * The patterns `EmptyState` with a navigation for its action.
 *
 * The pattern takes `onAction` — a handler, which a server component cannot hand it — so the
 * one line of interactivity the landing and the 404 need lives here rather than turning
 * either screen into a client component.
 */
import { EmptyState } from '../../ui/patterns';

export interface NavEmptyStateProps {
  readonly title: string;
  readonly teach: string;
  readonly actionLabel: string;
  readonly href: string;
}

export function NavEmptyState({ title, teach, actionLabel, href }: NavEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      teach={teach}
      actionLabel={actionLabel}
      onAction={() => window.location.assign(href)}
    />
  );
}
