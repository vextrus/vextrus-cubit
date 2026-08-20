'use server';

import { redirect } from 'next/navigation';
import { RefusalError, type RefusalCode } from '../../../core/errors';
import { currentSession } from '../../../server/session';
import { createTenant } from '../../../server/tenant';

export interface CreateTenantState {
  refusal: RefusalCode | null;
}

/**
 * R-UI-033 — onboarding's one step. A refused name comes back as a code the
 * screen renders in place; it never throws the person out of the form.
 */
export async function createTenantAction(
  _previous: CreateTenantState,
  form: FormData,
): Promise<CreateTenantState> {
  const session = await currentSession();
  if (session === null) redirect('/sign-in');

  const name = String(form.get('name') ?? '').trim();

  let slug: string;
  try {
    slug = (await createTenant(session.user.id, name)).slug;
  } catch (error) {
    if (error instanceof RefusalError) return { refusal: error.code };
    throw error;
  }

  redirect(`/t/${slug}`);
}
