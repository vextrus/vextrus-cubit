// /reset (Decision § 2): one route for both halves of a reset — asking for the link, and setting the
// password the link carries the right to set.
import { AuthFrame } from "../auth-frame";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES, tokenFrom } from "../routes";
import { ResetPasswordForm, ResetRequestForm } from "./reset-forms";

const FOOTER: readonly FooterLine[] = [{ label: "auth_back_to_sign_in", href: AUTH_ROUTES.signIn }];

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = tokenFrom(await searchParams);
  return (
    <AuthFrame title="auth_reset_title" footer={FOOTER}>
      {token === null ? <ResetRequestForm /> : <ResetPasswordForm token={token} />}
    </AuthFrame>
  );
}
