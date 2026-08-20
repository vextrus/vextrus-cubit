'use client';

import { useState, type FormEvent } from 'react';
import type { RefusalCode } from '../../../core/errors';
import { Button } from '../../../ui/primitives/button';
import { Field } from '../../../ui/primitives/field';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/auth';
import { authClient, refusalFor } from '../auth-client';

/**
 * R-SPINE-001 — password reset, requested. The confirmation says nothing about
 * whether the address has an account: an enumeration oracle is not a feature.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefusal(null);
    setBusy(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setBusy(false);
    if (error) {
      setRefusal(refusalFor(error));
      return;
    }
    setSent(true);
  }

  return (
    <div className="auth-shell">
      {/* posts, never gets: a submit that beats hydration must not put an address in the URL */}
      <form className="auth-card" method="post" onSubmit={onSubmit} noValidate>
        <div className="auth-heading">
          <h1>{strings.forgotTitle}</h1>
          <p className="auth-lede">{strings.forgotLede}</p>
        </div>

        {refusal === null ? null : <RefusalState code={refusal} />}

        {sent ? (
          <p className="notice" data-testid="forgot-sent">
            {strings.forgotSent}
          </p>
        ) : (
          <>
            <div className="form">
              <Field
                testId="forgot-email"
                label={strings.forgotEmail}
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button type="submit" data-testid="forgot-submit" disabled={busy}>
              {strings.forgotSubmit}
            </Button>
          </>
        )}

        <p className="auth-footer">
          <a className="link" href="/sign-in">
            {strings.magicLinkBack}
          </a>
        </p>
      </form>
    </div>
  );
}
