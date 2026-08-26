"use client";
// R-SPINE-002's one door: sign-up names the workspace, because an account that belongs nowhere is
// unrepresentable and the person is the one who knows what to call theirs (R-UI-033, Decision I-11).
import { AuthForm, type AuthField } from "../auth-form";
import { AUTH_ROUTES } from "../routes";
import { mutate } from "../transport";

const FIELDS: readonly AuthField[] = [
  { name: "email", testId: "s-auth-email", label: "auth_email_label", type: "email", autoComplete: "email" },
  { name: "password", testId: "s-auth-password", label: "auth_password_label", type: "password", autoComplete: "new-password" },
  {
    name: "tenantName",
    testId: "s-auth-tenant-name",
    label: "auth_workspace_label",
    autoComplete: "organization",
    placeholder: "auth_workspace_placeholder",
    hint: "auth_workspace_hint",
  },
];

export function SignUpForm() {
  return (
    <AuthForm
      route={AUTH_ROUTES.signUp}
      fields={FIELDS}
      submit="auth_sign_up_submit"
      perform={(values) => mutate("signUp", { email: values["email"] ?? "", password: values["password"] ?? "", tenantName: values["tenantName"] ?? "" })}
      success={{ title: "auth_sign_up_sent_title", notice: "auth_sign_up_sent" }}
    />
  );
}
