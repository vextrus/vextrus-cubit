'use client';

import { useActionState } from 'react';
import { Button } from '../../../ui/primitives/button';
import { Field } from '../../../ui/primitives/field';
import { RefusalState } from '../../../ui/patterns/refusal-state';
import { strings } from '../../../ui/strings/tenant';
import { createTenantAction, type CreateTenantState } from './actions';

const INITIAL: CreateTenantState = { refusal: null };

/** Skipping is a first-class answer: the personal tenant is already standing. */
export function CreateTenantForm({ personalSlug }: { personalSlug: string }) {
  const [state, action, pending] = useActionState(createTenantAction, INITIAL);

  return (
    <div className="auth-shell">
      <form className="auth-card" action={action}>
        <div className="auth-heading">
          <h1>{strings.createTitle}</h1>
          <p className="auth-lede">{strings.createLede}</p>
        </div>

        {state.refusal === null ? null : <RefusalState code={state.refusal} />}

        <div className="form">
          <Field
            testId="create-tenant-name"
            label={strings.createName}
            hint={strings.createNameHint}
            name="name"
            autoComplete="organization"
            required
          />
        </div>

        <Button type="submit" data-testid="create-tenant-submit" disabled={pending}>
          {strings.createSubmit}
        </Button>

        <p className="auth-footer">
          <a className="link" data-testid="create-tenant-skip" href={`/t/${personalSlug}`}>
            {strings.createSkip}
          </a>
          <span>{strings.createSkipHint}</span>
        </p>
      </form>
    </div>
  );
}
