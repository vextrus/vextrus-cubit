"use client";
// Asking for a magic link (Decision § 2). An address with no account gets the same sent notice as
// one with: the screen never confirms which addresses exist, and the outbox is the only difference.
import { AuthForm, type AuthField } from "../auth-form";
import { AUTH_ROUTES } from "../routes";
import { mutate } from "../transport";

const FIELDS: readonly AuthField[] = [{ name: "email", testId: "s-auth-email", label: "auth_email_label", type: "email", autoComplete: "email" }];

export function MagicLinkForm() {
  return (
    <AuthForm
      route={AUTH_ROUTES.magicLink}
      fields={FIELDS}
      submit="auth_magic_link_submit"
      perform={(values) => mutate("requestMagicLink", { email: values["email"] ?? "" })}
      success={{ title: "auth_magic_link_sent_title", notice: "auth_magic_link_sent" }}
    />
  );
}
