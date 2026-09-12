"use client";
// The parts of the auth column that change when the form inside the card settles: the heading that
// renames itself, and the foot readout's status cell (Decision § 1).
//
// A door whose work is finished replaces the form with its notice, and until this context existed
// the `<h1>` above that notice went on saying what the person had come to do: "Create your account"
// over "Check your email — we sent you a verification link." A heading names what is on the screen,
// so a heading that names something no longer there is false, and it is the first line a screen
// reader reaches (R-UI-050 — the settled leg is a state of the screen, not of the form alone).
//
// The form is a client island below a server-rendered column, so the two are joined by the one
// thing that crosses that boundary downward: this context. Outside a provider both setters are
// no-ops, which is exactly what the jsdom acceptance renders — a form on its own, with no column
// around it.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { strings, type StringKey } from "../../ui/strings";
import type { AuthRoute } from "./routes";

/** Told what the finished screen is called; ignored where there is no heading to rename. */
export type DoneTitleSetter = (title: StringKey) => void;

/**
 * What the door has done with the last thing it was asked, as the foot's one cell reads it: nothing
 * asked yet, a call in flight, an answer that landed, an answer that refused or faulted.
 */
export type AuthStatus = "idle" | "working" | "settled" | "refused";

/** Told what the last attempt came to; ignored where there is no readout to move. */
export type AuthStatusSetter = (status: AuthStatus) => void;

/** What the column's parts share: what the screen is called now, and what its last attempt did. */
interface AuthLiveState {
  done: StringKey | null;
  setDone: DoneTitleSetter;
  status: AuthStatus;
  setStatus: AuthStatusSetter;
}

const QUIET: AuthLiveState = { done: null, setDone: () => {}, status: "idle", setStatus: () => {} };

const Live = createContext<AuthLiveState>(QUIET);

/** How a settled form or panel renames the heading above it. */
export function useDoneTitle(): DoneTitleSetter {
  return useContext(Live).setDone;
}

/** How a form in flight, or one that has been answered, moves the foot's status cell. */
export function useAuthStatus(): AuthStatusSetter {
  return useContext(Live).setStatus;
}

/** The column, and the state its heading and its readout are drawn from. */
export function AuthLive({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const [done, setDone] = useState<StringKey | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const value = useMemo<AuthLiveState>(() => ({ done, setDone, status, setStatus }), [done, status]);
  return (
    <Live.Provider value={value}>
      <div className="cx-auth-column" data-width={wide === true ? "wide" : undefined}>
        {children}
      </div>
    </Live.Provider>
  );
}

/** The one `<h1>`, saying what the screen is showing right now. */
export function AuthHeading({ title, titleId }: { title: StringKey; titleId: string }) {
  const { done } = useContext(Live);
  return (
    <h1 className="cx-auth-title" id={titleId}>
      {strings[done ?? title]}
    </h1>
  );
}

/**
 * The foot readout (Design Direction 00 §3.7): one line of mono cells under the card — where you
 * are, and what the last attempt came to.
 *
 * Recorded IOU — the build cell. §3.7's readout opens with the build a person is looking at
 * ("build a1b2c3"), and this installation stamps none: `ENV_NAMES` is the closed roster of the
 * seven names the product reads (`src/core/env.ts`), none of them a build reference, and a made-up
 * hash on a screen whose whole subject is trust is worse than no hash at all. The cell that exists
 * is the one the screen can state truthfully: the route it is standing on. **Owed by the increment
 * that stamps a build reference at build time:** it renders first in this line, before the route.
 */
export function StatusOverline({ route }: { route?: AuthRoute }) {
  const { status } = useContext(Live);
  return (
    <div className="cx-auth-foot">
      <span>{route ?? strings.shell_status_absent}</span>
      {/* The dot repeats what the card says in words, so nothing means by colour alone, and the
          answer it echoes announces itself where it stands (R-UI-012, R-UI-060). */}
      <span className="cx-auth-foot-dot" data-status={status} aria-hidden="true" />
    </div>
  );
}
