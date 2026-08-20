'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RefusalCode } from '../../../core/errors';
import { Button } from '../../../ui/primitives/button';
import { Field } from '../../../ui/primitives/field';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/auth';
import { authClient, refusalFor } from '../auth-client';

function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * A magic link works once. Spending it twice sends the browser back here with
   * `error=…`, and the screen says which link died rather than offering a fresh
   * form with no explanation (R-UI-020).
   */
  const linkRefused = useSearchParams().get('error') !== null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefusal(null);
    setBusy(true);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/' });
    setBusy(false);
    if (error) {
      setRefusal(refusalFor(error));
      return;
    }
    setSent(true);
  }

  return (
    // posts, never gets: a submit that beats hydration must not put an address in the URL
    <form className="auth-card" method="post" onSubmit={onSubmit} noValidate>
      <div className="auth-heading">
        <h1>{strings.magicLinkTitle}</h1>
        <p className="auth-lede">{strings.magicLinkLede}</p>
      </div>

      {linkRefused ? <RefusalState code="AUTH_TOKEN_EXPIRED" /> : null}
      {refusal === null ? null : <RefusalState code={refusal} />}

      {sent ? (
        <p className="notice" data-testid="magic-link-sent">
          {strings.magicLinkSent}
        </p>
      ) : (
        <>
          <div className="form">
            <Field
              testId="magic-link-email"
              label={strings.magicLinkEmail}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" data-testid="magic-link-submit" disabled={busy}>
            {strings.magicLinkSubmit}
          </Button>
        </>
      )}

      <p className="auth-footer">
        <a className="link" href="/sign-in">
          {strings.magicLinkBack}
        </a>
      </p>
    </form>
  );
}

/** R-SPINE-001 — magic-link sign-in. */
export default function MagicLinkPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<p className="auth-lede">{strings.magicLinkLede}</p>}>
        <MagicLinkForm />
      </Suspense>
    </div>
  );
}
