'use client';

import { useState } from 'react';
import { ErrorState } from '../../ui/primitives/screen-state';

/**
 * R-UI-050 — the error state for every auth screen and for /account/sessions.
 *
 * A refusal is a *decision* the product made and renders in place with its code
 * (R-UI-020, RefusalState). This is the other thing: a fault nobody decided.
 * It offers the retry Next's boundary gives us and an id worth quoting, which
 * is the digest where the server made one and a fresh id where it did not.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reportId] = useState(() => error.digest ?? crypto.randomUUID());
  return <ErrorState reportId={reportId} onRetry={reset} />;
}
