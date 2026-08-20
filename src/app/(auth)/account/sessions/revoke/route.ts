import { headers } from 'next/headers';
import { auth, revokeSessionById } from '../../../../../server/auth';

/**
 * R-SPINE-001 — revoking a device.
 *
 * This is a plain form POST rather than a server action on purpose. "Revoke"
 * makes a promise about another device: the moment the control answers, that
 * device is out. A server action's submit returns as soon as the browser has
 * *dispatched* the request, so the promise is only true a little later — long
 * enough for the revoked device's next navigation to still find a live session.
 * A document POST does not answer until the server has answered: the row is gone
 * before the click is over, and the redirect brings back a page that says so.
 *
 * The form carries the session *id*, never its token: a token in markup is a
 * session anyone reading over your shoulder can take.
 */

/**
 * A relative Location keeps the browser on whichever spelling of this host it
 * came in on. `request.url` says `localhost` even when the request arrived at
 * 127.0.0.1, and sending someone to the other spelling sends them somewhere
 * their session cookie does not exist.
 */
function seeOther(path: string): Response {
  // 303: the answer to a POST is a page to GET, so a reload never re-revokes
  return new Response(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request): Promise<Response> {
  // A form post from somewhere else is not this person asking. Browsers always
  // name a cross-origin form's origin, so a mismatch is the whole test; an
  // absent Origin is same-origin traffic and passes. The comparison is against
  // the host this request actually arrived at — not `request.url`, which says
  // `localhost` whichever spelling of loopback the browser used, and not a
  // configured origin, which would make the control depend on how the machine
  // was spelled in an env var. Compared as text, because a hostile Origin need
  // not be a URL at all: `null` is one browsers really send.
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== `http://${host}` && origin !== `https://${host}`) {
    return new Response(null, { status: 403 });
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session === null) return seeOther('/sign-in');

  const form = await request.formData();
  const sessionId = String(form.get('sessionId') ?? '');
  // revokeSessionById only ever revokes a session of this reader's own (AC-20)
  if (sessionId.length > 0) await revokeSessionById(sessionId, requestHeaders);

  return seeOther('/account/sessions');
}
