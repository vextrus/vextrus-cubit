import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '../../../../server/auth';
import { formatDate } from '../../../../core/format';
import { Button } from '../../../../ui/primitives/button';
import { strings } from '../../../../ui/strings/auth';

/**
 * R-SPINE-001 — the device list. Every live session, the current one marked, and
 * a revoke on each of the others. An empty list says why it is empty (R-UI-020).
 */
export default async function SessionsPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session === null) redirect('/sign-in');

  const sessions = await auth.api.listSessions({ headers: requestHeaders });
  // The list is never truly empty — reading it takes a session. "Empty" here is
  // what the reader came to find out: whether anything else is signed in.
  const elsewhere = sessions.filter((entry) => entry.token !== session.session.token);

  return (
    <div className="page">
      <section className="panel">
        <div className="auth-heading">
          <h1>{strings.sessionsTitle}</h1>
          <p className="auth-lede">{strings.sessionsLede}</p>
        </div>

        {elsewhere.length === 0 ? (
          <p className="empty" data-testid="sessions-empty">
            {strings.sessionsEmpty}
          </p>
        ) : null}

        <ul className="rows" data-testid="sessions-list">
          {sessions.map((entry) => {
            const isCurrent = entry.token === session.session.token;
            const seenAt = new Date(entry.createdAt);

            return (
              <li className="row" key={entry.id} data-testid="session-row">
                <div className="row-main">
                  <span className="row-title">
                    {entry.userAgent ?? strings.sessionsUnknownDevice}
                  </span>
                  <span className="row-meta" data-session-id={entry.id}>
                    {entry.id}
                  </span>
                  <time className="row-meta" dateTime={seenAt.toISOString()}>
                    {formatDate(seenAt)}
                  </time>
                </div>

                {isCurrent ? (
                  <span className="badge" data-testid="session-current-badge">
                    {strings.sessionsCurrent}
                  </span>
                ) : (
                  <form method="post" action="/account/sessions/revoke">
                    <input type="hidden" name="sessionId" value={entry.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      data-testid="session-revoke"
                      aria-label={strings.sessionsRevokeLabel}
                    >
                      {strings.sessionsRevoke}
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
