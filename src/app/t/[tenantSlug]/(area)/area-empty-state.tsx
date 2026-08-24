'use client';

/**
 * An area's empty state whose next action is another address (docs/design/shell.md §4).
 *
 * `ShellAreaState` takes `onAction` — a handler, which a Server Component cannot hand it — so
 * the one line of interactivity Books and Settings need lives here rather than turning either
 * area into a client screen. The navigation goes through the router: R-UI-031 says the URL is
 * the source of truth, and a router push leaves the history exactly as the browser's own back
 * button expects to find it.
 */
import { useRouter } from 'next/navigation';
import { SHELL_STATES, ShellAreaState } from '../../../../ui/shell';

export interface AreaEmptyStateProps {
  readonly title: string;
  readonly teach: string;
  readonly actionLabel: string;
  readonly href: string;
}

export function AreaEmptyState({ title, teach, actionLabel, href }: AreaEmptyStateProps) {
  const router = useRouter();
  return (
    <ShellAreaState
      state={SHELL_STATES.empty}
      title={title}
      teach={teach}
      actionLabel={actionLabel}
      onAction={() => router.push(href)}
    />
  );
}
