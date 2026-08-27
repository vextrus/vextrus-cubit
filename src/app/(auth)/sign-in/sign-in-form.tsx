"use client";
// The credentialed door (Decision § 2). `perform` replaces the transport and nothing else: given
// one, the form maps the settlement exactly as it maps the real one, which is what makes the screen
// a browser renders and the form a test renders the same component (R-SPINE-007).
import { AuthForm, type AuthField } from "../auth-form";
import { AUTH_ROUTES } from "../routes";
import { mutate } from "../transport";

const FIELDS: readonly AuthField[] = [
  { name: "email", testId: "s-auth-email", label: "auth_email_label", type: "email", autoComplete: "email" },
  { name: "password", testId: "s-auth-password", label: "auth_password_label", type: "password", autoComplete: "current-password" },
];

/** What a sign-in attempt carries: the credentials as entered, judged only by the server (I-13). */
export interface SignInAttempt {
  email: string;
  password: string;
}

export interface SignInFormProps {
  perform?: (attempt: SignInAttempt) => Promise<unknown>;
}

export function SignInForm({ perform }: SignInFormProps) {
  const attempt = perform ?? ((input: SignInAttempt) => mutate("signIn", input));
  return (
    <AuthForm
      route={AUTH_ROUTES.signIn}
      fields={FIELDS}
      submit="auth_sign_in_submit"
      perform={(values) => attempt({ email: values["email"] ?? "", password: values["password"] ?? "" })}
      success={{ goTo: AUTH_ROUTES.home }}
    />
  );
}
