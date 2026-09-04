"use client";

// ARCH-03, B-21: an outage renders the product's own error state, never a blank page and never a
// framework screen. The copy comes from the string table (C-SPINE-PLATFORM) and tells the truth —
// the work is safe, the fault is recorded for the operators, and the remedy is one button. No
// error internals are shown: a fault's cause belongs on the fault sink, not on a screen.
import { useEffect, useState } from "react";
import { strings } from "../ui/strings";

// ARCH-02/B-17: the error state's markup has exactly one home. `global-error.tsx` — the boundary
// Next reaches for when the root layout itself throws — renders this same element inside its own
// document shell rather than carrying a second copy of the copy, the test ids and the remedy.
export function ErrorState({ reset }: { reset: () => void }) {
  // An alert is announced when the region's content CHANGES. A region that is inserted with its
  // sentence already inside it is one assistive technology meets for the first time already full,
  // and whether that is spoken at all is left to the implementation — so the region is committed
  // first, empty, and the fault lands in the commit after it, which is a change inside something
  // already being watched (Q-11). The region itself, its role and the heading it is named by are
  // there from the first commit: what waits is the content, never the landmark.
  //
  // This costs no no-JS path. A boundary is a client component by definition — without the bundle
  // there is no boundary to render an outage into at all — so the second commit always arrives.
  const [reached, setReached] = useState(false);
  useEffect(() => {
    setReached(true);
  }, []);

  return (
    <main data-testid="error-state">
      <section role="alert" aria-labelledby="error-state-title">
        {reached ? (
          <>
            <h1 id="error-state-title" data-testid="error-state-title">
              {strings.error_title}
            </h1>
            <p data-testid="error-state-message">{strings.error_body}</p>
            <button type="button" data-testid="error-retry" onClick={() => reset()}>
              {strings.error_retry}
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

export default function RootErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} />;
}
