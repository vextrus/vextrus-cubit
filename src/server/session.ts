import { headers } from 'next/headers';
import { auth } from './auth';

/** The signed-in account, read from the request's own headers. */
export async function currentSession() {
  return auth.api.getSession({ headers: await headers() });
}
