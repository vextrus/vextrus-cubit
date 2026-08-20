import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/auth';

/**
 * AC-11 — three states, and never silence (R-UI-050):
 *  - arrived from sign-up: the link is on its way
 *  - arrived from the link, verified: say so and point at sign-in
 *  - arrived from the link, refused: the refusal in place, with its remedy
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const failed = query.error !== undefined;
  const verified = query.verified !== undefined && !failed;

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-heading">
          <h1>{strings.verifyTitle}</h1>
        </div>

        {failed ? (
          <div data-testid="verify-email-error">
            <RefusalState code="AUTH_TOKEN_EXPIRED" remedyHref="/sign-up" remedyLabel={strings.signUpSubmit} />
          </div>
        ) : null}

        {verified ? (
          <p className="notice" data-testid="verify-email-success">
            <span className="notice-strong">{strings.verifySuccess}</span>
          </p>
        ) : null}

        {failed || verified ? null : (
          <p className="notice" data-testid="verify-email-sent">
            {strings.verifySentLede}
          </p>
        )}

        <p className="auth-footer">
          <a className="link" href="/sign-in">
            {strings.verifyGoToSignIn}
          </a>
        </p>
      </section>
    </div>
  );
}
