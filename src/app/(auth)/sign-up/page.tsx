'use client';

import { useState, type FormEvent } from 'react';
import type { RefusalCode } from '../../../core/errors';
import { Button } from '../../../ui/primitives/button';
import { Field } from '../../../ui/primitives/field';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/auth';
import { authClient, refusalFor } from '../auth-client';
import { useHydratedForm } from '../hydrated-form';

/** S-Auth — sign up. Signing up does not sign you in: it asks for the address to be proven. */
export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { formRef, ready } = useHydratedForm((typed) => {
    setName(typed('name'));
    setEmail(typed('email'));
    setPassword(typed('password'));
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefusal(null);
    setBusy(true);
    const { error } = await authClient.signUp.email({ name, email, password });
    setBusy(false);
    if (error) {
      setRefusal(refusalFor(error));
      return;
    }
    /**
     * The prompt lands here rather than at `/verify-email`: navigating away a
     * beat after the answer arrives leaves a window in which the screen is one
     * page and the browser is on its way to another, and anything reading the
     * page in that window — a screenshot, an axe pass — reads a page being torn
     * down. `/verify-email` is still the screen the mailed link lands on.
     */
    setSent(true);
  }

  return (
    <div className="auth-shell">
      {/* posts, never gets: a submit that beats hydration must not put a password in the URL */}
      <form ref={formRef} className="auth-card" method="post" onSubmit={onSubmit} noValidate>
        <div className="auth-heading">
          <h1>{strings.signUpTitle}</h1>
          <p className="auth-lede">{strings.signUpLede}</p>
        </div>

        {refusal === null ? null : <RefusalState code={refusal} />}

        {sent ? (
          <p className="notice" data-testid="verify-email-sent">
            <span className="notice-strong">{strings.verifySentLede}</span>
          </p>
        ) : (
          <>
            <div className="form">
              <Field
                testId="signup-name"
                label={strings.signUpName}
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Field
                testId="signup-email"
                label={strings.signUpEmail}
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Field
                testId="signup-password"
                label={strings.signUpPassword}
                hint={strings.signUpPasswordHint}
                type="password"
                name="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {/* the submit waits for interactivity: a native POST here is a 405 and a lost account */}
            <Button type="submit" data-testid="signup-submit" disabled={!ready || busy} aria-busy={!ready}>
              {strings.signUpSubmit}
            </Button>
          </>
        )}

        <p className="auth-footer">
          <span>{strings.signUpHasAccount}</span>
          <a className="link" href="/sign-in">
            {strings.signInSubmit}
          </a>
        </p>
      </form>
    </div>
  );
}
