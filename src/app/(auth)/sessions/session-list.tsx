"use client";
// R-SPINE-001's device list: everywhere this account is signed in, with the calling device marked
// and every other one revocable (Decision § 2).
//
// Revoke is `danger`, never the act variant: ending a session destroys something rather than
// carrying a consequence. The list has no empty state by construction — reading it needs the very
// session it would list — and its loading leg keeps the rows' height so nothing jumps (R-UI-050).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Skeleton } from "../../../ui/primitives/core";
import { formatDate } from "../../../core/format";
import { fill, strings } from "../../../ui/strings";
import { AnswerSlot, NoticeSlot } from "../answer-slot";
import { settle, type Answer } from "../answers";
import { AUTH_ROUTES } from "../routes";
import { mutate, query } from "../transport";

/** One row of the answer, as `spine.auth.listSessions` gives it (R-SPINE-001). */
interface SessionRow {
  id: string;
  deviceLabel: string;
  createdAt: string;
  current: boolean;
}

/** How many bones stand in for the list while it loads: enough to read as a list, not as a page. */
const LOADING_ROWS = [0, 1, 2];

/**
 * When a session began, through the date seam (L-FMT-01). The instant arrives as ISO text and is
 * read in the reader's own zone — the date a person recognises is the one their device showed them.
 */
function signedInOn(createdAt: string): string {
  const at = new Date(createdAt);
  return fill(strings.auth_sessions_signed_in, { date: formatDate({ year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() }) });
}

/**
 * The screen's caption, rendered by the list rather than by the frame. It promises a list — the one
 * the SIGNED_OUT answer says cannot be shown — so it stands only on the legs that have one, loading
 * included, where the bones are the list arriving.
 */
function Caption() {
  return <p className="cx-auth-caption">{strings.auth_sessions_caption}</p>;
}

function rowsOf(value: unknown): SessionRow[] {
  return Array.isArray(value) ? (value as SessionRow[]) : [];
}

export function SessionList() {
  const router = useRouter();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  // The device the last revoke ended, so the act is acknowledged in words rather than by an absence.
  const [revoked, setRevoked] = useState<string | null>(null);

  useEffect(() => {
    void settle(query("listSessions")).then((settled) => {
      if (settled.ok) setRows(rowsOf(settled.value));
      else setAnswer(settled.answer);
    });
  }, []);

  // The row leaves the list on success (Decision § 2) and the notice says so: a list one row shorter
  // is an absence, and an absence reads the same as a click that missed. The acknowledgement names
  // the device the person picked, and it is `role="status"`, so a reader who cannot see the list
  // reflow is told what happened (R-UI-050).
  const revoke = (id: string, deviceLabel: string): void => {
    setEnding(id);
    setRevoked(null);
    void settle(mutate("revokeSession", { id })).then((settled) => {
      setEnding(null);
      if (settled.ok) {
        setRows((live) => (live ?? []).filter((row) => row.id !== id));
        setRevoked(deviceLabel);
      } else setAnswer(settled.answer);
    });
  };

  const signOut = (): void => {
    setEnding(null);
    void settle(mutate("signOut", {})).then((settled) => {
      if (settled.ok) router.push(AUTH_ROUTES.signIn);
      else setAnswer(settled.answer);
    });
  };

  // A dead or missing session answers SIGNED_OUT, and it stands in place of the list: there is no
  // list to show somebody who is not signed in (Decision § 3).
  if (answer !== null) return <AnswerSlot answer={answer} route={AUTH_ROUTES.sessions} />;

  if (rows === null) {
    return (
      <>
        <Caption />
        <div className="cx-auth-session-list">
          {LOADING_ROWS.map((row) => (
            <Skeleton className="cx-auth-session-skeleton" key={row} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Caption />
      {revoked === null ? null : <NoticeSlot message={fill(strings.auth_sessions_revoked, { device: revoked })} />}
      <ul className="cx-auth-session-list">
        {rows.map((row) => (
          <li className="cx-auth-session-row" data-testid="s-auth-session-row" key={row.id}>
            <span className="cx-auth-session-what">
              <span className="cx-auth-session-device">{row.deviceLabel}</span>
              <span className="cx-auth-session-since">{signedInOn(row.createdAt)}</span>
            </span>
            <span className="cx-auth-session-control">
              {row.current ? (
                <Badge data-testid="s-auth-session-current">{strings.auth_sessions_current}</Badge>
              ) : (
                <Button
                  aria-label={fill(strings.auth_sessions_revoke_device, { device: row.deviceLabel })}
                  data-testid="s-auth-session-revoke"
                  variant="danger"
                  loading={ending === row.id}
                  onClick={() => revoke(row.id, row.deviceLabel)}
                >
                  {strings.auth_sessions_revoke}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Button className="cx-auth-signout" data-testid="s-auth-signout" variant="secondary" onClick={signOut}>
        {strings.auth_sessions_sign_out}
      </Button>
    </>
  );
}
