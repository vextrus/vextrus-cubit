'use client';

import { useState, type FormEvent } from 'react';
import type { RefusalCode } from '../../../core/errors';
import { Button } from '../../../ui/primitives/button';
import { Field } from '../../../ui/primitives/field';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/auth';
import { authClient, refusalFor } from '../auth-client';
import { useHydratedForm } from '../hydrated-form';

/** S-Auth — sign in. Minimal, branded, fast; every refusal lands in place. */
export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [busy, setBusy] = useState(false);
  const { formRef, ready } = useHydratedForm((typed) => {
    setEmail(typed('email'));
    setPassword(typed('password'));
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefusal(null);
    setBusy(true);
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) {
      setRefusal(refusalFor(error));
      return;
    }
    window.location.assign('/');
  }

  return (
    <div className="auth-shell">
      {/* posts, never gets: a submit that beats hydration must not put a password in the URL */}
      <form ref={formRef} className="auth-card" method="post" onSubmit={onSubmit} noValidate>
        <div className="auth-heading">
          <h1>{strings.signInTitle}</h1>
          <p className="auth-lede">{strings.signInLede}</p>
        </div>

        {refusal === null ? null : (
          <RefusalState code={refusal} remedyHref="/forgot-password" remedyLabel={strings.signInForgot} />
        )}

        <div className="form">
          <Field
            testId="signin-email"
            label={strings.signInEmail}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Field
            testId="signin-password"
            label={strings.signInPassword}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {/* the submit waits for interactivity: a native POST here is a 405 and a lost password */}
        <Button type="submit" data-testid="signin-submit" disabled={!ready || busy} aria-busy={!ready}>
          {strings.signInSubmit}
        </Button>

        <p className="auth-footer">
          <a className="link" href="/magic-link">
            {strings.signInMagicLink}
          </a>
          <a className="link" href="/forgot-password">
            {strings.signInForgot}
          </a>
          <a className="link" href="/sign-up">
            {strings.signInNoAccount}
          </a>
        </p>
      </form>
    </div>
  );
}
