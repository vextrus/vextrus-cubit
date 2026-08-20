'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { revokeSessionById } from '../../../../server/auth';

/**
 * R-SPINE-001 — revoking a device. The form carries the session *id*, never its
 * token: a token in markup is a session anyone reading the page can steal.
 */
export async function revokeSessionAction(form: FormData): Promise<void> {
  const sessionId = String(form.get('sessionId') ?? '');
  if (sessionId.length === 0) return;

  await revokeSessionById(sessionId, await headers());
  revalidatePath('/account/sessions');
}
