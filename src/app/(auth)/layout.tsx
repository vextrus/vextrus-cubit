// The layout the six S-Auth routes render inside. It brings the ground every one of them stands on:
// the generated token source (R-UI-001), the typographic base and the vendored faces (R-UI-003), the
// reticle's single home so a link or a field focuses lawfully wherever it sits (R-UI-012, B-17), and
// the screen's own stylesheet.
//
// The page itself is the landmark: one centred column standing on the datum — the mark, one card,
// and the mono readout at the foot — on the bare page ground, with no chrome around it
// (Decision § 1, Design Direction 00 §3.7).
import type { ReactNode } from "react";
import "../../ui/tokens.css";
import "../../ui/theme/globals.css";
import "../../ui/primitives/core/reticle.css";
import "./s-auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="cx-auth-page">{children}</main>;
}
