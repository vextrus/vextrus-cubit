'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { RefusalCode } from '../../../core/errors';
import { Button } from '../../../ui/primitives/button';
import { Field } from '../../../ui/primitives/field';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/auth';
import { authClient, refusalFor } from '../auth-client';

function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  /**
   * better-auth sends the browser here with `error=…` when the link is spent or
   * expired, and a link with no token at all is the same dead end. Answering
   * either with a form nobody can submit is the silence R-UI-020 forbids: the
   * refusal renders in place, with the way to get a fresh link.
   */
  const linkRefused = params.get('error') !== null || token.length === 0;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefusal(null);
    setMismatch(false);

    if (password !== confirmation) {
      setMismatch(true);
      return;
    }

    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) {
      setRefusal(refusalFor(error));
      return;
    }
    setDone(true);
  }

  // posts, never gets: a submit that beats hydration must not put a password in the URL
  return (
    <form className="auth-card" method="post" onSubmit={onSubmit} noValidate>
      <div className="auth-heading">
        <h1>{strings.resetTitle}</h1>
        <p className="auth-lede">{strings.resetLede}</p>
      </div>

      {linkRefused ? (
        <RefusalState
          code="AUTH_TOKEN_EXPIRED"
          remedyHref="/forgot-password"
          remedyLabel={strings.forgotSubmit}
        />
      ) : null}
      {refusal === null ? null : <RefusalState code={refusal} />}
      {mismatch ? <p className="notice">{strings.resetMismatch}</p> : null}

      {linkRefused ? null : done ? (
        <p className="notice" data-testid="reset-done">
          <span className="notice-strong">{strings.resetDone}</span>
        </p>
      ) : (
        <>
          <div className="form">
            <Field
              testId="reset-password"
              label={strings.resetPassword}
              type="password"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Field
              testId="reset-password-confirm"
              label={strings.resetPasswordConfirm}
              type="password"
              name="password-confirm"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          <Button type="submit" data-testid="reset-submit" disabled={busy}>
            {strings.resetSubmit}
          </Button>
        </>
      )}

      <p className="auth-footer">
        <a className="link" href="/sign-in">
          {strings.verifyGoToSignIn}
        </a>
      </p>
    </form>
  );
}

/** R-SPINE-001 — the second half of a reset: better-auth redirects here with the token. */
export default function ResetPasswordPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<p className="auth-lede">{strings.resetLede}</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
