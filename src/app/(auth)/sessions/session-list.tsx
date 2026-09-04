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
  const [loadAnswer, setLoadAnswer] = useState<Answer | null>(null);
  const [attemptAnswer, setAttemptAnswer] = useState<Answer | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  useEffect(() => {
    void settle(query("listSessions")).then((settled) => {
      if (settled.ok) setRows(rowsOf(settled.value));
      else setLoadAnswer(settled.answer);
    });
  }, []);

  const revoke = (id: string): void => {
    setEnding(id);
    setAttemptAnswer(null);
    void settle(mutate("revokeSession", { id })).then((settled) => {
      setEnding(null);
      if (settled.ok) setRows((live) => (live ?? []).filter((row) => row.id !== id));
      else setAttemptAnswer(settled.answer);
    });
  };

  const signOut = (): void => {
    setEnding(null);
    setAttemptAnswer(null);
    void settle(mutate("signOut", {})).then((settled) => {
      if (settled.ok) router.push(AUTH_ROUTES.signIn);
      else setAttemptAnswer(settled.answer);
    });
  };

  // The load leg's own answer stands in place of the list, because there is no list: a dead or
  // missing session answers SIGNED_OUT and a fault means the rows never arrived (Decision § 3, and
  // § 4's matrix, which rules that leg and only that leg).
  //
  // A revoke or a sign-out that comes back refused or faulted is a *settled attempt*, not a failed
  // load, and § 1's rule for one is that the surface stays and re-enables. Standing an attempt's
  // answer in place of the list would replace every row with a single card — no other revoke
  // control, no sign-out, and nothing but a reload to get back — for one row's revoke that did not
  // land. So it renders in the slot below the list, which is still there to try again from.
  if (loadAnswer !== null) return <AnswerSlot answer={loadAnswer} route={AUTH_ROUTES.sessions} />;

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
                  onClick={() => revoke(row.id)}
                >
                  {strings.auth_sessions_revoke}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {/* The slot waits here from the first paint, empty, so a revoke that comes back refused or
          faulted is an insertion into a region assistive technology is already watching. A region
          that arrives with its sentence already inside it is met for the first time already full,
          and whether that is announced at all is left to the implementation (Q-11). The wrapper
          carries no role of its own — the fault slot is what claims to be an alert, and only when
          there is one — and it may not be `aria-live="off"`: the algorithm resolves a changed node
          against the nearest `aria-live` from the node itself upward, so `off` here would file the
          insertion under a silent region, where a nested alert is at worst read twice. */}
      <div aria-live="polite">
        <AnswerSlot answer={attemptAnswer} route={AUTH_ROUTES.sessions} />
      </div>
      <Button className="cx-auth-signout" data-testid="s-auth-signout" variant="secondary" onClick={signOut}>
        {strings.auth_sessions_sign_out}
      </Button>
    </>
  );
}
