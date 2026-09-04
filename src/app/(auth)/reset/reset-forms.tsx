"use client";
// The two halves of a reset (Decision § 2): asking for the link, and setting the password behind it.
// R-SPINE-001 revokes the account's other sessions when the password is set, and the notice says so
// plainly — a person whose other devices were just signed out is owed that fact, not a surprise.
import { AuthForm, type AuthField } from "../auth-form";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES, tokenSearch } from "../routes";
import { mutate } from "../transport";

const EMAIL_FIELD: readonly AuthField[] = [{ name: "email", testId: "s-auth-email", label: "auth_email_label", type: "email", autoComplete: "email" }];

const PASSWORD_FIELD: readonly AuthField[] = [
  { name: "password", testId: "s-auth-password", label: "auth_new_password_label", type: "password", autoComplete: "new-password" },
];

const CONTINUE: FooterLine = { label: "auth_reset_continue", href: AUTH_ROUTES.home };

export function ResetRequestForm() {
  return (
    <AuthForm
      route={AUTH_ROUTES.reset}
      fields={EMAIL_FIELD}
      submit="auth_reset_request_submit"
      perform={(values) => mutate("requestPasswordReset", { email: values["email"] ?? "" })}
      success={{ title: "auth_reset_sent_title", notice: "auth_reset_sent" }}
    />
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <AuthForm
      route={AUTH_ROUTES.reset}
      // This half of the screen exists only behind a mailed link, so a refusal resolved here leads
      // back to the address as it is — a bare `/reset` would be the request form, not this one.
      search={tokenSearch(token)}
      fields={PASSWORD_FIELD}
      submit="auth_reset_submit"
      perform={(values) => mutate("resetPassword", { token, password: values["password"] ?? "" })}
      success={{ title: "auth_reset_done_title", notice: "auth_reset_done", then: CONTINUE }}
    />
  );
}
