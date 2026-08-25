"use client";

// ARCH-03, B-21: an outage renders the product's own error state, never a blank page and never a
// framework screen. The copy comes from the string table (C-SPINE-PLATFORM) and tells the truth —
// the work is safe, the fault is recorded for the operators, and the remedy is one button. No
// error internals are shown: a fault's cause belongs on the fault sink, not on a screen.
import { strings } from "../ui/strings";

export default function RootErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main data-testid="error-state">
      <section role="alert" aria-labelledby="error-state-title">
        <h1 id="error-state-title" data-testid="error-state-title">
          {strings.error_title}
        </h1>
        <p data-testid="error-state-message">{strings.error_body}</p>
        <button type="button" data-testid="error-retry" onClick={() => reset()}>
          {strings.error_retry}
        </button>
      </section>
    </main>
  );
}
