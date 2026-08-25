// The root layout every route and the root error boundary render inside. It carries no chrome and
// no styling: the Datum token source (R-UI-001) does not exist in the tree, and a colour or a font
// spelled here would be a value no token owns.
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
