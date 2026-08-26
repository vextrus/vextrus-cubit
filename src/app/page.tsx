// The product's front door. R-UI-031: every shipped screen is reachable by visible navigation from
// the shell, and a screen reachable only by a typed URL is a failing acceptance criterion — so the
// root route names the product and links to each screen this tier serves. It invents no copy and no
// chrome: the heading and the links come from the string table (R-SPINE-060) and the frame is the
// shipped one, asked for its `product` surface, which carries no mark (R-UI-070, Decision I-10).
import { AuthFrame } from "./(auth)/auth-frame";
import type { FooterLine } from "./(auth)/footer";
import { AUTH_ROUTES } from "./(auth)/routes";
import { strings } from "../ui/strings";
import "../ui/tokens.css";
import "../ui/theme/globals.css";
import "../ui/primitives/core/reticle.css";
import "./(auth)/s-auth.css";

// The document names the route it is, from the table the heading reads (R-SPINE-060).
export const metadata = { title: strings.home_title };

const NAV: readonly FooterLine[] = [
  { label: "home_sign_in", href: AUTH_ROUTES.signIn },
  { label: "home_sign_up", href: AUTH_ROUTES.signUp },
];

export default function HomePage() {
  return (
    <main className="cx-auth-page">
      <AuthFrame title="home_title" surface="product" footer={NAV}>
        {null}
      </AuthFrame>
    </main>
  );
}
