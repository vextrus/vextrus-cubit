// /sign-up (Decision § 2). R-SPINE-002: this screen is the only user-creating door the product has.
import { AuthFrame } from "../auth-frame";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES } from "../routes";
import { SignUpForm } from "./sign-up-form";

const FOOTER: readonly FooterLine[] = [{ prose: "auth_sign_up_footer_prose", label: "auth_sign_up_footer_link", href: AUTH_ROUTES.signIn }];

export default function SignUpPage() {
  return (
    <AuthFrame title="auth_sign_up_title" footer={FOOTER}>
      <SignUpForm />
    </AuthFrame>
  );
}
