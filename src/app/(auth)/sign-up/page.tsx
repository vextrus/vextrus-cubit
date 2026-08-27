// /sign-up (Decision § 2). R-SPINE-002: this screen is the only user-creating door the product has.
import { AuthFrame } from "../auth-frame";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES } from "../routes";
import { strings } from "../../../ui/strings";
import { SignUpForm } from "./sign-up-form";

// The document names the screen it is, so a tab, a history entry and a screen reader all say what
// the person is looking at — the title comes from the same table the heading does (R-SPINE-060).
export const metadata = { title: strings.auth_sign_up_title };

const FOOTER: readonly FooterLine[] = [{ prose: "auth_sign_up_footer_prose", label: "auth_sign_up_footer_link", href: AUTH_ROUTES.signIn }];

export default function SignUpPage() {
  return (
    <AuthFrame title="auth_sign_up_title" footer={FOOTER}>
      <SignUpForm />
    </AuthFrame>
  );
}
