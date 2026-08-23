'use client';

/**
 * The session device list and its revoke (S-Auth §8, R-SPINE-001).
 *
 * Revoke is a fetch and never a navigation: the button enters the primitive's loading state,
 * the call resolves, and the row leaves — the list reflows, with no animation, because a row
 * that fades out is a row still on screen after the device it named was signed out. A failed
 * revoke restores the button and says so in an alert line above the list, cleared by the next
 * attempt, and a visually hidden status region announces the one that worked.
 *
 * No ConsequenceDialog (Interpretation 2, R-UI-021): the consequence is the row the reader is
 * looking at, already stating the device and the time. R-UI-021's server-computed preview is
 * for acts whose blast radius the reader cannot see; here the row *is* the preview.
 *
 * The signed-in time is device-local (§8), and a browser's zone is not something the server
 * knows, so the row is rendered in UTC and re-rendered in the reader's zone after mount. It
 * is never rendered blank: "Signed in" with an empty slot reads as a value that is missing
 * rather than one that is a frame away.
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '../../../../ui/primitives';
import { around, ten } from '../../strings';

const pad = (value: number): string => String(value).padStart(2, '0');

/** §8's time format: `YYYY-MM-DD HH:mm`, in the reader's own zone. */
function localTime(iso: string): string {
  const when = new Date(iso);
  return (
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ` +
    `${pad(when.getHours())}:${pad(when.getMinutes())}`
  );
}

/**
 * The same format in UTC — what the row carries until the browser has told us its zone.
 *
 * §8 asks the row to carry the session's creation time, and a slot rendered empty is a
 * missing value rather than a pending one: a reader on a slow connection, or one whose bundle
 * never arrives, would read "Signed in" and then nothing. The server and the first client
 * frame agree on this string (both compute it from the same instant with no zone of their
 * own), so hydration is quiet, and the effect below swaps in the reader's zone.
 */
function utcTime(iso: string): string {
  const when = new Date(iso);
  return (
    `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())} ` +
    `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}`
  );
}

/** The browsers and platforms a user-agent string is worth naming. */
const BROWSERS: readonly (readonly [string, string])[] = [
  ['Edg/', 'Edge'],
  ['OPR/', 'Opera'],
  ['Firefox/', 'Firefox'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
];

const PLATFORMS: readonly (readonly [string, string])[] = [
  ['Windows', 'Windows'],
  ['Android', 'Android'],
  ['iPhone', 'iOS'],
  ['iPad', 'iOS'],
  ['Mac OS X', 'macOS'],
  ['CrOS', 'ChromeOS'],
  ['Linux', 'Linux'],
];

/** §8: "browser then platform, e.g. 'Chrome on Windows'; unparseable → unknown device". */
export function deviceSummary(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim() === '') return ten('tenant.sessions.unknownDevice');
  const browser = BROWSERS.find(([token]) => userAgent.includes(token))?.[1];
  const platform = PLATFORMS.find(([token]) => userAgent.includes(token))?.[1];
  if (browser === undefined || platform === undefined) {
    return ten('tenant.sessions.unknownDevice');
  }
  return `${browser} on ${platform}`;
}

export interface SessionRow {
  readonly id: string;
  readonly token: string;
  readonly userAgent: string | null;
  readonly createdAt: string;
  readonly current: boolean;
}

export function SessionList({ sessions }: { sessions: readonly SessionRow[] }) {
  const [rows, setRows] = useState<readonly SessionRow[]>(sessions);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const revoke = useCallback(async (row: SessionRow) => {
    setFailed(false);
    setRevoking(row.id);
    try {
      const response = await fetch('/api/auth/revoke-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: row.token }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      setAnnounced(true);
    } catch {
      setFailed(true);
    } finally {
      setRevoking(null);
    }
  }, []);

  return (
    <>
      {failed ? (
        <p className="tenant-alert" role="alert" data-testid="auth-error">
          {ten('tenant.sessions.revokeFailed')}
        </p>
      ) : null}
      <ul className="tenant-sessions">
        {rows.map((row) => {
          const [before, after] = around('tenant.sessions.signedIn', 'time');
          return (
            <li
              key={row.id}
              className="tenant-session-row"
              data-testid="session-row"
              data-current={row.current ? 'true' : undefined}
            >
              <span className="tenant-session-device">
                {deviceSummary(row.userAgent)}
                {row.current ? <Badge tone="neutral">{ten('tenant.sessions.current')}</Badge> : null}
              </span>
              <span className="tenant-session-right">
                <span className="tenant-session-when">
                  {before}
                  <span className="numeric">
                    {mounted ? localTime(row.createdAt) : utcTime(row.createdAt)}
                  </span>
                  {after}
                </span>
                {row.current ? null : (
                  <Button
                    variant="secondary"
                    data-testid="session-revoke"
                    loading={revoking === row.id}
                    onClick={() => {
                      void revoke(row);
                    }}
                  >
                    {ten('tenant.sessions.revoke')}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="tenant-announce" role="status">
        {announced ? ten('tenant.sessions.revoked') : ''}
      </div>
    </>
  );
}
