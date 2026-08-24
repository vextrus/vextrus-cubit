'use client';

/**
 * The tenant segment's error boundary (docs/design/shell.md §6).
 *
 * It sits below the segment layout, so a failure inside an area is answered inside the intact
 * shell: the rail, the top bar and the breadcrumb stay where they were and the reader is still
 * somewhere rather than nowhere. R-UI-050's error state carries the id a reader quotes back —
 * the runtime's digest where there is one, and the literal `SHELL-0000` where there is not —
 * and a retry that re-renders the area.
 *
 * `src/app/t/error.tsx` stays for the failures above this segment, which have no shell to
 * render inside.
 */
import { SHELL_STATES, ShellAreaState } from '../../../../ui/shell';

const NO_DIGEST = 'SHELL-0000';

export default function TenantSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ShellAreaState
      state={SHELL_STATES.error}
      reportId={error.digest ?? NO_DIGEST}
      onRetry={reset}
    />
  );
}
