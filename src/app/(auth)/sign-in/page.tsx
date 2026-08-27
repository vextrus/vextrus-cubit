// /sign-in (Decision § 2). The footer names the two other ways in before it names the way to a new
// account: a person on this screen already has one, or they would not be here.
import { AuthFrame } from "../auth-frame";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES } from "../routes";
import { strings } from "../../../ui/strings";
import { SignInForm } from "./sign-in-form";

// The document names the screen it is, from the table the heading reads (R-SPINE-060).
export const metadata = { title: strings.auth_sign_in_title };

const FOOTER: readonly FooterLine[] = [
  { label: "auth_sign_in_magic_link", href: AUTH_ROUTES.magicLink },
  { label: "auth_sign_in_forgot", href: AUTH_ROUTES.reset },
  { prose: "auth_sign_in_footer_prose", label: "auth_sign_in_footer_link", href: AUTH_ROUTES.signUp },
];

export default function SignInPage() {
  return (
    <AuthFrame title="auth_sign_in_title" footer={FOOTER}>
      <SignInForm />
    </AuthFrame>
  );
}
