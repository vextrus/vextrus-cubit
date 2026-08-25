// The root layout every route and the root error boundary render inside. It carries no chrome and
// no styling yet: the Datum token source does not exist, and this increment ships the scaffold the
// server spine needs, not a design.
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
