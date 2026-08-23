'use client';

/**
 * The `/t` error boundary (§7).
 *
 * R-UI-050's error state: the patterns `ErrorState`, carrying the report id a reader quotes
 * back. The runtime's own digest is that id where there is one; where there is not, the
 * literal `AUTH-0000` stands in — a code, rendered verbatim, so the reader still has
 * something to say and support still has something to look for.
 */
import { ErrorState } from '../../ui/patterns';

const NO_DIGEST = 'AUTH-0000';

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="tenant-main">
      <ErrorState reportId={error.digest ?? NO_DIGEST} onRetry={reset} />
    </main>
  );
}
