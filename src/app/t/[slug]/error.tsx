'use client';

import { useState } from 'react';
import { ErrorState } from '../../../ui/primitives/screen-state';

/**
 * R-UI-050 — the tenant home's error state. A tenant this account may not read
 * is a refusal with a code (TENANT_ACCESS_DENIED, rendered by the page itself);
 * this is a fault, with a retry and an id to quote.
 */
export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reportId] = useState(() => error.digest ?? crypto.randomUUID());
  return <ErrorState reportId={reportId} onRetry={reset} />;
}
