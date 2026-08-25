"use client";

// ARCH-03, B-21: "an outage renders the product's own error state" admits no exception. `error.tsx`
// only catches throws *below* the root layout — a throw inside src/app/layout.tsx, or inside the
// boundary's own render, unwinds past it and Next falls back to its built-in framework screen,
// which is exactly the answer the checkpoint forbids. `global-error.tsx` is the boundary Next
// reaches for in that case; because it replaces the root layout, it must supply its own document
// shell. The error state itself is imported, never re-spelled (ARCH-02, B-17).
import { ErrorState } from "./error";

export default function GlobalErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorState reset={reset} />
      </body>
    </html>
  );
}
