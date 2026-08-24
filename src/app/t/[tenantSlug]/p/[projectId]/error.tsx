'use client';

/**
 * The project segment's error boundary (docs/design/shell.md §6).
 *
 * The same answer `(area)/error.tsx` gives, one segment over: it sits below the project's own
 * layout, so a failure inside a pane is answered inside the intact shell — rail, top bar and
 * the project's own breadcrumb still where they were — and the reader is still somewhere rather
 * than nowhere. R-UI-050's error state carries the id a reader quotes back and a retry that
 * re-renders the pane.
 */
import { SHELL_STATES, ShellAreaState } from '../../../../../ui/shell';

const NO_DIGEST = 'SHELL-0000';

export default function ProjectSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ShellAreaState state={SHELL_STATES.error} reportId={error.digest ?? NO_DIGEST} onRetry={reset} />
  );
}
