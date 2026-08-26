// /verify (Decision § 2): the screen behind the verification mail. With a token there is nothing to
// fill in — the panel spends it on mount; without one the page says what it is missing rather than
// showing an empty form for a link the person already has.
import { NoticeSlot } from "../answer-slot";
import { AuthFrame } from "../auth-frame";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES, tokenFrom } from "../routes";
import { TokenPanel } from "../token-panel";
import { strings } from "../../../ui/strings";

const FOOTER: readonly FooterLine[] = [{ label: "auth_evidence_go_to_sign_in", href: AUTH_ROUTES.signIn }];

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = tokenFrom(await searchParams);
  return (
    <AuthFrame title="auth_verify_title" footer={FOOTER}>
      {token === null ? (
        <NoticeSlot message={strings.auth_verify_no_token} />
      ) : (
        <TokenPanel route={AUTH_ROUTES.verify} token={token} procedure="verifyEmail" outcome={{ notice: "auth_verify_done" }} />
      )}
    </AuthFrame>
  );
}
