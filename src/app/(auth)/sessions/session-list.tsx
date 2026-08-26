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
import { AnswerSlot } from "../answer-slot";
import { settle, type Answer } from "../answers";
import { AUTH_ROUTES } from "../routes";
import { mutate, query } from "../transport";

/** One row of the answer, as `spine.auth.listSessions` gives it (the increment's interfaces). */
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

function rowsOf(value: unknown): SessionRow[] {
  return Array.isArray(value) ? (value as SessionRow[]) : [];
}

export function SessionList() {
  const router = useRouter();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  useEffect(() => {
    void settle(query("listSessions")).then((settled) => {
      if (settled.ok) setRows(rowsOf(settled.value));
      else setAnswer(settled.answer);
    });
  }, []);

  const revoke = (id: string): void => {
    setEnding(id);
    void settle(mutate("revokeSession", { id })).then((settled) => {
      setEnding(null);
      if (settled.ok) setRows((live) => (live ?? []).filter((row) => row.id !== id));
      else setAnswer(settled.answer);
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
      <div className="cx-auth-session-list">
        {LOADING_ROWS.map((row) => (
          <Skeleton className="cx-auth-session-skeleton" key={row} />
        ))}
      </div>
    );
  }

  return (
    <>
      <ul className="cx-auth-session-list">
        {rows.map((row) => (
          <li className="cx-auth-session-row" data-testid="s-auth-session-row" key={row.id}>
            <span>
              <span className="cx-auth-session-device">{row.deviceLabel}</span>
              <span className="cx-auth-session-since">{signedInOn(row.createdAt)}</span>
            </span>
            {row.current ? (
              <Badge data-testid="s-auth-session-current">{strings.auth_sessions_current}</Badge>
            ) : (
              <Button data-testid="s-auth-session-revoke" variant="danger" loading={ending === row.id} onClick={() => revoke(row.id)}>
                {strings.auth_sessions_revoke}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button className="cx-auth-signout" data-testid="s-auth-signout" variant="secondary" onClick={signOut}>
        {strings.auth_sessions_sign_out}
      </Button>
    </>
  );
}
